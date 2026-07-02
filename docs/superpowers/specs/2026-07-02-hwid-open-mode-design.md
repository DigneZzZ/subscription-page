# HWID Management Modes (Telegram / Open / Disabled) — Design Spec

**Date:** 2026-07-02
**Status:** Approved (incremental extension of the HWID device-management feature)
**Builds on:** `docs/superpowers/specs/2026-07-01-hwid-device-management-design.md`

## Цель

Добавить режим управления HWID-устройствами **без подтверждения через Telegram** —
открытый доступ к просмотру и удалению устройств прямо на странице подписки для
любого, у кого есть ссылка на подписку. Режим выбирается одной env-переменной и
сосуществует с уже реализованным Telegram-режимом.

## Режимы и конфигурация

Новая env-переменная **`HWID_MANAGEMENT_MODE`**: `telegram | open | disabled`
(значение `off` — алиас `disabled`, регистр не важен).

- **`telegram`** — текущее поведение: удаление за одноразовым кодом в Telegram +
  10-мин сессия управления. Требует `TELEGRAM_BOT_TOKEN`.
- **`open`** — без кода: список и удаление доступны сразу, авторизуются существующим
  session-JWT страницы (claim `sub`, привязанный к shortUuid). Токен не требуется.
- **`disabled`** — раздел устройств скрыт, все `/api/devices/*` → 404.

**Default (переменная не задана):** обратная совместимость —
`telegram`, если задан `TELEGRAM_BOT_TOKEN`, иначе `disabled`.

**Валидация (config.schema.ts):** при явном `HWID_MANAGEMENT_MODE=telegram` без
`TELEGRAM_BOT_TOKEN` — ошибка zod-схемы (`superRefine`), т.к. это явная
мисконфигурация. `open` токена не требует.

## Backend

- `HwidDevicesService`: вводим резолвнутый геттер
  `get mode(): 'telegram' | 'open' | 'disabled'` из `HWID_MANAGEMENT_MODE` +
  наличия токена (по правилам default выше). `get isEnabled()` = `mode !== 'disabled'`.
  Резолв выносится в чистую функцию `resolveHwidMode(modeEnv, hasToken)` для юнит-теста.
- `getStatus` добавляет `mode` в ответ:
  `{ enabled, mode, telegramLinked, deviceCount, deviceLimit }`.
- Приватный `authorize()` в сервисе, ветвится по `this.mode`:
  - `telegram` → `resolveSession(token, sessionId, sub)` (как сейчас; нужна
    `hwid_mgmt`-сессия из verify).
  - `open` → авторизация только по session-JWT: резолвим `userUuid` напрямую из
    `sub` через `getUserByShortUuid`, без кода и без `hwid_mgmt`. IDOR-гвард
    (`user.sub` из JWT) гарантирует владение этим `sub`.
  `listDevices`/`deleteDevice`/`deleteAll` вызывают `authorize()` вместо прямого
  `resolveSession`.
- `challenge`/`verify`: контроллер возвращает 404, когда `mode !== 'telegram'`
  (в open/disabled эти пути не применимы; фронт их не вызывает).
- **Rate-limit** сохраняется и в open: удаление лимитируется по паре IP+shortUuid
  (bounded-карты, паттерн `applyPaymentRateLimit`). Логики кодов/блокировок нет.
- **Уведомления:** open + `TELEGRAM_BOT_TOKEN` задан + у пользователя есть
  `telegramId` → шлём владельцу «устройство удалено / удалены все, IP инициатора X»
  (переиспользуем `notifyDeviceRemoved`/`notifyDeletedAll`). Без токена — тихо.
- Контроллер `guard()` по-прежнему: `mode==='disabled'` (или `!isEnabled`) → 404;
  `!user || !user.sub` → 403. `Cache-Control: no-store, private` на всех ответах.

## Telegram-сообщения (переработка `telegram-notifier.service.ts`)

Меняем формат всех сообщений нотификатора (действует в обоих режимах, где шлём TG):

- **Только английский** — русскую строку/дубль убираем.
- **Короткие и информативные** — одна суть на сообщение, без лишних фраз.
- **`parse_mode: 'HTML'`**, код обёрнут в `<pre>{code}</pre>` (моноширинный, tap-to-copy).
- **Безопасность инъекций:** переход на HTML требует экранирования интерполируемых
  значений. `username` уже проходит `sanitizeUsername` (оставляет только
  `[a-zA-Z0-9_-]` — HTML-безопасно). `platform`/`deviceModel` приходят из панели и
  НЕ санитизированы → добавляем `escapeHtml()` перед вставкой в HTML-сообщение.
  `code` (цифры), `ip`, `count` — безопасны, экранирование не требуется. Правило,
  фиксируемое в коде: любое динамическое значение в HTML-сообщении, кроме уже
  `sanitizeUsername`-нутого username, проходит `escapeHtml`.
- Требования к логированию не меняются (P0-1): в `catch` по-прежнему только
  `error.message`/`error.response?.status`, никогда объект/`config`/`request`.

Форматы (английский, HTML):

- **Код:** `🔐 Device management for <b>{username}</b> · IP {ip}\nCode (valid 5 min):\n<pre>{code}</pre>`
- **Удалено устройство:** `📱 Device removed for <b>{username}</b>: {platform} {deviceModel} · IP {ip}`
- **Удалены все:** `📱 All devices removed for <b>{username}</b> ({count}) · IP {ip}`
- **Блокировка:** `⚠️ Failed device-management attempts for <b>{username}</b> — IP {ip} blocked 10 min`

## Frontend

- `devices-api`/`devices-store`: пробрасываем `mode` из `/status`.
- Карточка «Устройства» — правило видимости (упрощаем, убираем «заглушку про привязку»):
  - `mode==='disabled'` → виджет не рендерится (как сейчас).
  - `mode==='telegram'` и `telegramLinked===false` → **виджет НЕ рендерится вообще**
    (раньше была disabled-кнопка с подсказкой «привяжите Telegram» — убираем;
    строка `linkTelegramHint` и disabled-состояние больше не нужны).
  - `mode==='telegram'` и `telegramLinked===true` → кнопка активна, открывает
    code-флоу.
  - `mode==='open'` → кнопка активна всегда (telegramId нерелевантен).
- Модалка ветвится по `mode`:
  - `telegram` — без изменений (intro → код (PinInput) → список + бейдж 10-мин сессии).
  - `open` — при открытии сразу `fetchDevices()` и шаг `list`, минуя intro/код;
    **без** бейджа обратного отсчёта (эфемерной сессии нет — действия авторизуются
    живым session-JWT). 403 (истёк session-JWT) → ошибка/закрытие.
- i18n: `linkTelegramHint` больше не используется (можно оставить в файле как
  неиспользуемую или удалить). Прочие строки списка/удаления переиспользуются;
  строки шага с кодом в open не показываются. Новых строк не требуется.

## Тестирование

- Jest, чистая функция `resolveHwidMode(modeEnv: string | undefined, hasToken: boolean)`:
  - `('telegram', false)` → `'telegram'` (mode остаётся telegram, но валидация схемы
    отклонит запуск; функция не «тихо открывает») — тест фиксирует, что open НЕ
    возвращается при отсутствии токена.
  - `('open', false)` → `'open'`; `('open', true)` → `'open'`.
  - `(undefined, true)` → `'telegram'`; `(undefined, false)` → `'disabled'`.
  - `('off', *)` / `('disabled', *)` → `'disabled'`.
- Остальное — backend `tsc`/`nest build`/jest, frontend `typecheck`/`start:build`.

## Безопасность (явно)

`open` означает: **любой, у кого есть ссылка на подписку, может смотреть и удалять
устройства** — осознанная цель фичи. Сохраняются: IDOR-привязка действий к своему
`sub` (session-JWT), rate-limit на удаление, `Cache-Control: no-store`, device-данные
только через `GET /api/devices` (никогда в `panelData`). Утечки кода неактуальны
(кода в open нет).

## Краевые случаи

- `HWID_MANAGEMENT_MODE=open`, токен не задан → фича работает, уведомлений нет.
- `HWID_MANAGEMENT_MODE=telegram`, токен не задан → ошибка валидации при старте.
- Переменная не задана, токен задан → `telegram` (как до этого изменения).
- Переменная не задана, токена нет → `disabled` (как до этого изменения).
- `open`: `challenge`/`verify` → 404; фронт их не вызывает.
