// «Простой» классификатор материалов: класс материала / вид сортамента / марка. Чтение слева направо,
// только прямой ввод. Пример: 0201Сталь45 — сталь качественная конструкционная, круг, марка «Сталь45».

import type { Classifier } from '@/types'
import { chain } from './helpers'

export const materialClassifier: Classifier = {
  id: 'cls-material',
  name: 'Классификатор материалов',
  description: 'Класс материала (по стандарту на марки), вид сортамента и марка. Шифр читается слева направо.',
  readDirection: 'ltr',
  inputModes: ['direct'],
  sections: [{ id: 's-main', name: 'Структура', order: 1 }],
  facets: [
    {
      id: 'm-class',
      name: 'Класс',
      lengthMode: 'fixed',
      fixedLength: 2,
      defaultLength: 1,
      dataType: 'int',
      required: true,
      section: 's-main',
      options: [
        { code: '01', name: 'Сталь углеродистая обыкновенного качества (ГОСТ 380-2005)' },
        { code: '02', name: 'Сталь качественная конструкционная (ГОСТ 1050-2013)' },
        { code: '03', name: 'Сталь легированная конструкционная (ГОСТ 4543-2016)' },
        { code: '04', name: 'Сталь низколегированная (ГОСТ 19281-2014)' },
        { code: '05', name: 'Сталь инструментальная быстрорежущая (ГОСТ 19265-73)' },
        { code: '06', name: 'Сталь рессорно-пружинная (ГОСТ 14959-2016)' },
        { code: '07', name: 'Полимеры' },
      ],
    },
    {
      id: 'm-group',
      name: 'Вид сортамента',
      description: '01 — круг, 02 — лист, 03 — труба, 04 — уголок, 05 — швеллер, 06 — шестигранник',
      placeholder: '01',
      lengthMode: 'fixed',
      fixedLength: 2,
      defaultLength: 1,
      dataType: 'int',
      required: true,
      section: 's-main',
    },
    {
      id: 'm-kind',
      name: 'Марка',
      placeholder: 'Сталь45',
      lengthMode: 'remainder',
      defaultLength: 1,
      dataType: 'string',
      required: true,
      section: 's-main',
    },
  ],
  tree: {
    id: 'root',
    kind: 'root',
    name: 'Классификатор материалов',
    defaultChildIndex: 0,
    children: [
      {
        id: 'cat-materials',
        kind: 'catalog',
        name: 'Материалы',
        defaultChildIndex: 0,
        children: [chain('mt', ['m-class', 'm-group', 'm-kind'])],
      },
    ],
  },
}
