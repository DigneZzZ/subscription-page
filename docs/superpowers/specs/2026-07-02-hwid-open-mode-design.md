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

## Frontend

- `devices-api`/`devices-store`: пробрасываем `mode` из `/status`.
- Карточка «Устройства»: в `open` кнопка активна всегда (состояние
  «привяжите Telegram» не применяется — оно только для `telegram` + `telegramLinked=false`).
- Модалка ветвится по `mode`:
  - `telegram` — без изменений (intro → код (PinInput) → список + бейдж 10-мин сессии).
  - `open` — при открытии сразу `fetchDevices()` и шаг `list`, минуя intro/код;
    **без** бейджа обратного отсчёта (эфемерной сессии нет — действия авторизуются
    живым session-JWT). 403 (истёк session-JWT) → ошибка/закрытие.
- i18n: переиспользуем существующие строки списка/удаления; строки шага с кодом в
  open не показываются. Новых строк не требуется.

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
