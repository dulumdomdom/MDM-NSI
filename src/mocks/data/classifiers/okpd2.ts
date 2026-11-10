// ОКПД2 (ОК 034-2014, КПЕС 2008) — фрагмент для закупаемой продукции машиностроительного завода.
// Иерархия класс → группа → вид → категория, части через точку: 25.94.11 — «Изделия крепежные с резьбой…».
// Набор групп зависит от класса, набор видов — от группы (правила зависимостей).

import type { Classifier, FacetConfig } from '@/types'
import { chain } from './helpers'

const opt = (code: string, name: string) => ({ code, name })

const GROUPS: Record<string, { code: string; name: string }[]> = {
  '20': [opt('59', 'Продукты химические прочие, не включенные в другие группировки')],
  '24': [opt('10', 'Железо, чугун, сталь и ферросплавы')],
  '25': [opt('73', 'Инструмент'), opt('94', 'Изделия крепежные и винты крепежные')],
  '26': [opt('51', 'Оборудование для измерения, испытаний и навигации')],
  '28': [opt('15', 'Подшипники, шестерни, зубчатые передачи и элементы механических передач и приводов')],
}

const KINDS: Record<string, { code: string; name: string }[]> = {
  '59': [opt('41', 'Материалы смазочные')],
  '10': [
    opt('31', 'Прокат плоский горячекатаный из нелегированной стали шириной не менее 600 мм'),
    opt('62', 'Прутки прочие из стали, без дальнейшей обработки, кроме горячей прокатки'),
    opt('71', 'Профили открытые из нелегированной стали, без дальнейшей обработки, кроме горячей прокатки'),
  ],
  '73': [opt('40', 'Инструмент рабочий сменный для станков или для ручного инструмента')],
  '94': [opt('11', 'Изделия крепежные с резьбой из черных металлов, не включенные в другие группировки')],
  '51': [opt('33', 'Инструменты для измерения линейных размеров ручные')],
  '15': [opt('10', 'Подшипники шариковые и роликовые')],
}

const facets: FacetConfig[] = [
  {
    id: 'ok-class',
    name: 'Класс',
    lengthMode: 'delimiter',
    delimiter: '.',
    defaultLength: 2,
    dataType: 'string',
    required: true,
    section: 's-okpd',
    options: [
      opt('20', 'Вещества химические и продукты химические'),
      opt('24', 'Продукция металлургическая'),
      opt('25', 'Изделия металлические готовые, кроме машин и оборудования'),
      opt('26', 'Оборудование компьютерное, электронное и оптическое'),
      opt('28', 'Машины и оборудование, не включенные в другие группировки'),
    ],
    dependencies: Object.entries(GROUPS).map(([cls, options]) => ({
      id: `r-okpd-${cls}`,
      triggerFacetId: 'ok-class',
      triggerValue: cls,
      overrides: [{ facetId: 'ok-group', options }],
    })),
  },
  {
    id: 'ok-group',
    name: 'Группа',
    lengthMode: 'delimiter',
    delimiter: '.',
    defaultLength: 2,
    dataType: 'string',
    required: true,
    section: 's-okpd',
    dependencies: Object.entries(KINDS).map(([group, options]) => ({
      id: `r-okpd-g${group}`,
      triggerFacetId: 'ok-group',
      triggerValue: group,
      overrides: [{ facetId: 'ok-kind', options }],
    })),
  },
  {
    id: 'ok-kind',
    name: 'Вид',
    lengthMode: 'delimiter',
    delimiter: '.',
    defaultLength: 2,
    dataType: 'string',
    required: true,
    section: 's-okpd',
  },
  {
    id: 'ok-category',
    name: 'Категория',
    description: 'Необязательная детализация до 9 знаков',
    lengthMode: 'remainder',
    defaultLength: 3,
    dataType: 'int',
    required: false,
    section: 's-okpd',
    placeholder: '110',
  },
]

export const okpd2Classifier: Classifier = {
  id: 'cls-okpd2',
  name: 'ОКПД2',
  description: 'Общероссийский классификатор продукции по видам экономической деятельности (фрагмент). Нужен для закупок по 223-ФЗ и отчётности.',
  readDirection: 'ltr',
  inputModes: ['wizard', 'direct'],
  sections: [{ id: 's-okpd', name: 'Группировка', order: 1 }],
  facets,
  tree: {
    id: 'root',
    kind: 'root',
    name: 'ОКПД2',
    defaultChildIndex: 0,
    children: [
      {
        id: 'cat-okpd2-c',
        kind: 'catalog',
        name: 'Раздел C. Продукция обрабатывающих производств',
        defaultChildIndex: 0,
        decodeStructures: [
          {
            id: 'ds-okpd',
            name: 'Вид продукции',
            conditions: [],
            parts: [{ kind: 'facet', facetId: 'ok-kind' }],
          },
        ],
        children: [chain('ok', ['ok-class', 'ok-group', 'ok-kind', 'ok-category'])],
      },
    ],
  },
}
