# Как устроено приложение

**Стек:** Vue 3 (`<script setup>`) · TypeScript strict · Vite 6 · Pinia 3 · Vue Router 4 · PrimeVue 4 ·
Tailwind 3 · axios · MSW 2 (моки) · Vitest · Playwright. Все версии зафиксированы.

## Слои

```
src/
  types/        контракты данных — формат API и моков 1:1
  api/          axios + interceptors; endpoints.ts — ЕДИНСТВЕННОЕ место с URL; *.ts — вызовы по ресурсам
  lib/          ЧИСТЫЕ функции без Vue — переносимы на сервер / в воркер
    classifier/   движок шифров: parser, decoder, conditions (12 типов), dependencies, shortName,
                  structure, navigation, segments, edit (правка конфигурации и её проверка)
    rbac.ts       права по ресурсам / колонкам / строкам, ответственные за строки, замещение, просрочка
    routing.ts    маршрут заявки по группам справочника
    smartSearch.ts, search.ts   умный поиск (нормализация, токены, нечёткое совпадение) и три режима поиска
    integration.ts  фильтры выгрузки, сборка пакета, подписи
    csv.ts, attributes.ts, catalogSchema.ts, security/password.ts
  stores/       Pinia: auth, catalog, classifier, request, integration, notifications, ui
  composables/  useDynamicTable/Form, useClassifier(Session), useIntake, useElementEditor, useAdmin,
                useCatalogConfig, useClassifierConfig, useWorkflowEditor, useAuth (меню)
  components/   ui/ (обёртки), dynamic/ (таблица и форма по схеме), classifier/, catalog/, admin/,
                integration/, common/ (заявка, поиск, история, редактор листа)
  layouts/      AppShell (боковое меню, шапка, уведомления)
  views/        тонкие страницы, по одной на модуль
  router/       lazy-маршруты; guard: вход + право из meta.permission
  mocks/        «сервер» на MSW: handlers/, data/, workflow.ts, integration.ts, audit.ts, persist.ts
```

**Правила кода:** никакого `any`; бизнес-логика — в `lib/`, `stores/`, `composables/`, не в шаблонах;
RBAC — в слое данных (store отдаёт уже отфильтрованные колонки и строки); URL — только в `endpoints.ts`;
моки и клиент используют одни и те же типы и функции из `lib/` — правила не расходятся.

## Ключевые механизмы

### Права (RBAC) — `lib/rbac.ts`

- Роль — шаблон прав; **назначение** — роль + область (`global` / `catalog:<id>` / `classifier:<id>`).
- `effectiveRoles` сужает права роли до области назначения; дальше `can`, `canAccessColumn`,
  `canAccessRow`, `filterColumns`, `filterRows`.
- Ответственный за строку заявки: проверка — область справочника, шифрование — область классификатора строки.
- **Замещение:** `delegationsOf` (кого пользователь замещает сейчас), `actingAssignments` (свои + замещаемых,
  без роли администратора), `onBehalfOf` (за кого решение), `responsibleUsers` (кому адресовать строку
  с учётом отпусков).
- Клиентские проверки — удобство интерфейса. **Сервер обязан проверять всё сам** (моки так и делают).

### Обходные листы — `mocks/workflow.ts` (эталон серверной логики)

- Шаблон ищется сначала для объекта, затем общий (`*`); строки фильтруются по группе позиции (`lib/routing.ts`),
  получают срок `dueAt = создание + dueHours`.
- **Отложенное применение:** справочник меняется только после прохождения всех строк; пустой лист —
  изменения сразу.
- Уведомления — ответственным активных строк (для «по порядку» — только первой); за отсутствующих — заместителям.
- Шифр в строке проверяется движком и на дубликаты (записи классификатора, шифры элементов,
  незакрытые заявки).

### Движок классификатора — `lib/classifier`

- Дерево `root → catalog → facet-ноды`; переход — в первого ребёнка, чьё условие выполнено на значении
  фасета ноды, иначе — `defaultChildIndex`.
- Длина фасета: `fixed`, `delimiter`, `remainder`. Чтение `rtl` (по ТЗ) или `ltr`.
- `parseCode` (строка → значения) и `analyzeValues` (значения → шифр) используют **один** обход
  `walkStructure`; `parse(build(x)) = x` покрыто тестами.
- Зависимости меняют `label / options / visible` только у последующих фасетов.
- Расшифровка — первая подходящая `DecodeStructure`, иначе все фасеты через пробел.

### Поиск — `lib/smartSearch.ts`

Нормализация (латиница/кириллица-двойники, «ё», «6,5→6.5», «12 х 50→12x50», «Ø»), токены с размерами,
точное / префиксное / нечёткое совпадение, разбор «Атрибут: значение», строгий режим для таблиц,
кеш токенов. ~50 мс на запрос по 1 500 позициям.

### Интеграции

`lib/integration.ts` — что и в каком виде уходит в систему; `mocks/integration.ts` — выгрузка по событию,
импорт (через заявку или сразу, без дублей по внешнему ID), пакетный запуск, расписание.

### Журнал и сохранение демо

`mocks/audit.ts` пишет каждое изменяющее действие. `mocks/persist.ts` сохраняет «базу» моков
в `localStorage` после изменяющих запросов; версия привязана к хэшу исходных данных.

## Тесты

| Набор | Что покрывает |
|---|---|
| `src/lib/**/__tests__` | движок классификатора, RBAC, поиск, пароли, интеграции, CSV |
| `src/stores/__tests__` | stores |
| `src/mocks/__tests__` | данные валидны и согласованы с движком, обходные листы, маршрут, замещение, интеграции |
| `e2e/*.spec.ts` | пополнение «пользователь → модератор → справочник», корректировка, мастер шифра, присвоение шифра, настройка ролей/справочника/классификатора, интеграции, замещение и журнал, кладовщик без цен и CSV |

Команды: `npm run ci` (lint → type-check → unit → build), `npm run test:e2e`.
Git-хуки: `pre-commit` — lint-staged + type-check, `pre-push` — `npm run ci`.
CI: `.github/workflows/ci.yml` (с e2e), `.gitlab-ci.yml` (для GitLab в контуре).

## Как расширять

- **Справочник / классификатор / фасет / правило / обходной лист / поток обмена** — данными, через интерфейс.
- **Новый тип атрибута** — `AttributeType` → UI-группа в `lib/attributes.ts` → ячейка и поле в
  `components/dynamic/cells|fields/index.ts`.
- **Новый тип условия** — `ConditionType` + `ConditionValueMap` в `types/classifier.ts`; компилятор
  (exhaustive `never`) покажет места в `conditions.ts`.
- **Новый ресурс прав** — `ResourceType` в `types/auth.ts` → строка в матрице `RoleDialog.vue` и подпись в `AdminView.vue`.
- **Новая страница** — view + маршрут с `meta.permission` + пункт в `MENU` (`composables/useAuth.ts`).

## Допущения

- Приложение №1 к ТЗ (типы истории) недоступно: принято `attribute`, `state`, `version` (`EditHistory`).
- «Символ начала фасета (?)» из ТЗ не реализован; точка расширения — источник значений в `walkStructure`.
- Хэширование паролей в моках выполняется в браузере (WebCrypto) только для имитации сервера.
