// Реестр полей ввода: UI-группа атрибута → компонент.
import type { Component } from 'vue'
import type { AttributeKind } from '@/types'
import NumberField from './NumberField.vue'
import StringField from './StringField.vue'
import DateTimeField from './DateTimeField.vue'
import BlobField from './BlobField.vue'
import CompositeField from './CompositeField.vue'
import ReferenceField from './ReferenceField.vue'

export const FIELD_COMPONENTS: Record<AttributeKind, Component> = {
  number: NumberField,
  string: StringField,
  datetime: DateTimeField,
  blob: BlobField,
  composite: CompositeField,
  reference: ReferenceField,
}
