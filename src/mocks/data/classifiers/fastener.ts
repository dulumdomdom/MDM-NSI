// Классификатор крепёжных изделий по условным обозначениям ГОСТ:
// болты ГОСТ 7798-70 / 7805-70, гайки ГОСТ 5915-70 / 5927-70, шайбы ГОСТ 11371-78, пружинные шайбы ГОСТ 6402-70.
// Шифр читается слева направо, части через «-»: Б1-12-К-50-8.8-016-7798-70 = Болт М12×50, исп. 1, шаг крупный,
// класс прочности 8.8, покрытие 01 (цинковое хроматированное) толщиной 6 мкм, ГОСТ 7798-70.
// Ветвление по виду изделия; шаг резьбы, классы прочности и стандарт зависят от вида и диаметра.

import type { Classifier, FacetConfig } from '@/types'
import { chain, facetNode } from './helpers'

const opt = (code: string, name: string) => ({ code, name })

/** Мелкие шаги резьбы по ГОСТ 24705-2004 для ходовых диаметров */
const PITCH: Record<string, string[]> = {
  '8': ['1'],
  '10': ['1.25'],
  '12': ['1.25', '1.5'],
  '16': ['1.5'],
  '20': ['1.5', '2'],
  '24': ['2'],
}
const coarse = opt('К', 'крупный')

const facets: FacetConfig[] = [
  {
    id: 'fx-type',
    name: 'Вид изделия',
    lengthMode: 'fixed',
    fixedLength: 1,
    defaultLength: 1,
    dataType: 'string',
    required: true,
    section: 's-kind',
    options: [opt('Б', 'Болт'), opt('Г', 'Гайка'), opt('Ш', 'Шайба'), opt('П', 'Шайба пружинная')],
    dependencies: [
      {
        id: 'r-type-bolt',
        description: 'Болт: стандарты на болты с шестигранной головкой, классы прочности болтов',
        triggerFacetId: 'fx-type',
        triggerValue: 'Б',
        overrides: [
          { facetId: 'fx-std', options: [opt('7798-70', 'нормальной точности'), opt('7805-70', 'повышенной точности')] },
          { facetId: 'fx-class', options: [opt('5.8', '5.8'), opt('8.8', '8.8'), opt('10.9', '10.9')] },
        ],
      },
      {
        id: 'r-type-nut',
        description: 'Гайка: стандарты на шестигранные гайки, классы прочности гаек',
        triggerFacetId: 'fx-type',
        triggerValue: 'Г',
        overrides: [
          { facetId: 'fx-std', options: [opt('5915-70', 'нормальной точности'), opt('5927-70', 'повышенной точности')] },
          { facetId: 'fx-class', options: [opt('5', '5'), opt('8', '8'), opt('10', '10')] },
        ],
      },
      {
        id: 'r-type-washer',
        description: 'Шайба: класс прочности не указывается, в позиции — группа материала',
        triggerFacetId: 'fx-type',
        triggerValue: 'Ш',
        overrides: [
          { facetId: 'fx-std', options: [opt('11371-78', 'шайбы плоские')] },
          { facetId: 'fx-class', label: 'Группа материала', options: [opt('01', 'углеродистые стали 08, 10, 08кп, 10кп'), opt('02', 'стали 35, 45')] },
        ],
      },
      {
        id: 'r-type-spring',
        description: 'Пружинная шайба: марка стали вместо класса прочности',
        triggerFacetId: 'fx-type',
        triggerValue: 'П',
        overrides: [
          { facetId: 'fx-std', options: [opt('6402-70', 'шайбы пружинные')] },
          { facetId: 'fx-class', label: 'Материал', options: [opt('65Г', 'сталь 65Г'), opt('30Х13', 'сталь 30Х13')] },
        ],
      },
    ],
  },
  {
    id: 'fx-exec',
    name: 'Исполнение',
    lengthMode: 'delimiter',
    delimiter: '-',
    defaultLength: 1,
    dataType: 'int',
    required: true,
    section: 's-kind',
    options: [opt('1', 'исполнение 1'), opt('2', 'исполнение 2 (отверстие в стержне)'), opt('3', 'исполнение 3 (отверстия в головке)')],
  },
  {
    id: 'fx-d',
    name: 'Номинальный диаметр резьбы',
    lengthMode: 'delimiter',
    delimiter: '-',
    defaultLength: 2,
    dataType: 'int',
    required: true,
    section: 's-size',
    options: ['6', '8', '10', '12', '16', '20', '24'].map((d) => opt(d, `М${d}`)),
    // Для каждого диаметра — свой набор мелких шагов
    dependencies: Object.entries(PITCH).map(([d, steps]) => ({
      id: `r-pitch-${d}`,
      description: `М${d}: мелкий шаг ${steps.join(' или ')} мм`,
      triggerFacetId: 'fx-d',
      triggerValue: d,
      overrides: [{ facetId: 'fx-pitch', options: [coarse, ...steps.map((s) => opt(s, `мелкий ${s.replace('.', ',')} мм`))] }],
    })),
  },
  {
    id: 'fx-pitch',
    name: 'Шаг резьбы',
    lengthMode: 'delimiter',
    delimiter: '-',
    defaultLength: 1,
    dataType: 'string',
    required: true,
    section: 's-size',
    options: [coarse],
  },
  {
    id: 'fx-len',
    name: 'Длина, мм',
    description: 'Ряд длин по ГОСТ 7798-70',
    lengthMode: 'delimiter',
    delimiter: '-',
    defaultLength: 2,
    dataType: 'int',
    required: true,
    section: 's-size',
    placeholder: '50',
  },
  {
    id: 'fx-class',
    name: 'Класс прочности',
    lengthMode: 'delimiter',
    delimiter: '-',
    defaultLength: 3,
    dataType: 'string',
    required: true,
    section: 's-prop',
  },
  {
    id: 'fx-cover',
    name: 'Покрытие',
    description: 'Вид покрытия по ГОСТ 1759.0-87, последняя цифра — толщина, мкм',
    lengthMode: 'delimiter',
    delimiter: '-',
    defaultLength: 3,
    dataType: 'string',
    required: true,
    section: 's-prop',
    options: [
      opt('00', 'без покрытия'),
      opt('016', 'цинковое хроматированное 6 мкм'),
      opt('019', 'цинковое хроматированное 9 мкм'),
      opt('05', 'окисное'),
      opt('06', 'фосфатное с промасливанием'),
    ],
  },
  {
    id: 'fx-std',
    name: 'Стандарт',
    lengthMode: 'remainder',
    defaultLength: 8,
    dataType: 'string',
    required: true,
    section: 's-prop',
  },
]

export const fastenerClassifier: Classifier = {
  id: 'cls-fastener',
  name: 'Крепёжные изделия (ГОСТ)',
  description: 'Болты, гайки, шайбы по условному обозначению ГОСТ. Шаг резьбы и классы прочности зависят от вида и диаметра.',
  readDirection: 'ltr',
  inputModes: ['wizard', 'direct'],
  allowedCharsPattern: '[\\p{L}\\p{N}.\\-]',
  sections: [
    { id: 's-kind', name: 'Вид изделия', order: 1 },
    { id: 's-size', name: 'Размеры', order: 2 },
    { id: 's-prop', name: 'Свойства и стандарт', order: 3 },
  ],
  facets,
  shortNameRule: {
    facetIds: ['fx-type', 'fx-d', 'fx-len', 'fx-class', 'fx-std'],
    template: '{fx-type} {fx-d}[×{fx-len:code}][ {fx-class:code}] ГОСТ {fx-std:code}',
    normalize: { maxLength: 80 },
  },
  tree: {
    id: 'root',
    kind: 'root',
    name: 'Крепёжные изделия',
    defaultChildIndex: 0,
    children: [
      {
        id: 'cat-fasteners',
        kind: 'catalog',
        name: 'Крепёж резьбовой и шайбы',
        defaultChildIndex: 0,
        decodeStructures: [
          {
            id: 'ds-bolt',
            name: 'Болт',
            conditions: [{ facetId: 'fx-type', condition: { type: 'string', value: 'Б' } }],
            parts: [
              { kind: 'facet', facetId: 'fx-type' },
              { kind: 'facet', facetId: 'fx-d' },
              { kind: 'facet', facetId: 'fx-len', format: 'code', prefix: '×', suffix: 'мм,' },
              { kind: 'facet', facetId: 'fx-exec', suffix: ',' },
              { kind: 'facet', facetId: 'fx-pitch', prefix: 'шаг', suffix: ',' },
              { kind: 'facet', facetId: 'fx-class', format: 'code', prefix: 'класс прочности', suffix: ',' },
              { kind: 'facet', facetId: 'fx-cover', suffix: ',' },
              { kind: 'facet', facetId: 'fx-std', format: 'code', prefix: 'ГОСТ' },
            ],
          },
          {
            id: 'ds-nut',
            name: 'Гайка',
            conditions: [{ facetId: 'fx-type', condition: { type: 'string', value: 'Г' } }],
            parts: [
              { kind: 'facet', facetId: 'fx-type' },
              { kind: 'facet', facetId: 'fx-d', suffix: ',' },
              { kind: 'facet', facetId: 'fx-exec', suffix: ',' },
              { kind: 'facet', facetId: 'fx-pitch', prefix: 'шаг', suffix: ',' },
              { kind: 'facet', facetId: 'fx-class', format: 'code', prefix: 'класс прочности', suffix: ',' },
              { kind: 'facet', facetId: 'fx-cover', suffix: ',' },
              { kind: 'facet', facetId: 'fx-std', format: 'code', prefix: 'ГОСТ' },
            ],
          },
          {
            id: 'ds-washer',
            name: 'Шайба',
            conditions: [{ facetId: 'fx-type', condition: { type: 'stringArray', value: ['Ш', 'П'] } }],
            parts: [
              { kind: 'facet', facetId: 'fx-type' },
              { kind: 'text', text: 'для' },
              { kind: 'facet', facetId: 'fx-d', suffix: ',' },
              { kind: 'facet', facetId: 'fx-class', prefix: 'материал:', suffix: ',' },
              { kind: 'facet', facetId: 'fx-cover', suffix: ',' },
              { kind: 'facet', facetId: 'fx-std', format: 'code', prefix: 'ГОСТ' },
            ],
          },
        ],
        children: [
          facetNode('x-type', 'fx-type', [
            chain('xb', ['fx-exec', 'fx-d', 'fx-pitch', 'fx-len', 'fx-class', 'fx-cover', 'fx-std'], [], { type: 'string', value: 'Б' }),
            chain('xg', ['fx-exec', 'fx-d', 'fx-pitch', 'fx-class', 'fx-cover', 'fx-std'], [], { type: 'string', value: 'Г' }),
            chain('xw', ['fx-d', 'fx-class', 'fx-cover', 'fx-std'], [], { type: 'stringArray', value: ['Ш', 'П'] }),
          ]),
        ],
      },
    ],
  },
}
