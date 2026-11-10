# Контракт API для бэкенда

Фронтенд готов к реальному серверу: достаточно реализовать эти маршруты и собрать с
`VITE_USE_MOCKS=false`. **Эталонная реализация** каждого маршрута — обработчики MSW в
`src/mocks/handlers/*.ts` (проверки прав, валидация, побочные эффекты); типы тел — `src/types/*`
и `src/api/*.ts`. URL — только в `src/api/endpoints.ts`.

## Общие правила

- Базовый путь — `VITE_API_BASE_URL` (по умолчанию `/api`). JSON, UTF-8, даты — ISO 8601 UTC.
- Аутентификация: `Authorization: Bearer <token>`. Ответ **401** → клиент выходит на страницу входа.
- Ошибка — HTTP-статус + тело `ApiErrorBody`:

  ```json
  { "code": "DUPLICATE", "message": "Шифр присвоен элементу «Болт М12…»", "details": { "field": "…" } }
  ```

  `message` показывается пользователю как есть — пишите по-русски и по делу.
  Используемые статусы: 400 (валидация), 401, 403 (нет права), 404, 409 (конфликт: дубликат,
  объект используется), 201 (создано), 204 (без тела).
- **Права проверяет сервер** по тем же правилам, что `lib/rbac.ts`: назначения «роль → область»,
  ограничение колонок и строк, ответственные за строки заявок, замещение.
  Колонки, на которые нет права, сервер не должен отдавать вовсе.

## Маршруты

### Сессия и профиль

| Метод | Путь | Тело → ответ | Примечание |
|---|---|---|---|
| POST | `/auth/login` | `LoginRequest {login, password, provider: 'local'\|'ldap'}` → `Session` | `Session.delegations` — кого пользователь сейчас замещает |
| GET | `/auth/me` | → `Session` | восстановление сессии по токену |
| POST | `/auth/logout` | → 204 | |
| POST | `/auth/password` | `ChangePasswordDto` → 204 | политика паролей, запрет повторов |
| PUT | `/auth/absence` | `AbsenceDto {until, deputyId, reason, from?}` → `Session` | своё отсутствие и заместитель |
| DELETE | `/auth/absence` | → `Session` | отменить отсутствие |
| GET | `/users/directory` | → `UserBrief[]` | ФИО и должности для подписей; всем вошедшим |

### Администрирование (право `admin`)

| Метод | Путь | Тело → ответ |
|---|---|---|
| GET / POST | `/admin/users` | → `User[]` / `CreateUserDto` → `User` |
| PUT / DELETE | `/admin/users/{id}` | `User` → `User` / → 204 (409, если пользователь есть в журналах) |
| POST | `/admin/users/{id}/reset-password` | → `{temporaryPassword}` |
| GET / POST | `/admin/roles` | → `Role[]` / `Role` → `Role` |
| PUT / DELETE | `/admin/roles/{id}` | `Role` → `Role` / → 204 (409, если роль назначена или в обходном листе) |
| GET / PUT | `/admin/password-policy` | → / `PasswordPolicy` |
| GET | `/audit?userId&objectType&q` | → `AuditEntry[]` (право `audit:read`) |

### Справочники

| Метод | Путь | Тело → ответ |
|---|---|---|
| GET / POST | `/catalogs` | → `CatalogSummary[]` / `Catalog` → `Catalog` (право `configure`) |
| GET / PUT / DELETE | `/catalogs/{id}` | → `Catalog` / `Catalog` → `Catalog` / → 204 (409, если на него ссылаются) |
| GET / POST | `/catalogs/{id}/elements` | → `CatalogElement[]` / `SaveElementDto` → `SaveElementResult` |
| PUT / DELETE | `/catalogs/{id}/elements/{elementId}` | `SaveElementDto` → `SaveElementResult` (сервер пишет историю) / → 204 |
| POST | `/catalogs/{id}/elements/{elementId}/move` | `{parentId}` → `CatalogElement` |
| POST | `/catalogs/{id}/elements/{elementId}/reconcile` | → `ReconcileResult[]` (сверка с внешними базами) |
| POST | `/catalogs/{id}/elements/{elementId}/codes` | `AssignCodeDto` → `AssignCodeResult` (сразу или через заявку) |
| DELETE | `/catalogs/{id}/elements/{elementId}/codes/{classifierId}` | → `CatalogElement` |

### Классификаторы

| Метод | Путь | Тело → ответ |
|---|---|---|
| GET / POST | `/classifiers` | → `ClassifierSummary[]` / `Classifier` → `Classifier` |
| GET / PUT / DELETE | `/classifiers/{id}` | → / `Classifier` → `Classifier` (валидация конфигурации) / → 204 (409, если привязан) |
| GET | `/classifiers/{id}/entries` | → `ClassifierEntry[]` |
| POST | `/classifiers/{id}/duplicate-check` | `{catalogId, code, excludeElementId?}` → `DuplicateCheckResult` |

Шифры сервер **обязан** перепроверять тем же движком (`lib/classifier` — чистый TypeScript, можно
запускать в Node.js на сервере как есть).

### Заявки и обходные листы

| Метод | Путь | Тело → ответ |
|---|---|---|
| GET / POST | `/requests` | → `Request[]` (только видимые пользователю) / `CreateRequestDto` → `CreateRequestResult` (201) |
| GET | `/requests/{id}` | → `Request` |
| POST | `/requests/{id}/steps/{stepId}/decision` | `DecideStepDto {decision, comment?, code?}` → `Request` |
| GET | `/workflows` | → `WorkflowConfig[]` |
| PUT / DELETE | `/workflows/{id}` | `WorkflowConfig` → `WorkflowConfig` / → 204 |
| GET | `/notifications` | → `AppNotification[]` текущего пользователя |
| POST | `/notifications/read` | `{ids?}` → 204 (без `ids` — все) |

Побочные эффекты решения строки (см. `mocks/handlers/request.ts`, `mocks/workflow.ts`):
отклонение закрывает заявку; когда все строки пройдены — применить изменения (создать/изменить элемент,
утвердить шифр), уведомить автора, запустить выгрузку в системы по событию; записать `onBehalfOf`,
если решает заместитель; записать действие в журнал.

### Интеграции

| Метод | Путь | Тело → ответ |
|---|---|---|
| GET | `/integrations/systems` | → `ExternalSystem[]` |
| PUT | `/integrations/systems/{id}` | `ExternalSystem` → `ExternalSystem` (админ) |
| POST | `/integrations/systems/{id}/ping` | → `PingResult` |
| GET | `/integrations/flows` | → `IntegrationFlow[]` |
| PUT | `/integrations/flows/{id}` | `IntegrationFlow` → `IntegrationFlow` (админ) |
| POST | `/integrations/flows/{id}/run` | `{elementId?}` → `FlowRunResult` (админ; с `elementId` — модератор справочника) |
| GET | `/integrations/journal?systemId&status&elementId` | → `ExchangeRecord[]` |

### Только демо

`POST /demo/reset` — сброс данных моков; на реальном сервере не нужен.
