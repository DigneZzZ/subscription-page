# HWID Device Management — Design Spec

**Date:** 2026-07-01
**Status:** Draft (hardened after adversarial security review)

## Цель

Дать владельцу подписки возможность просматривать и удалять HWID-устройства,
привязанные к его подписке, прямо со страницы подписки. Доступ к списку и
удалению защищён подтверждением владения через одноразовый код, отправляемый
в Telegram владельцу подписки.

## Условия включения фичи

Фича активна только если выполнены оба условия:

1. В env задан `TELEGRAM_BOT_TOKEN` (новая переменная). Включение по наличию
   токена — как у Chatwoot/платёжных провайдеров.
2. У пользователя подписки в Remnawave задан `telegramId` (бэкенд получает его
   через существующий `axiosService.getUserByShortUuid()`, который возвращает
   `uuid`, `telegramId`, `hwidDeviceLimit`).

`telegramId` никогда не отправляется в браузер — фронтенд получает только флаг
`telegramLinked: boolean`.

## Архитектура бэкенда

Новый NestJS-модуль `HwidDevicesModule` (контроллер + сервис) — отдельно от
RootService (813 строк). Всё состояние (коды, сессии, кулдауны, блокировки) —
bounded in-memory Map с периодическим sweep, по паттерну существующего
`applyPaymentRateLimit` (Redis в проекте нет, инстанс один).

### Эндпоинты (все под `/api/devices`)

Все требуют существующий session-JWT cookie. `shortUuid` берётся из claim `sub`
JWT (анти-IDOR паттерн /api/pay, без query-параметра).

**Middleware (P0-5):** существующий `checkAssetsCookieMiddleware` матчит API-пути
точным равенством (`req.path === '/api/pay'`). Для `/api/devices` используется
надёжный матчер, покрывающий все шесть подпутей
(`req.path.startsWith('/api/devices')`). Юнит-тест: каждый путь отклоняет запрос
без валидного session-cookie. Дополнительно: если `TELEGRAM_BOT_TOKEN` не задан —
все `/api/devices/*` возвращают 404/503 (feature disabled, fail-closed).

| Эндпоинт | Описание |
|---|---|
| `GET /api/devices/status` | `{ enabled, telegramLinked, deviceCount, deviceLimit }` для карточки. Кэш 30–60 с на shortUuid, rate-limit ДО обращения к панели. Форма/статус ответа одинаковы независимо от `telegramLinked` (S-1). |
| `POST /api/devices/challenge` | Генерирует 6-значный код, шлёт в Telegram. Ответ `{ ok, ttlSec, cooldownSec }` — код в ответе отсутствует. |
| `POST /api/devices/verify` `{ code }` | Проверка кода. Успех → сессия управления 10 мин (httpOnly cookie). Ответ `{ ok: boolean }` — **без** `attemptsLeft` (счётчик только на сервере, S-1). |
| `GET /api/devices` | Только при активной сессии `hwid_mgmt`. Проксирует `GET /api/hwid/devices/{userUuid}` панели. |
| `POST /api/devices/delete` `{ hwid }` | Только при сессии. Панель `POST /api/hwid/devices/delete`. TG-уведомление владельцу. Возвращает обновлённый список. |
| `POST /api/devices/delete-all` | Только при сессии. Панель `POST /api/hwid/devices/delete-all`. TG-уведомление. |

Список/удаление отклоняются с 403, если валидной `hwid_mgmt`-сессии нет.
Все ответы `/api/devices/*` — с заголовком `Cache-Control: no-store, private`
(S-7), чтобы список устройств не кэшировался прокси/CDN/историей браузера.

В `AxiosService` добавляются 3 метода-обёртки над HWID-эндпоинтами панели
(с `encodeURIComponent`).

## Механика кода и сессии

### Код подтверждения

- 6 цифр, `crypto.randomInt`, TTL 5 минут.
- Хранится только HMAC-SHA256-хэш. **Ключ HMAC выводится через HKDF из
  `INTERNAL_JWT_SECRET`** (`info='hwid-code-hmac'`), а не берётся сырым — крипто-
  разделение доменов (P0-3). Сравнение через `timingSafeEqual` над буферами
  равной длины (дайджесты фиксированной длины, поэтому исключение по длине
  невозможно). `INTERNAL_JWT_SECRET` в схеме конфига обязан быть ≥32 байт.
- Код в открытом виде существует только в Telegram-сообщении: не попадает
  в браузер, ответы API, URL, **логи** (см. P0-1 ниже).
- Хранилище `Map<shortUuid, Challenge>`; повторный запрос перезаписывает запись —
  старый код автоматически недействителен.
- **Атомарность (P0-6):** генерация challenge — синхронный check-and-set без
  `await` между проверкой кулдауна и записью в Map. Если непротухший challenge
  моложе кулдауна уже существует — сразу возвращаем cooldown-ответ, не генерируя
  второй код. Вызов Telegram выполняется ПОСЛЕ резервирования слота. Это
  закрывает гонку «два валидных кода одновременно».
- Кулдаун 60 секунд на повторный запрос (на shortUuid и на IP). Фронт получает
  `cooldownSec` и показывает таймер.

### Сессия управления

- После верного кода: токен `nanoid(32)` (crypto-RNG) →
  `Map<token, { shortUuid, userUuid, sessionId, expiresAt }>`, TTL 10 минут.
- Отдельный cookie `hwid_mgmt`: `httpOnly`, `secure`, `SameSite=Strict`,
  `maxAge=10 мин`.
- **Fail-safe проверка на каждом запросе списка/удаления (P0-2):**
  `if (!session || !jwt.sub || session.shortUuid !== jwt.sub || session.sessionId !== jwt.sessionId) return 403`.
  - `!jwt.sub` обязателен: `IJwtPayload.sub` опционален (`sub?: string`), без
    null-гварда сравнение со `undefined` может проскочить.
  - `session.sessionId === jwt.sessionId` привязывает `hwid_mgmt`-сессию к
    конкретному session-JWT, который её создал → нельзя переиграть чужой
    `hwid_mgmt`-cookie против session-JWT другой подписки.
- Внутри сессии код повторно не требуется: просмотр, удаление по одному,
  «Удалить все» (через confirm-модалку). На `delete`/`delete-all` — лимит
  N/мин на сессию, чтобы захваченная сессия не исчерпала API панели (S-2).

### Блокировки и rate-limit

- Rate-limit на все чувствительные эндпоинты (`status`, `challenge`, `verify`,
  `delete*`) ключуется по **паре IP + shortUuid**, а не по одному из них —
  переиспользуется существующий `applyPaymentRateLimit` (ключи `s:`/`u:` в
  root.service.ts). Пер-shortUuid лимит — то, что бьёт ротацию IP против одной
  жертвы (S-2). Rate-limit на `status` срабатывает ДО обращения к панели.
- Счётчик неудач на IP в скользящем окне 15 минут: +1 за неверный код,
  +1 за протухший неиспользованный challenge.
- 3 неудачи → IP блокируется на 10 минут (на challenge и verify), владельцу
  уходит TG-уведомление о неудачных попытках с IP.
- Тот же счётчик на shortUuid (защита от ротации IP) — при исчерпании блокируется
  ввод кода для подписки на 10 минут.
- У одного challenge максимум 3 попытки ввода, после — challenge уничтожается,
  нужен повторный запрос.
- **Все Map bounded (S-3):** переиспользуется константа `RATE_MAP_MAX_KEYS` и
  sweep из fix 25b1103. TTL: challenge 5 мин, сессия 10 мин, окна неудач
  15 мин + блок 10 мин. При достижении лимита ключей — 429, не рост Map.
- IP берётся из `req.clientIp` (getRealIp + TRUST_PROXY). IP к сессии НЕ
  пиннится (мобильные роумят IP внутри 10 мин).

## Telegram-уведомления

Прямой HTTPS-вызов `https://api.telegram.org/bot<TOKEN>/sendMessage` через
**выделенный axios-инстанс** с `timeout: 10s` и **отключённым логированием тел
запросов/ответов** (S-5). `chat_id` = `telegramId` из панели.

**P0-1 (критично, утечка кода в логи):** код лежит в теле запроса к Telegram и
попадает в `AxiosError.config.data`. В catch challenge-хендлера логируется
**только** `error.message`, `error.code`, `error.response?.status` — никогда сам
объект ошибки, `error.config` или `error.request`. Это же правило —
обязательный design-constraint для всего модуля.

Сообщения:

1. **Код**: «🔐 Запрос на управление устройствами подписки {username}.
   IP: {ip}. Код: {code}. Действителен 5 минут. Если это не вы — проигнорируйте.»
2. **Удаление**: «📱 Устройство удалено: {platform} {deviceModel}. IP: {ip}.»
   (аналогично для «удалены все устройства, N шт.»)
3. **Неудачные попытки**: уведомление о блокировке IP.

- **Инъекция через `{username}` (S-4):** сообщение отправляется **plain text
  без `parse_mode`** (либо `username` прогоняется через существующий
  `sanitizeUsername()`), иначе markdown/backticks в username ломают разметку/
  инъектируют ссылки.
- Язык: русский + английский дубль.
- **Ошибка отправки (S-5):** любой сбой (бот заблокирован, chat_id невалиден,
  таймаут) → challenge возвращает единый generic-ответ
  `{ ok: false, reason: 'tg_send_failed' }`, ничего не создавая. Не раскрываем
  «user not found»/«bot blocked» — это перечислимость валидности telegramId.

## Изоляция device-данных от страницы (P0-4)

Полный список устройств (HWID, platform, osVersion, deviceModel, userAgent,
requestIp) отдаётся **только** через `GET /api/devices` за сессией `hwid_mgmt`.
Он **никогда** не сериализуется в base64 `panelData` начального HTML (в отличие
от subscription info). В браузер до Telegram-верификации попадают лишь
`deviceCount`/`deviceLimit` через `/api/devices/status`. Добавляется тип-гвард:
поля устройств не должны появляться в `subscriptionData`. Код нигде не попадает
в DOM/zustand-store.

## Фронтенд

- Виджет `widgets/main/devices/` — карточка «Устройства»: счётчик «N из M»,
  кнопка «Управлять». `telegramLinked=false` → кнопка disabled с подсказкой.
  Фича выключена → виджет не рендерится.
- Модалка через `@mantine/modals`, на мобильных fullScreen. Шаги: (1) «Отправить
  код в Telegram» → (2) `PinInput` 6 цифр + таймер кулдауна + счётчик попыток →
  (3) список устройств (платформа, модель, ОС, дата, кнопка удаления), внизу
  «Удалить все» через `openConfirmModal`, бейдж отсчёта сессии; по истечении —
  возврат к шагу 1.
- Store `entities/devices-store` (zustand).
- i18n: локальный `devices.i18n.ts` по образцу `reset-traffic.i18n.ts` (ru/en+).
- Вибрация `vibrate('tap')`, уведомления через `@mantine/notifications`.

## Конфигурация

```bash
# Telegram bot для подтверждения управления HWID-устройствами.
# Бот должен принадлежать продавцу подписок — он пишет владельцу подписки.
# Пусто = раздел управления устройствами скрыт.
TELEGRAM_BOT_TOKEN=
```

- В `config.schema.ts` (S-6): `TELEGRAM_BOT_TOKEN: z.string().min(20).optional()`.
  Опционально — startup-проба `getMe()` по образцу `AxiosService.onModuleInit`
  (log-and-disable при ошибке).
- Ужесточить в схеме: `INTERNAL_JWT_SECRET` ≥32 байт (нужно для HKDF/HMAC, P0-3).
- Константы в коде модуля: TTL кода 5 мин, сессия 10 мин, кулдаун 60 с,
  3 попытки, блок 10 мин.

## Краевые случаи

- 0 устройств → карточка «0 устройств», управление доступно.
- `hwidDeviceLimit = null` → «N устройств» без «из M».
- Панель недоступна → 502 с человекочитаемой ошибкой в модалке.
- Перезапуск бэкенда сбрасывает in-memory состояние — пользователь запрашивает
  код заново. (Session-JWT живёт ≤33 мин и содержит `sub`, но без живой
  `hwid_mgmt`-сессии доступ к устройствам невозможен — fail-closed.)
- После удаления список обновляется из ответа панели.

## Сводка security-харденинга (после адверсариального ревью)

Блокирующие (P0):

1. **P0-1** — код не логировать: только `error.message/code/status`, никогда
   объект axios-ошибки; выделенный axios-инстанс без логирования тел.
2. **P0-2** — fail-safe IDOR-гвард `(!session || !jwt.sub || shortUuid mismatch ||
   sessionId mismatch) → 403`; `hwid_mgmt` привязан к `sessionId` session-JWT.
3. **P0-3** — HMAC-ключ через HKDF из `INTERNAL_JWT_SECRET`; `timingSafeEqual`;
   `INTERNAL_JWT_SECRET` ≥32 байт.
4. **P0-4** — device-данные только за `hwid_mgmt`-сессией, никогда в `panelData`.
5. **P0-5** — надёжный матчер путей `/api/devices/*` в middleware; feature-gate
   404/503 при пустом токене; guard на `hwid_mgmt` для list/delete; юнит-тесты.
6. **P0-6** — атомарная генерация challenge (синхронный check-and-set, TG после
   резервирования слота).

Важные (S):

- **S-1** — убрать `attemptsLeft` из ответа; форма ответа не зависит от
  `telegramLinked`.
- **S-2** — rate-limit по паре IP+shortUuid (reuse `applyPaymentRateLimit`);
  лимит на delete/session.
- **S-3** — bounded Maps с `RATE_MAP_MAX_KEYS` + sweep.
- **S-4** — plain-text TG-сообщение / `sanitizeUsername()`.
- **S-5** — timeout 10 c на TG; generic-ошибка при сбое.
- **S-6** — валидация `TELEGRAM_BOT_TOKEN` в схеме.
- **S-7** — `Cache-Control: no-store, private` на `/api/devices/*`.

Отклонено как спекулятивное/неприменимое: digit-by-digit brute-force (код
хэшируется, длина фиксирована), Telegram Login Widget redesign (вне scope),
webhook HMAC (webhook'а нет), IP-pinning сессии (ломает мобильных), маскировка
HWID (владелец легитимно видит свои устройства), nanoid entropy (crypto-RNG).
