// Справочники машиностроительного завода (АО «УЗПМ» — условное предприятие):
//  - cat-units          — единицы измерения по ОКЕИ;
//  - cat-nomenclature   — иерархическая номенклатура ТМЦ: инструмент, прокат, ГСМ, крепёж и подшипники по ГОСТ,
//                         детали и сборочные единицы собственного изготовления; привязано 5 классификаторов;
//  - cat-counterparties — поставщики (реквизиты из открытых источников) с составным атрибутом «Адрес»;
//  - cat-specifications — спецификации ЕСКД (ГОСТ 2.106) со ссылкой на изделие;
//  - cat-spec-lines     — строки спецификаций по графам формы 1: раздел, поз., обозначение, наименование, кол.;
//  - cat-invoices       — входящие счета-фактуры поставщиков.

import type { AttributeValue, Catalog, CatalogElement, CatalogState, ElementCode, ReferenceValue } from '@/types'
import { textOf } from '@/lib/attributes'
import { seedCode } from './classifiers'

const commonStates: CatalogState[] = [
  { id: 'draft', name: 'Черновик', color: 'secondary', initial: true },
  { id: 'active', name: 'Действует', color: 'success' },
  { id: 'blocked', name: 'Заблокирован', color: 'warn' },
  { id: 'archived', name: 'Архив', color: 'contrast' },
]

export const catalogs: Catalog[] = [
  {
    id: 'cat-units',
    name: 'Единицы измерения',
    description: 'ОКЕИ (ОК 015-94), используемые на предприятии',
    hierarchical: false,
    displayAttributeId: 'name',
    classifierBindings: [],
    states: [
      { id: 'active', name: 'Действует', color: 'success', initial: true },
      { id: 'archived', name: 'Архив', color: 'contrast' },
    ],
    attributes: [
      { id: 'code', name: 'Код ОКЕИ', type: 'string', required: true, maxLength: 3, pattern: '^\\d{3}$', width: 110 },
      { id: 'name', name: 'Наименование', type: 'string', required: true, width: 220 },
      { id: 'symbol', name: 'Обозначение', type: 'string', required: true, width: 120 },
      { id: 'factor', name: 'Коэффициент к базовой', type: 'float', required: false, min: 0, width: 180 },
    ],
  },
  {
    id: 'cat-nomenclature',
    name: 'Номенклатура',
    description: 'Материалы, покупные и стандартные изделия, инструмент, детали собственного изготовления',
    hierarchical: true,
    displayAttributeId: 'name',
    classifierBindings: [
      { classifierId: 'cls-tool', classifierCatalogId: 'cat-cutting', required: false, suggestName: true },
      { classifierId: 'cls-fastener', classifierCatalogId: 'cat-fasteners', required: false, suggestName: true },
      { classifierId: 'cls-material', classifierCatalogId: 'cat-materials', required: false },
      { classifierId: 'cls-okpd2', classifierCatalogId: 'cat-okpd2-c', required: false },
      { classifierId: 'cls-eskd', classifierCatalogId: 'cat-eskd-items', required: false },
    ],
    states: commonStates,
    attributes: [
      { id: 'article', name: 'Артикул / обозначение', type: 'string', required: true, maxLength: 20, width: 150 },
      { id: 'name', name: 'Наименование', type: 'string', required: true, width: 320 },
      {
        id: 'unit',
        name: 'Ед. изм.',
        type: 'reference',
        required: true,
        referenceCatalogId: 'cat-units',
        referenceDisplayAttributeId: 'symbol',
        width: 90,
      },
      { id: 'standard', name: 'Нормативный документ', type: 'string', required: false, width: 220 },
      { id: 'price', name: 'Цена, ₽', type: 'float', required: false, min: 0, width: 110 },
      { id: 'minBatch', name: 'Мин. партия', type: 'int', required: false, min: 1, width: 110 },
      { id: 'registeredAt', name: 'Дата регистрации', type: 'datetime', required: false, width: 160, listed: false },
      { id: 'drawing', name: 'Чертёж', type: 'blob', required: false, width: 160, listed: false },
    ],
  },
  {
    id: 'cat-counterparties',
    name: 'Контрагенты',
    description: 'Поставщики металлопроката и инструмента, давальцы',
    hierarchical: false,
    displayAttributeId: 'name',
    classifierBindings: [],
    states: commonStates,
    attributes: [
      { id: 'name', name: 'Наименование', type: 'string', required: true, width: 280 },
      { id: 'inn', name: 'ИНН', type: 'string', required: true, pattern: '^\\d{10}(\\d{2})?$', width: 130 },
      { id: 'kpp', name: 'КПП', type: 'string', required: false, pattern: '^\\d{9}$', width: 110 },
      { id: 'category', name: 'Что поставляет', type: 'string', required: false, width: 200 },
      {
        id: 'address',
        name: 'Юридический адрес',
        type: 'composite',
        required: true,
        width: 320,
        compositeFields: [
          { id: 'postcode', name: 'Индекс', type: 'int', required: false, min: 100000, max: 999999 },
          { id: 'city', name: 'Город', type: 'string', required: true },
          { id: 'street', name: 'Улица', type: 'string', required: true },
          { id: 'house', name: 'Дом', type: 'string', required: true },
        ],
      },
      { id: 'contractDate', name: 'Дата договора', type: 'datetime', required: false, width: 150 },
      { id: 'contractScan', name: 'Скан договора', type: 'blob', required: false, width: 160, listed: false },
    ],
  },
  {
    id: 'cat-specifications',
    name: 'Спецификации',
    description: 'Спецификации сборочных единиц по ГОСТ 2.106 (ЕСКД)',
    hierarchical: false,
    displayAttributeId: 'designation',
    classifierBindings: [],
    states: [
      { id: 'draft', name: 'В разработке', color: 'secondary', initial: true },
      { id: 'active', name: 'Утверждена', color: 'success' },
      { id: 'archived', name: 'Аннулирована', color: 'contrast' },
    ],
    attributes: [
      { id: 'designation', name: 'Обозначение', type: 'string', required: true, maxLength: 30, width: 190 },
      { id: 'name', name: 'Наименование', type: 'string', required: true, width: 300 },
      {
        id: 'product',
        name: 'Изделие в номенклатуре',
        type: 'reference',
        required: false,
        referenceCatalogId: 'cat-nomenclature',
        referenceDisplayAttributeId: 'name',
        width: 240,
      },
      { id: 'litera', name: 'Литера', type: 'string', required: false, maxLength: 3, width: 90 },
      { id: 'developer', name: 'Разработал', type: 'string', required: false, width: 160 },
      { id: 'approvedAt', name: 'Утверждена', type: 'datetime', required: false, width: 150 },
      { id: 'document', name: 'Документ', type: 'blob', required: false, width: 160, listed: false },
    ],
  },
  {
    id: 'cat-spec-lines',
    name: 'Состав спецификаций',
    description: 'Строки спецификаций: графы формы 1 ГОСТ 2.106',
    hierarchical: false,
    displayAttributeId: 'name',
    classifierBindings: [],
    states: [{ id: 'active', name: 'Действует', color: 'success', initial: true }],
    attributes: [
      {
        id: 'spec',
        name: 'Спецификация',
        type: 'reference',
        required: true,
        referenceCatalogId: 'cat-specifications',
        referenceDisplayAttributeId: 'designation',
        width: 180,
      },
      { id: 'section', name: 'Раздел', type: 'string', required: true, width: 170 },
      { id: 'pos', name: 'Поз.', type: 'int', required: false, min: 1, width: 70 },
      { id: 'designation', name: 'Обозначение', type: 'string', required: false, width: 180 },
      { id: 'name', name: 'Наименование', type: 'string', required: true, width: 320 },
      { id: 'qty', name: 'Кол.', type: 'float', required: false, min: 0, width: 80 },
      { id: 'note', name: 'Примечание', type: 'string', required: false, width: 180 },
      {
        id: 'item',
        name: 'Позиция номенклатуры',
        type: 'reference',
        required: false,
        referenceCatalogId: 'cat-nomenclature',
        referenceDisplayAttributeId: 'article',
        width: 160,
      },
    ],
  },
  {
    id: 'cat-invoices',
    name: 'Счета-фактуры',
    description: 'Входящие счета-фактуры поставщиков (форма по постановлению Правительства РФ № 1137)',
    hierarchical: false,
    displayAttributeId: 'number',
    classifierBindings: [],
    states: [
      { id: 'received', name: 'Получен', color: 'info', initial: true },
      { id: 'posted', name: 'Проведён', color: 'success' },
      { id: 'paid', name: 'Оплачен', color: 'contrast' },
      { id: 'cancelled', name: 'Аннулирован', color: 'danger' },
    ],
    attributes: [
      { id: 'number', name: 'Номер', type: 'string', required: true, width: 120 },
      { id: 'date', name: 'Дата', type: 'datetime', required: true, width: 140 },
      {
        id: 'seller',
        name: 'Продавец',
        type: 'reference',
        required: true,
        referenceCatalogId: 'cat-counterparties',
        referenceDisplayAttributeId: 'name',
        width: 260,
      },
      { id: 'contract', name: 'Договор', type: 'string', required: false, width: 260 },
      { id: 'shipment', name: 'Документ об отгрузке', type: 'string', required: false, width: 200 },
      { id: 'amountNet', name: 'Без НДС, ₽', type: 'float', required: true, min: 0, width: 140 },
      { id: 'vatRate', name: 'НДС, %', type: 'int', required: true, min: 0, max: 22, width: 90 },
      { id: 'vat', name: 'Сумма НДС, ₽', type: 'float', required: true, min: 0, width: 140 },
      { id: 'total', name: 'Всего, ₽', type: 'float', required: true, min: 0, width: 150 },
      { id: 'scan', name: 'Скан', type: 'blob', required: false, width: 160, listed: false },
    ],
  },
]

/* ----------------------------- Единицы ----------------------------- */

const units: [string, string, string, string, number][] = [
  ['u-pcs', '796', 'Штука', 'шт', 1],
  ['u-kg', '166', 'Килограмм', 'кг', 1],
  ['u-t', '168', 'Тонна', 'т', 1000],
  ['u-g', '163', 'Грамм', 'г', 0.001],
  ['u-m', '006', 'Метр', 'м', 1],
  ['u-mm', '003', 'Миллиметр', 'мм', 0.001],
  ['u-m2', '055', 'Квадратный метр', 'м2', 1],
  ['u-l', '112', 'Литр', 'л', 1],
  ['u-set', '839', 'Комплект', 'компл', 1],
  ['u-kit', '704', 'Набор', 'набор', 1],
  ['u-pack', '778', 'Упаковка', 'упак', 1],
]

const unitElements: CatalogElement[] = units.map(([id, code, name, symbol, factor]) => ({
  id,
  catalogId: 'cat-units',
  state: 'active',
  attributes: { code, name, symbol, factor },
  history: [],
}))

const unitRef = (id: string): ReferenceValue => {
  const u = units.find((x) => x[0] === id)
  return { catalogId: 'cat-units', elementId: id, display: u?.[3] ?? id }
}

/* ---------------------------- Номенклатура --------------------------- */

const groups: { id: string; name: string; parentId?: string }[] = [
  { id: 'g-tools', name: 'Инструмент' },
  { id: 'g-cutting', name: 'Режущий инструмент', parentId: 'g-tools' },
  { id: 'g-measuring', name: 'Измерительный инструмент', parentId: 'g-tools' },
  { id: 'g-materials', name: 'Материалы' },
  { id: 'g-metal', name: 'Металлопрокат', parentId: 'g-materials' },
  { id: 'g-lubricants', name: 'Смазочные материалы', parentId: 'g-materials' },
  { id: 'g-standard', name: 'Стандартные изделия' },
  { id: 'g-fasteners', name: 'Крепёж', parentId: 'g-standard' },
  { id: 'g-bearings', name: 'Подшипники', parentId: 'g-standard' },
  { id: 'g-own', name: 'Детали и сборочные единицы собственного изготовления' },
]

const groupElements: CatalogElement[] = groups.map((g) => ({
  id: g.id,
  catalogId: 'cat-nomenclature',
  state: 'active',
  isGroup: true,
  ...(g.parentId ? { parentId: g.parentId } : {}),
  attributes: { article: '', name: g.name, unit: null, standard: null, price: null, minBatch: null, registeredAt: null, drawing: null },
  history: [],
}))

const handmade: CatalogElement[] = [
  {
    id: 'n-0001',
    catalogId: 'cat-nomenclature',
    parentId: 'g-cutting',
    state: 'active',
    attributes: {
      article: 'SV-6.5-H',
      name: 'Сверло спиральное Ø6.5×57 твёрдый сплав TiAlN',
      unit: unitRef('u-pcs'),
      standard: 'ГОСТ 10902-77',
      price: 1840.5,
      minBatch: 10,
      registeredAt: '2025-03-14T10:20:00Z',
      drawing: { fileName: 'SV-6.5-H.pdf', size: 482113, mimeType: 'application/pdf' },
    },
    history: [
      { type: 'version', id: 'h1', at: '2025-03-14T10:20:00Z', userId: 'u-user', version: 1, snapshot: { name: 'Сверло 6.5' } },
      {
        type: 'attribute',
        id: 'h2',
        at: '2025-04-02T12:00:00Z',
        userId: 'u-petrov',
        attributeId: 'name',
        oldValue: 'Сверло 6.5',
        newValue: 'Сверло спиральное Ø6.5×57 твёрдый сплав TiAlN',
      },
      { type: 'attribute', id: 'h3', at: '2025-04-02T12:00:00Z', userId: 'u-belova', attributeId: 'price', oldValue: 1700, newValue: 1840.5 },
      { type: 'state', id: 'h4', at: '2025-04-03T08:30:00Z', userId: 'u-petrov', fromState: 'draft', toState: 'active', comment: 'Согласовано' },
    ],
    externalRefs: [
      { systemId: '1c', externalId: 'НФ-00012871', status: 'synced', syncedAt: '2025-04-03T08:31:00Z' },
      { systemId: 'imbase', externalId: 'IMB.0042.1187', status: 'synced', syncedAt: '2025-04-03T08:31:00Z' },
      { systemId: 'asu', externalId: 'ASU-00004417', status: 'synced', syncedAt: '2025-04-03T08:32:00Z' },
    ],
    codes: [
      {
        classifierId: 'cls-tool',
        catalogId: 'cat-cutting',
        code: 'ГОСТ109020H8C-57-6.5AH1SV',
        decoded: 'Сверло спиральное Ø 6.5 мм, L 57 мм, твёрдый сплав TiAlN Хвостовик цилиндрический ГОСТ10902',
        shortName: 'Сверло спиральное Ø6.5×57 H',
        status: 'approved',
        assignedBy: 'u-petrov',
        assignedAt: '2025-04-03T08:30:00Z',
      },
      seedCode('cls-okpd2', 'cat-okpd2-c', '25.73.40', 'u-orlov', '2025-04-03T08:30:00Z'),
    ],
    matches: [
      { type: 'synonym', catalogId: 'cat-nomenclature', elementId: 'n-0002', display: 'Сверло ц/х 6,5 ТС' },
      { type: 'analog', catalogId: 'cat-nomenclature', elementId: 'n-0003', display: 'Сверло спиральное Ø6.5 Р6М5' },
      { type: 'supplier', catalogId: 'cat-counterparties', elementId: 'cp-1', display: 'АО «Сестрорецкий инструментальный завод»' },
      { type: 'certified', catalogId: 'cat-counterparties', elementId: 'cp-1', display: 'АО «СИЗ» — сертификат соответствия ГОСТ 10902-77' },
    ],
  },
  {
    id: 'n-0002',
    catalogId: 'cat-nomenclature',
    parentId: 'g-cutting',
    state: 'draft',
    attributes: {
      article: 'SV-6.5-TS',
      name: 'Сверло ц/х 6,5 ТС',
      unit: unitRef('u-pcs'),
      standard: null,
      price: 1790,
      minBatch: 5,
      registeredAt: '2025-05-01T09:00:00Z',
      drawing: null,
    },
    history: [],
    matches: [{ type: 'synonym', catalogId: 'cat-nomenclature', elementId: 'n-0001', display: 'Сверло спиральное Ø6.5×57 твёрдый сплав TiAlN' }],
  },
  {
    id: 'n-0003',
    catalogId: 'cat-nomenclature',
    parentId: 'g-cutting',
    state: 'archived',
    attributes: {
      article: 'SV-6.5-P',
      name: 'Сверло спиральное Ø6.5 Р6М5',
      unit: unitRef('u-pcs'),
      standard: 'ГОСТ 10902-77',
      price: 420,
      minBatch: 20,
      registeredAt: '2019-01-10T09:00:00Z',
      drawing: null,
    },
    history: [],
  },
]

/** [id, группа, состояние, артикул/обозначение, наименование, ед., НД, цена, мин. партия, шифры] */
type Row = [string, string, string, string, string, string, string | null, number | null, number | null, ElementCode[]?]

const AT = '2026-02-16T09:00:00Z'
const fx = (code: string) => seedCode('cls-fastener', 'cat-fasteners', code, 'u-orlov', AT)
const mat = (code: string) => seedCode('cls-material', 'cat-materials', code, 'u-kuznetsova', AT)
const okpd = (code: string) => seedCode('cls-okpd2', 'cat-okpd2-c', code, 'u-orlov', AT)
const eskd = (code: string) => seedCode('cls-eskd', 'cat-eskd-items', code, 'u-orlov', AT)

const rows: Row[] = [
  // Режущий инструмент
  ['n-0004', 'g-cutting', 'active', 'SV-8-P6M5', 'Сверло спиральное Ø8×117 Р6М5 ц/х', 'u-pcs', 'ГОСТ 10902-77', 118, 10, [okpd('25.73.40')]],
  ['n-0005', 'g-cutting', 'active', 'SV-10.2-KX', 'Сверло спиральное Ø10,2×168 Р6М5 к/х', 'u-pcs', 'ГОСТ 10903-77', 340, 10],
  ['n-0006', 'g-cutting', 'active', 'FR-16-P6M5K5', 'Фреза концевая Ø16 Р6М5К5 к/х', 'u-pcs', 'ГОСТ 17026-71', 1450, 2, [okpd('25.73.40')]],
  ['n-0007', 'g-cutting', 'active', 'MT-12-175', 'Метчик машинно-ручной М12×1,75 Р6М5', 'u-pcs', 'ГОСТ 3266-81', 310, 10],
  ['n-0008', 'g-cutting', 'active', 'PL-12-175', 'Плашка круглая М12×1,75 9ХС', 'u-pcs', 'ГОСТ 9740-71', 260, 5],
  ['n-0009', 'g-cutting', 'active', 'RZ-25-16-T5K10', 'Резец токарный проходной отогнутый 25×16 Т5К10', 'u-pcs', 'ГОСТ 18877-73', 520, 5],
  ['n-0010', 'g-cutting', 'active', 'RZ-20-12-OTR', 'Резец токарный отрезной 20×12 Т5К10', 'u-pcs', 'ГОСТ 18884-73', 480, 5],
  ['n-0011', 'g-cutting', 'active', 'CNMG-120408', 'Пластина сменная CNMG 120408 твёрдый сплав', 'u-pcs', 'ГОСТ 19042-80', 690, 10],
  // Измерительный инструмент
  ['n-0020', 'g-measuring', 'active', 'SHC-I-125-0.1', 'Штангенциркуль ШЦ-I-125-0,1', 'u-pcs', 'ГОСТ 166-89', 1650, 1, [okpd('26.51.33')]],
  ['n-0021', 'g-measuring', 'active', 'SHC-II-250-0.05', 'Штангенциркуль ШЦ-II-250-0,05', 'u-pcs', 'ГОСТ 166-89', 4900, 1, [okpd('26.51.33')]],
  ['n-0022', 'g-measuring', 'active', 'MK-25-1', 'Микрометр гладкий МК-25 0–25 мм кл. 1', 'u-pcs', 'ГОСТ 6507-90', 3200, 1],
  ['n-0023', 'g-measuring', 'active', 'ICH-10-1', 'Индикатор часового типа ИЧ-10 кл. 1', 'u-pcs', 'ГОСТ 577-68', 2100, 1],
  // Металлопрокат
  ['n-0030', 'g-metal', 'active', 'KR-20-45', 'Круг Ø20 сталь 45', 'u-kg', 'ГОСТ 2590-2006 / ГОСТ 1050-2013', 98, 100, [mat('0201Сталь45'), okpd('24.10.62')]],
  ['n-0031', 'g-metal', 'active', 'KR-30-40X', 'Круг Ø30 сталь 40Х', 'u-kg', 'ГОСТ 2590-2006 / ГОСТ 4543-2016', 118, 100, [mat('0301Сталь40Х'), okpd('24.10.62')]],
  ['n-0032', 'g-metal', 'active', 'LS-4-ST3SP', 'Лист г/к 4 мм Ст3сп', 'u-kg', 'ГОСТ 19903-2015 / ГОСТ 14637-89', 82, 500, [mat('0102Ст3сп'), okpd('24.10.31')]],
  ['n-0033', 'g-metal', 'active', 'LS-10-09G2S', 'Лист г/к 10 мм 09Г2С', 'u-kg', 'ГОСТ 19903-2015 / ГОСТ 19281-2014', 96, 500, [mat('0402Сталь09Г2С')]],
  ['n-0034', 'g-metal', 'active', 'TR-57-3.5-20', 'Труба бесшовная горячедеформированная 57×3,5 сталь 20', 'u-m', 'ГОСТ 8732-78 / ГОСТ 8731-74', 620, 6],
  ['n-0035', 'g-metal', 'active', 'UG-50-5', 'Уголок равнополочный 50×50×5 Ст3сп', 'u-kg', 'ГОСТ 8509-93', 89, 200, [okpd('24.10.71')]],
  ['n-0036', 'g-metal', 'active', 'SHV-10P', 'Швеллер 10П Ст3сп', 'u-kg', 'ГОСТ 8240-97', 92, 200, [okpd('24.10.71')]],
  ['n-0037', 'g-metal', 'blocked', 'SHG-24-45', 'Шестигранник 24 сталь 45', 'u-kg', 'ГОСТ 2879-2006', 120, 100],
  // Смазочные материалы
  ['n-0040', 'g-lubricants', 'active', 'LITOL-24', 'Смазка Литол-24', 'u-kg', 'ГОСТ 21150-2017', 390, 10, [okpd('20.59.41')]],
  ['n-0041', 'g-lubricants', 'active', 'I-20A', 'Масло индустриальное И-20А', 'u-l', 'ГОСТ 20799-88', 165, 20],
  ['n-0042', 'g-lubricants', 'active', 'CIATIM-201', 'Смазка ЦИАТИМ-201', 'u-kg', 'ГОСТ 6267-74', 520, 5],
  // Крепёж
  ['n-0050', 'g-fasteners', 'active', 'BT-8-30-58', 'Болт М8-6g×30.58.016', 'u-pcs', 'ГОСТ 7798-70', 4.2, 100, [fx('Б1-8-К-30-5.8-016-7798-70'), okpd('25.94.11')]],
  ['n-0051', 'g-fasteners', 'active', 'BT-10-40-58', 'Болт М10-6g×40.58.016', 'u-pcs', 'ГОСТ 7798-70', 7.5, 100, [fx('Б1-10-К-40-5.8-016-7798-70'), okpd('25.94.11')]],
  ['n-0052', 'g-fasteners', 'active', 'BT-12-50-88', 'Болт М12-6g×50.88.016', 'u-pcs', 'ГОСТ 7798-70', 14.9, 100, [fx('Б1-12-К-50-8.8-016-7798-70'), okpd('25.94.11')]],
  ['n-0053', 'g-fasteners', 'active', 'BT-16-60-88', 'Болт М16-6g×60.88.016', 'u-pcs', 'ГОСТ 7798-70', 32, 50],
  ['n-0054', 'g-fasteners', 'active', 'GK-10-5', 'Гайка М10-6Н.5.016', 'u-pcs', 'ГОСТ 5915-70', 2.1, 100, [fx('Г1-10-К-5-016-5915-70')]],
  ['n-0055', 'g-fasteners', 'active', 'GK-12-8', 'Гайка М12-6Н.8.016', 'u-pcs', 'ГОСТ 5915-70', 3.4, 100, [fx('Г1-12-К-8-016-5915-70')]],
  ['n-0056', 'g-fasteners', 'active', 'GK-16-5', 'Гайка М16-6Н.5.016', 'u-pcs', 'ГОСТ 5915-70', 7.8, 50],
  ['n-0057', 'g-fasteners', 'active', 'SH-12-01', 'Шайба 12.01.08кп.016', 'u-pcs', 'ГОСТ 11371-78', 1.1, 200, [fx('Ш12-01-016-11371-78')]],
  ['n-0058', 'g-fasteners', 'active', 'SHP-10-65G', 'Шайба 10 65Г 016', 'u-pcs', 'ГОСТ 6402-70', 0.9, 200, [fx('П10-65Г-016-6402-70')]],
  ['n-0059', 'g-fasteners', 'active', 'SHP-12-65G', 'Шайба 12 65Г 016', 'u-pcs', 'ГОСТ 6402-70', 1.2, 200],
  ['n-0060', 'g-fasteners', 'active', 'SHT-12-60', 'Шпилька М12-6g×60.58.016', 'u-pcs', 'ГОСТ 22032-76', 19, 50],
  // Подшипники
  ['n-0070', 'g-bearings', 'active', 'P-204', 'Подшипник шариковый радиальный 204 (6204)', 'u-pcs', 'ГОСТ 8338-75', 180, 10, [okpd('28.15.10')]],
  ['n-0071', 'g-bearings', 'active', 'P-205', 'Подшипник шариковый радиальный 205 (6205)', 'u-pcs', 'ГОСТ 8338-75', 210, 10, [okpd('28.15.10')]],
  ['n-0072', 'g-bearings', 'active', 'P-306', 'Подшипник шариковый радиальный 306 (6306)', 'u-pcs', 'ГОСТ 8338-75', 390, 10],
  ['n-0073', 'g-bearings', 'active', 'P-7206A', 'Подшипник роликовый конический 7206А', 'u-pcs', 'ГОСТ 27365-87', 640, 10, [okpd('28.15.10')]],
  // Собственное изготовление: обозначения по ГОСТ 2.201-80
  ['n-0080', 'g-own', 'active', 'УЗПМ.302112.001', 'Редуктор цилиндрический одноступенчатый', 'u-pcs', null, 48500, 1, [eskd('УЗПМ.302112.001')]],
  ['n-0081', 'g-own', 'active', 'УЗПМ.731122.001', 'Корпус редуктора', 'u-pcs', null, 12400, 1, [eskd('УЗПМ.731122.001')]],
  ['n-0082', 'g-own', 'active', 'УЗПМ.711141.002', 'Крышка подшипника глухая', 'u-pcs', null, 860, 2, [eskd('УЗПМ.711141.002')]],
  ['n-0083', 'g-own', 'active', 'УЗПМ.715231.003', 'Вал быстроходный', 'u-pcs', null, 3900, 1, [eskd('УЗПМ.715231.003')]],
  ['n-0084', 'g-own', 'active', 'УЗПМ.721341.004', 'Колесо зубчатое z=72, m=2', 'u-pcs', null, 5200, 1, [eskd('УЗПМ.721341.004')]],
  ['n-0085', 'g-own', 'active', 'УЗПМ.754152.005', 'Прокладка регулировочная', 'u-pcs', null, 45, 2, [eskd('УЗПМ.754152.005')]],
  ['n-0086', 'g-own', 'draft', 'УЗПМ.303215.002', 'Привод конвейера ленточного', 'u-pcs', null, null, 1, [eskd('УЗПМ.303215.002')]],
]

const rowElements: CatalogElement[] = rows.map(([id, parentId, state, article, name, unit, standard, price, minBatch, codes]) => ({
  id,
  catalogId: 'cat-nomenclature',
  parentId,
  state,
  attributes: { article, name, unit: unitRef(unit), standard, price, minBatch, registeredAt: AT, drawing: null },
  history: [],
  ...(codes ? { codes } : {}),
}))

/* ---------------------------- Контрагенты ---------------------------- */

// Реквизиты — из открытых источников (сверьте с ЕГРЮЛ перед использованием в учёте)
const counterparties: CatalogElement[] = [
  {
    id: 'cp-1',
    catalogId: 'cat-counterparties',
    state: 'active',
    attributes: {
      name: 'АО «Сестрорецкий инструментальный завод»',
      inn: '7827003057',
      kpp: null,
      category: 'Металлорежущий инструмент',
      address: { postcode: 197706, city: 'Сестрорецк', street: 'ул. Воскова', house: '2' },
      contractDate: '2025-12-10T00:00:00Z',
      contractScan: { fileName: 'dogovor-118-MTS-25.pdf', size: 1203344, mimeType: 'application/pdf' },
    },
    history: [],
  },
  {
    id: 'cp-2',
    catalogId: 'cat-counterparties',
    state: 'active',
    attributes: {
      name: 'ПАО «Магнитогорский металлургический комбинат»',
      inn: '7414003633',
      kpp: null,
      category: 'Сортовой и листовой прокат',
      address: { postcode: 455000, city: 'Магнитогорск', street: 'ул. Кирова', house: '93' },
      contractDate: '2025-12-18T00:00:00Z',
      contractScan: null,
    },
    history: [],
  },
  {
    id: 'cp-4',
    catalogId: 'cat-counterparties',
    state: 'active',
    attributes: {
      name: 'ПАО «Северсталь»',
      inn: '3528000597',
      kpp: '352801001',
      category: 'Листовой прокат, трубы',
      address: { postcode: 162608, city: 'Череповец', street: 'ул. Мира', house: '30' },
      contractDate: '2026-01-20T00:00:00Z',
      contractScan: null,
    },
    history: [],
  },
  {
    id: 'cp-3',
    catalogId: 'cat-counterparties',
    state: 'blocked',
    attributes: {
      name: 'ИП Смирнов А. В. (давалец)',
      inn: '500100732259',
      kpp: null,
      category: 'Давальческое сырьё',
      address: { postcode: 141400, city: 'Химки', street: 'ул. Заводская', house: '3к2' },
      contractDate: null,
      contractScan: null,
    },
    history: [],
  },
]

const cpRef = (id: string): ReferenceValue => ({
  catalogId: 'cat-counterparties',
  elementId: id,
  display: textOf(counterparties.find((c) => c.id === id)?.attributes['name'], id),
})

/* ---------------------------- Спецификации --------------------------- */

const nomRef = (id: string, attr: 'name' | 'article'): ReferenceValue => {
  const el = [...handmade, ...rowElements].find((e) => e.id === id)
  return { catalogId: 'cat-nomenclature', elementId: id, display: textOf(el?.attributes[attr], id) }
}

const specifications: CatalogElement[] = [
  {
    id: 'sp-1',
    catalogId: 'cat-specifications',
    state: 'active',
    attributes: {
      designation: 'УЗПМ.302112.001',
      name: 'Редуктор цилиндрический одноступенчатый',
      product: nomRef('n-0080', 'name'),
      litera: 'О1',
      developer: 'Сидорова А. С.',
      approvedAt: '2026-03-12T00:00:00Z',
      document: { fileName: 'УЗПМ.302112.001.pdf', size: 318552, mimeType: 'application/pdf' },
    },
    history: [],
  },
  {
    id: 'sp-2',
    catalogId: 'cat-specifications',
    state: 'active',
    attributes: {
      designation: 'УЗПМ.303215.002',
      name: 'Привод конвейера ленточного',
      product: nomRef('n-0086', 'name'),
      litera: 'О',
      developer: 'Сидорова А. С.',
      approvedAt: '2026-05-20T00:00:00Z',
      document: null,
    },
    history: [],
  },
  {
    id: 'sp-3',
    catalogId: 'cat-specifications',
    state: 'draft',
    attributes: {
      designation: 'УЗПМ.302112.001-01',
      name: 'Редуктор цилиндрический одноступенчатый, исполнение 01 (i = 4)',
      product: null,
      litera: null,
      developer: 'Сидорова А. С.',
      approvedAt: null,
      document: null,
    },
    history: [],
  },
]

const specRef = (id: string): ReferenceValue => ({
  catalogId: 'cat-specifications',
  elementId: id,
  display: textOf(specifications.find((s) => s.id === id)?.attributes['designation'], id),
})

/** [спецификация, раздел, поз., обозначение, наименование, кол., примечание, позиция номенклатуры] */
type Line = [string, string, number | null, string | null, string, number | null, string | null, string | null]

const lines: Line[] = [
  ['sp-1', 'Документация', null, 'УЗПМ.302112.001 СБ', 'Сборочный чертёж', null, null, null],
  ['sp-1', 'Детали', 1, 'УЗПМ.731122.001', 'Корпус редуктора', 1, null, 'n-0081'],
  ['sp-1', 'Детали', 2, 'УЗПМ.711141.002', 'Крышка подшипника глухая', 2, null, 'n-0082'],
  ['sp-1', 'Детали', 3, 'УЗПМ.715231.003', 'Вал быстроходный', 1, null, 'n-0083'],
  ['sp-1', 'Детали', 4, 'УЗПМ.721341.004', 'Колесо зубчатое', 1, null, 'n-0084'],
  ['sp-1', 'Детали', 5, 'УЗПМ.754152.005', 'Прокладка регулировочная', 2, 'Подбирается при сборке', 'n-0085'],
  ['sp-1', 'Стандартные изделия', 10, null, 'Болт М10-6g×40.58.016 ГОСТ 7798-70', 8, null, 'n-0051'],
  ['sp-1', 'Стандартные изделия', 11, null, 'Гайка М10-6Н.5.016 ГОСТ 5915-70', 8, null, 'n-0054'],
  ['sp-1', 'Стандартные изделия', 12, null, 'Шайба 10 65Г 016 ГОСТ 6402-70', 8, null, 'n-0058'],
  ['sp-1', 'Стандартные изделия', 13, null, 'Подшипник 205 ГОСТ 8338-75', 2, null, 'n-0071'],
  ['sp-1', 'Стандартные изделия', 14, null, 'Подшипник 7206А ГОСТ 27365-87', 2, null, 'n-0073'],
  ['sp-1', 'Материалы', 20, null, 'Смазка Литол-24 ГОСТ 21150-2017', 0.3, 'кг', 'n-0040'],
  ['sp-2', 'Сборочные единицы', 1, 'УЗПМ.302112.001', 'Редуктор цилиндрический одноступенчатый', 1, null, 'n-0080'],
  ['sp-2', 'Стандартные изделия', 5, null, 'Болт М16-6g×60.88.016 ГОСТ 7798-70', 4, null, 'n-0053'],
  ['sp-2', 'Стандартные изделия', 6, null, 'Гайка М16-6Н.5.016 ГОСТ 5915-70', 4, null, 'n-0056'],
  ['sp-2', 'Материалы', 10, null, 'Швеллер 10П ГОСТ 8240-97 / Ст3сп ГОСТ 14637-89', 6.4, 'кг', 'n-0036'],
]

const specLines: CatalogElement[] = lines.map(([spec, section, pos, designation, name, qty, note, item], i) => ({
  id: `sl-${String(i + 1).padStart(3, '0')}`,
  catalogId: 'cat-spec-lines',
  state: 'active',
  attributes: { spec: specRef(spec), section, pos, designation, name, qty, note, item: item ? nomRef(item, 'article') : null },
  history: [],
}))

/* ---------------------------- Счета-фактуры --------------------------- */

/** НДС с 01.01.2026 — 22 %, до этого — 20 % */
const invoice = (
  id: string,
  state: string,
  number: string,
  date: string,
  seller: string,
  contract: string,
  shipment: string,
  amountNet: number,
): CatalogElement => {
  const vatRate = date >= '2026-01-01' ? 22 : 20
  const vat = Math.round(amountNet * vatRate) / 100
  const attributes: Record<string, AttributeValue> = {
    number,
    date,
    seller: cpRef(seller),
    contract,
    shipment,
    amountNet,
    vatRate,
    vat,
    total: Math.round((amountNet + vat) * 100) / 100,
    scan: null,
  }
  return { id, catalogId: 'cat-invoices', state, attributes, history: [] }
}

const invoices: CatalogElement[] = [
  invoice('inv-1', 'paid', '2510-0981', '2025-11-14T00:00:00Z', 'cp-2', 'Договор поставки № 214-МТС/25 от 18.12.2025', 'УПД № 0981 от 14.11.2025', 932500),
  invoice('inv-2', 'paid', '2602-0417', '2026-02-05T00:00:00Z', 'cp-2', 'Договор поставки № 214-МТС/25 от 18.12.2025', 'УПД № 0417 от 05.02.2026', 1240000),
  invoice('inv-3', 'posted', '10/11870', '2026-04-22T00:00:00Z', 'cp-4', 'Договор поставки № 031-МТС/26 от 20.01.2026', 'ТН № 11870 от 22.04.2026', 856400),
  invoice('inv-4', 'cancelled', '10/12204', '2026-06-03T00:00:00Z', 'cp-4', 'Договор поставки № 031-МТС/26 от 20.01.2026', 'ТН № 12204 от 03.06.2026', 410000),
  invoice('inv-5', 'posted', '338', '2026-09-30T00:00:00Z', 'cp-1', 'Договор поставки № 118-МТС/25 от 10.12.2025', 'УПД № 338 от 30.09.2026', 146250),
  invoice('inv-6', 'received', '412', '2026-10-28T00:00:00Z', 'cp-1', 'Договор поставки № 118-МТС/25 от 10.12.2025', 'УПД № 412 от 28.10.2026', 58900),
]

export const catalogElements: CatalogElement[] = [
  ...unitElements,
  ...groupElements,
  ...handmade,
  ...rowElements,
  ...counterparties,
  ...specifications,
  ...specLines,
  ...invoices,
]
