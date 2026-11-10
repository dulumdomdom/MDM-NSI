// Шаблоны обходных листов, заявки (в работе, утверждённые, отклонённые), уведомления
// и утверждённые записи классификаторов.

import type { AppNotification, AttributeValue, AuditEntry, ClassifierEntry, Request, RequestStep, WorkflowConfig } from '@/types'

const pcs = { catalogId: 'cat-units', elementId: 'u-pcs', display: 'шт' }

/**
 * Пополнение номенклатуры: маршрут зависит от группы позиции (groupIds) — инструмент шифрует технолог,
 * материалы — металловед, крепёж и детали собственного изготовления — бюро стандартизации.
 * У каждой строки — нормативный срок (dueHours); модератор справочника проверяет наименование и свойства.
 * Корректировки (element-edit) без перешифровки шаблона не имеют — применяются сразу;
 * с перешифровкой строки берутся из строк шифрования шаблона пополнения.
 */
export const workflows: WorkflowConfig[] = [
  {
    id: 'wf-element-nomenclature',
    targetType: 'catalog-element',
    targetId: 'cat-nomenclature',
    sequential: false,
    steps: [
      { id: 'st-enc-tool', order: 1, kind: 'encode', name: 'Шифрование по классификатору инструмента', roleId: 'role-moderator', classifierId: 'cls-tool', optional: true, attributeIds: ['name'], groupIds: ['g-tools'], dueHours: 16 },
      { id: 'st-enc-material', order: 2, kind: 'encode', name: 'Шифрование по классификатору материалов', roleId: 'role-moderator', classifierId: 'cls-material', optional: true, attributeIds: ['name'], groupIds: ['g-materials'], dueHours: 16 },
      { id: 'st-enc-fastener', order: 3, kind: 'encode', name: 'Условное обозначение крепежа по ГОСТ', roleId: 'role-moderator', classifierId: 'cls-fastener', attributeIds: ['name', 'standard'], groupIds: ['g-fasteners'], dueHours: 16 },
      { id: 'st-enc-eskd', order: 4, kind: 'encode', name: 'Присвоение обозначения ЕСКД', roleId: 'role-moderator', classifierId: 'cls-eskd', attributeIds: ['article'], groupIds: ['g-own'], dueHours: 24 },
      { id: 'st-review', order: 5, kind: 'review', name: 'Проверка наименования и свойств', roleId: 'role-moderator', attributeIds: ['name', 'unit', 'article', 'standard'], dueHours: 8 },
    ],
  },
  {
    id: 'wf-element-counterparties',
    targetType: 'catalog-element',
    targetId: 'cat-counterparties',
    sequential: false,
    steps: [{ id: 'st-review', order: 1, kind: 'review', name: 'Проверка поставщика (ИНН, КПП, адрес по ЕГРЮЛ)', roleId: 'role-moderator', attributeIds: ['inn', 'kpp', 'address'], dueHours: 24 }],
  },
  {
    // Спецификация: сначала нормоконтроль по ЕСКД, затем бюро стандартизации — строго по очереди
    id: 'wf-element-specifications',
    targetType: 'catalog-element',
    targetId: 'cat-specifications',
    sequential: true,
    steps: [
      { id: 'st-normcontrol', order: 1, kind: 'review', name: 'Нормоконтроль (ГОСТ 2.111)', roleId: 'role-normcontrol', attributeIds: ['designation', 'name', 'litera'], dueHours: 24 },
      { id: 'st-review', order: 2, kind: 'review', name: 'Согласование бюро стандартизации', roleId: 'role-moderator', attributeIds: ['designation', 'product'], dueHours: 16 },
    ],
  },
  {
    id: 'wf-element-default',
    targetType: 'catalog-element',
    targetId: '*',
    sequential: false,
    steps: [{ id: 'st-review', order: 1, kind: 'review', name: 'Проверка модератором справочника', roleId: 'role-moderator', attributeIds: [] }],
  },
  {
    id: 'wf-cls-default',
    targetType: 'classifier-entry',
    targetId: '*',
    sequential: false,
    steps: [{ id: 'st-review', order: 1, kind: 'review', name: 'Проверка модератором классификатора', roleId: 'role-moderator', attributeIds: ['code', 'decoded'] }],
  },
]

export const classifierEntries: ClassifierEntry[] = [
  {
    id: 'e-1',
    classifierId: 'cls-tool',
    catalogId: 'cat-cutting',
    code: 'ГОСТ109020H8C-57-6.5AH1SV',
    decoded: 'Сверло спиральное Ø 6.5 мм, L 57 мм, твёрдый сплав TiAlN Хвостовик цилиндрический ГОСТ10902',
    shortName: 'Сверло спиральное Ø6.5×57 H',
  },
  {
    id: 'e-2',
    classifierId: 'cls-material',
    catalogId: 'cat-materials',
    code: '0201Сталь45',
    decoded: 'Сталь качественная конструкционная (ГОСТ 1050-2013) 01 Сталь45',
    shortName: 'Сталь45',
  },
]

/* --------------------------------- заявки -------------------------------- */

type Step = RequestStep
const encTool = (s: Partial<Step>): Step => ({
  id: 'st-enc-tool',
  order: 1,
  kind: 'encode',
  name: 'Шифрование по классификатору инструмента',
  roleId: 'role-moderator',
  classifierId: 'cls-tool',
  optional: true,
  attributeIds: ['name'],
  status: 'pending',
  ...s,
})
const encMaterial = (s: Partial<Step>): Step => ({
  id: 'st-enc-material',
  order: 2,
  kind: 'encode',
  name: 'Шифрование по классификатору материалов',
  roleId: 'role-moderator',
  classifierId: 'cls-material',
  optional: true,
  attributeIds: ['name'],
  status: 'pending',
  ...s,
})
const review = (s: Partial<Step>): Step => ({
  id: 'st-review',
  order: 3,
  kind: 'review',
  name: 'Проверка наименования и свойств',
  roleId: 'role-moderator',
  attributeIds: ['name', 'unit', 'article', 'standard'],
  status: 'pending',
  ...s,
})

const nomenclature = (a: Record<string, AttributeValue>): Record<string, AttributeValue> => ({
  article: '',
  name: '',
  unit: pcs,
  standard: null,
  price: null,
  minBatch: null,
  registeredAt: null,
  drawing: null,
  ...a,
})

export const requests: Request[] = [
  {
    id: 'req-1',
    title: 'Пополнение: Фреза концевая Ø10×22 твёрдый сплав',
    targetType: 'catalog-element',
    targetId: 'cat-nomenclature',
    payload: {
      name: 'Фреза концевая Ø10×22 твёрдый сплав',
      query: 'фреза концевая 10х22 тв. сплав, шт',
      attributes: nomenclature({ name: 'Фреза концевая Ø10×22 твёрдый сплав', article: 'FR-10-22-H', minBatch: 5 }),
      parentId: 'g-cutting',
    },
    status: 'in_review',
    sequential: false,
    createdBy: 'u-user',
    createdAt: '2026-11-02T08:15:00Z',
    steps: [encTool({ dueAt: '2026-11-03T00:15:00Z' }), review({ order: 2, dueAt: '2026-11-02T16:15:00Z' })],
  },
  {
    id: 'req-2',
    title: 'Пополнение: Подшипник шариковый радиальный 306 (6306)',
    targetType: 'catalog-element',
    targetId: 'cat-nomenclature',
    payload: {
      name: 'Подшипник шариковый радиальный 306 (6306)',
      query: 'подшипник 306 гост 8338-75',
      attributes: nomenclature({ name: 'Подшипник шариковый радиальный 306 (6306)', article: 'P-306', standard: 'ГОСТ 8338-75', price: 390, minBatch: 10 }),
      parentId: 'g-bearings',
    },
    status: 'approved',
    sequential: false,
    createdBy: 'u-user',
    createdAt: '2026-09-15T07:40:00Z',
    closedAt: '2026-09-15T11:30:00Z',
    steps: [
      encTool({ status: 'skipped', decidedBy: 'u-petrov', decidedAt: '2026-09-15T10:12:00Z', comment: 'Покупное изделие, не инструмент' }),
      encMaterial({ status: 'skipped', decidedBy: 'u-kuznetsova', decidedAt: '2026-09-15T11:30:00Z', comment: 'Не материал' }),
      review({ status: 'approved', decidedBy: 'u-petrov', decidedAt: '2026-09-15T10:14:00Z' }),
    ],
  },
  {
    id: 'req-3',
    title: 'Пополнение: Болт М12х50 8.8 оцинк.',
    targetType: 'catalog-element',
    targetId: 'cat-nomenclature',
    payload: {
      name: 'Болт М12х50 8.8 оцинк.',
      query: 'болт м12х50 8.8 оцинк',
      attributes: nomenclature({ name: 'Болт М12х50 8.8 оцинк.', article: 'BOLT-M12-50', minBatch: 200 }),
      parentId: 'g-fasteners',
    },
    status: 'rejected',
    sequential: false,
    createdBy: 'u-user',
    createdAt: '2026-10-20T12:05:00Z',
    closedAt: '2026-10-20T13:02:00Z',
    steps: [
      encTool({ status: 'skipped', decidedBy: 'u-petrov', decidedAt: '2026-10-20T13:00:00Z', comment: 'Крепёж — не инструмент' }),
      encMaterial({}),
      review({
        status: 'rejected',
        decidedBy: 'u-petrov',
        decidedAt: '2026-10-20T13:02:00Z',
        comment: 'Дублирует позицию BT-12-50-88 «Болт М12-6g×50.88.016» ГОСТ 7798-70 — используйте её',
      }),
    ],
  },
  {
    id: 'req-4',
    title: 'Корректировка: Сверло спиральное Ø8×117 Р6М5 ц/х',
    targetType: 'element-edit',
    targetId: 'cat-nomenclature',
    payload: {
      name: 'Сверло спиральное Ø8×117 Р6М5 ц/х',
      elementId: 'n-0004',
      attributes: { name: 'Сверло спиральное Ø8×117 Р6М5К5 ц/х', article: 'SV-8-P6M5K5' },
      recode: ['cls-tool'],
    },
    status: 'in_review',
    sequential: false,
    createdBy: 'u-user',
    createdAt: '2026-11-03T14:20:00Z',
    steps: [
      encTool({ name: 'Перешифровка по классификатору инструмента', optional: false, dueAt: '2026-11-04T06:20:00Z' }),
    ],
  },
  {
    id: 'req-5',
    title: 'Пополнение: ПАО «Новолипецкий металлургический комбинат»',
    targetType: 'catalog-element',
    targetId: 'cat-counterparties',
    payload: {
      name: 'ПАО «Новолипецкий металлургический комбинат»',
      attributes: {
        name: 'ПАО «Новолипецкий металлургический комбинат»',
        inn: '4823006703',
        kpp: '482301001',
        category: 'Листовой прокат',
        address: { postcode: 398040, city: 'Липецк', street: 'пл. Металлургов', house: '2' },
        contractDate: null,
        contractScan: null,
      },
    },
    status: 'in_review',
    sequential: false,
    createdBy: 'u-ivanov',
    createdAt: '2026-11-05T07:30:00Z',
    steps: [
      {
        id: 'st-review',
        order: 1,
        kind: 'review',
        name: 'Проверка поставщика (ИНН, КПП, адрес по ЕГРЮЛ)',
        roleId: 'role-moderator',
        attributeIds: ['inn', 'kpp', 'address'],
        status: 'pending',
        dueAt: '2026-11-06T07:30:00Z',
      },
    ],
  },
  {
    id: 'req-6',
    title: 'Пополнение: УЗПМ.303215.002-01',
    targetType: 'catalog-element',
    targetId: 'cat-specifications',
    payload: {
      name: 'УЗПМ.303215.002-01',
      attributes: {
        designation: 'УЗПМ.303215.002-01',
        name: 'Привод конвейера ленточного, исполнение 01 (L = 6 м)',
        product: null,
        litera: 'О',
        developer: 'Сидорова А. С.',
        approvedAt: null,
        document: { fileName: 'УЗПМ.303215.002-01.pdf', size: 204811, mimeType: 'application/pdf' },
      },
    },
    status: 'in_review',
    sequential: true,
    createdBy: 'u-user',
    createdAt: '2026-11-04T10:00:00Z',
    steps: [
      { id: 'st-normcontrol', order: 1, kind: 'review', name: 'Нормоконтроль (ГОСТ 2.111)', roleId: 'role-normcontrol', attributeIds: ['designation', 'name', 'litera'], status: 'pending', dueAt: '2026-11-05T10:00:00Z' },
      { id: 'st-review', order: 2, kind: 'review', name: 'Согласование бюро стандартизации', roleId: 'role-moderator', attributeIds: ['designation', 'product'], status: 'pending', dueAt: '2026-11-05T02:00:00Z' },
    ],
  },
  {
    id: 'req-7',
    title: 'Пополнение: Гайка М20-6Н.8.016',
    targetType: 'catalog-element',
    targetId: 'cat-nomenclature',
    payload: {
      name: 'Гайка М20-6Н.8.016',
      query: 'гайка м20 кл 8 оцинк',
      attributes: nomenclature({ name: 'Гайка М20-6Н.8.016', article: 'GK-20-8', standard: 'ГОСТ 5915-70', minBatch: 100 }),
      parentId: 'g-fasteners',
    },
    status: 'in_review',
    sequential: false,
    createdBy: 'u-nikitina',
    createdAt: '2026-11-04T15:00:00Z',
    steps: [
      {
        id: 'st-enc-fastener',
        order: 1,
        kind: 'encode',
        name: 'Условное обозначение крепежа по ГОСТ',
        roleId: 'role-moderator',
        classifierId: 'cls-fastener',
        attributeIds: ['name', 'standard'],
        status: 'pending',
        dueAt: '2026-11-05T07:00:00Z',
      },
      review({ order: 2, dueAt: '2026-11-04T23:00:00Z' }),
    ],
  },
]

export const notifications: AppNotification[] = [
  {
    id: 'nt-1',
    userId: 'u-petrov',
    title: 'Новая заявка на пополнение',
    text: 'Фреза концевая Ø10×22 твёрдый сплав — зашифровать по классификатору инструмента',
    requestId: 'req-1',
    createdAt: '2026-11-02T08:15:00Z',
    read: false,
  },
  {
    id: 'nt-2',
    userId: 'u-petrov',
    title: 'Новая заявка на пополнение',
    text: 'Фреза концевая Ø10×22 твёрдый сплав — проверка наименования и свойств',
    requestId: 'req-1',
    createdAt: '2026-11-02T08:15:00Z',
    read: false,
  },
  {
    id: 'nt-3',
    userId: 'u-petrov',
    title: 'Корректировка с перешифровкой',
    text: 'Сверло спиральное Ø8×117 Р6М5 ц/х — перешифровать по классификатору инструмента',
    requestId: 'req-4',
    createdAt: '2026-11-03T14:20:00Z',
    read: false,
  },
  {
    id: 'nt-4',
    userId: 'u-belova',
    title: 'Новый поставщик на проверку',
    text: 'ПАО «Новолипецкий металлургический комбинат», ИНН 4823006703',
    requestId: 'req-5',
    createdAt: '2026-11-03T09:10:00Z',
    read: false,
  },
  {
    id: 'nt-7',
    userId: 'u-zakharova',
    title: 'Новая заявка',
    text: 'УЗПМ.303215.002-01 — нормоконтроль (гост 2.111)',
    requestId: 'req-6',
    createdAt: '2026-11-04T10:00:00Z',
    read: false,
  },
  {
    id: 'nt-8',
    userId: 'u-zakharova',
    title: 'Новая заявка (замещение: Орлов Дмитрий Николаевич)',
    text: 'Гайка М20-6Н.8.016 — условное обозначение крепежа по гост',
    requestId: 'req-7',
    createdAt: '2026-11-04T15:00:00Z',
    read: false,
  },
  {
    id: 'nt-9',
    userId: 'u-petrov',
    title: 'Новая заявка',
    text: 'Гайка М20-6Н.8.016 — проверка наименования и свойств',
    requestId: 'req-7',
    createdAt: '2026-11-04T15:00:00Z',
    read: false,
  },
  {
    id: 'nt-5',
    userId: 'u-user',
    title: 'Заявка отклонена',
    text: 'Болт М12х50 8.8 оцинк. — дублирует существующую позицию',
    requestId: 'req-3',
    createdAt: '2026-10-20T13:02:00Z',
    read: true,
  },
  {
    id: 'nt-6',
    userId: 'u-user',
    title: 'Заявка обработана',
    text: 'Подшипник шариковый радиальный 306 (6306) добавлен в справочник',
    requestId: 'req-2',
    createdAt: '2026-09-15T11:30:00Z',
    read: true,
  },
]

/** Журнал действий: стартовые записи за последние дни */
export const auditLog: AuditEntry[] = [
  { id: 'au-12', at: '2026-11-05T07:30:00Z', userId: 'u-ivanov', action: 'Создана заявка', objectType: 'request', objectId: 'req-5', objectName: 'Пополнение: ПАО «Новолипецкий металлургический комбинат»' },
  { id: 'au-11', at: '2026-11-05T07:28:00Z', userId: 'u-ivanov', action: 'Вход в систему', objectType: 'session', details: 'LDAP' },
  { id: 'au-10', at: '2026-11-04T15:00:00Z', userId: 'u-nikitina', action: 'Создана заявка', objectType: 'request', objectId: 'req-7', objectName: 'Пополнение: Гайка М20-6Н.8.016' },
  { id: 'au-9', at: '2026-11-04T10:00:00Z', userId: 'u-user', action: 'Создана заявка', objectType: 'request', objectId: 'req-6', objectName: 'Пополнение: УЗПМ.303215.002-01' },
  { id: 'au-8', at: '2026-11-04T08:00:00Z', userId: 'u-admin', action: 'Запуск потока обмена', objectType: 'integration', objectId: 'fl-imbase-standard', objectName: 'Стандартные изделия ← Imbase', details: 'Новых записей нет' },
  { id: 'au-7', at: '2026-11-03T14:20:00Z', userId: 'u-user', action: 'Создана заявка', objectType: 'request', objectId: 'req-4', objectName: 'Корректировка: Сверло спиральное Ø8×117 Р6М5 ц/х' },
  { id: 'au-6', at: '2026-11-02T16:40:00Z', userId: 'u-orlov', action: 'Назначен заместитель', objectType: 'user', objectId: 'u-orlov', objectName: 'Орлов Дмитрий Николаевич', details: 'Захарова Ирина Олеговна до 2026-11-30' },
  { id: 'au-5', at: '2026-11-02T08:15:00Z', userId: 'u-user', action: 'Создана заявка', objectType: 'request', objectId: 'req-1', objectName: 'Пополнение: Фреза концевая Ø10×22 твёрдый сплав' },
  { id: 'au-4', at: '2026-10-28T11:05:00Z', userId: 'u-volkova', action: 'Создан элемент', objectType: 'element', objectId: 'inv-6', objectName: '412' },
  { id: 'au-3', at: '2026-10-20T13:02:00Z', userId: 'u-petrov', action: 'Строка «Проверка наименования и свойств» отклонена', objectType: 'request', objectId: 'req-3', objectName: 'Пополнение: Болт М12х50 8.8 оцинк.', details: 'Дублирует позицию BT-12-50-88' },
  { id: 'au-2', at: '2026-10-15T09:00:00Z', userId: 'u-admin', action: 'Изменён пользователь', objectType: 'user', objectId: 'u-petrov', objectName: 'Петров Пётр Петрович', details: 'назначений: 2, статус: active' },
  { id: 'au-1', at: '2026-09-15T10:14:00Z', userId: 'u-petrov', action: 'Строка «Проверка наименования и свойств» согласована', objectType: 'request', objectId: 'req-2', objectName: 'Пополнение: Подшипник шариковый радиальный 306 (6306)' },
]
