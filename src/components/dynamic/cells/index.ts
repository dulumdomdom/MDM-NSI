// Реестр ячеек: UI-группа атрибута → компонент. Новый тип = новая запись здесь.
import type { Component } from 'vue'
import type { AttributeKind } from '@/types'
import NumberCell from './NumberCell.vue'
import StringCell from './StringCell.vue'
import DateTimeCell from './DateTimeCell.vue'
import BlobCell from './BlobCell.vue'
import CompositeCell from './CompositeCell.vue'
import ReferenceCell from './ReferenceCell.vue'

export const CELL_COMPONENTS: Record<AttributeKind, Component> = {
  number: NumberCell,
  string: StringCell,
  datetime: DateTimeCell,
  blob: BlobCell,
  composite: CompositeCell,
  reference: ReferenceCell,
}
