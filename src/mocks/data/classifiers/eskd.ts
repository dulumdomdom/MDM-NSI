// Обозначение изделий и конструкторских документов по ГОСТ 2.201-80:
// КОД ОРГАНИЗАЦИИ . КЛАССИФИКАЦИОННАЯ ХАРАКТЕРИСТИКА (класс, подкласс, группа, подгруппа, вид) . ПОРЯДКОВЫЙ НОМЕР.
// Пример: УЗПМ.715231.003 — деталь класса 71 (тела вращения), рег. № 003.
// Классы деталей — по Классификатору ЕСКД (классы 71–76); подклассы и ниже вводятся цифрами по определителю.

import type { Classifier, FacetConfig } from '@/types'
import { chain } from './helpers'

const opt = (code: string, name: string) => ({ code, name })
const digit = (id: string, name: string): FacetConfig => ({
  id,
  name,
  lengthMode: 'fixed',
  fixedLength: 1,
  defaultLength: 1,
  dataType: 'int',
  required: true,
  section: 's-kch',
})

const facets: FacetConfig[] = [
  {
    id: 'es-org',
    name: 'Код организации-разработчика',
    lengthMode: 'delimiter',
    delimiter: '.',
    defaultLength: 4,
    dataType: 'string',
    required: true,
    section: 's-org',
    options: [opt('УЗПМ', 'УЗПМ — собственная разработка'), opt('АБВГ', 'АБВГ — документация заказчика')],
  },
  {
    id: 'es-class',
    name: 'Класс',
    lengthMode: 'fixed',
    fixedLength: 2,
    defaultLength: 2,
    dataType: 'int',
    required: true,
    section: 's-kch',
    options: [
      opt('30', 'Сборочные единицы общемашиностроительного применения'),
      opt('71', 'Детали — тела вращения типа колец, дисков, валов, втулок'),
      opt('72', 'Детали — тела вращения с элементами зубчатого зацепления, трубы'),
      opt('73', 'Детали — не тела вращения: корпусные, опорные, ёмкостные'),
      opt('74', 'Детали — не тела вращения: плоскостные, рычажные, профильные'),
      opt('75', 'Детали — тела и не тела вращения: кулачковые, пружинные, уплотнительные, крепёжные'),
      opt('76', 'Детали технологической оснастки и инструмента'),
    ],
    dependencies: [
      {
        id: 'r-eskd-rotation',
        description: 'Тела вращения: подкласс определяется соотношением длины и диаметра',
        triggerFacetId: 'es-class',
        triggerValue: 71,
        triggerCondition: { type: 'intArray', value: [71, 72] },
        overrides: [{ facetId: 'es-sub', label: 'Подкласс (по отношению L/D)' }],
      },
      {
        id: 'r-eskd-flat',
        description: 'Не тела вращения: подкласс определяется формой и назначением',
        triggerFacetId: 'es-class',
        triggerValue: 73,
        triggerCondition: { type: 'intRange', value: { min: 73, max: 74 } },
        overrides: [{ facetId: 'es-sub', label: 'Подкласс (по форме и назначению)' }],
      },
    ],
  },
  digit('es-sub', 'Подкласс'),
  digit('es-group', 'Группа'),
  digit('es-subgroup', 'Подгруппа'),
  { ...digit('es-kind', 'Вид'), lengthMode: 'delimiter', delimiter: '.' },
  {
    id: 'es-num',
    name: 'Порядковый регистрационный номер',
    lengthMode: 'remainder',
    defaultLength: 3,
    dataType: 'int',
    required: true,
    section: 's-reg',
    placeholder: '001',
  },
]

export const eskdClassifier: Classifier = {
  id: 'cls-eskd',
  name: 'Обозначения ЕСКД',
  description: 'Децимальные обозначения деталей и сборочных единиц по ГОСТ 2.201-80 (Классификатор ЕСКД). Присваивает бюро стандартизации ОГК.',
  readDirection: 'ltr',
  inputModes: ['direct', 'wizard'],
  sections: [
    { id: 's-org', name: 'Организация', order: 1 },
    { id: 's-kch', name: 'Классификационная характеристика', order: 2 },
    { id: 's-reg', name: 'Регистрация', order: 3 },
  ],
  facets,
  tree: {
    id: 'root',
    kind: 'root',
    name: 'Обозначения ЕСКД',
    defaultChildIndex: 0,
    children: [
      {
        id: 'cat-eskd-items',
        kind: 'catalog',
        name: 'Изделия',
        defaultChildIndex: 0,
        decodeStructures: [
          {
            id: 'ds-eskd',
            name: 'Изделие',
            conditions: [],
            parts: [
              { kind: 'facet', facetId: 'es-class', suffix: ',' },
              { kind: 'facet', facetId: 'es-org', format: 'code', prefix: 'разработчик', suffix: ',' },
              { kind: 'facet', facetId: 'es-num', format: 'code', prefix: 'рег. №' },
            ],
          },
        ],
        children: [chain('es', ['es-org', 'es-class', 'es-sub', 'es-group', 'es-subgroup', 'es-kind', 'es-num'])],
      },
    ],
  },
}
