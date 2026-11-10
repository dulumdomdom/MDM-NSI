<script setup lang="ts">
// Роль — шаблон прав: матрица «ресурс × действие», ограничения колонок и строк справочника,
// допустимые области назначения.
import { deepClone } from '@/lib/clone'
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import UiField from '@/components/ui/UiField.vue'
import { uniqueId } from '@/lib/ids'
import type { Permission, PermissionAction, ResourceType, Role, ScopeType } from '@/types'

const props = defineProps<{ role: Role | null; existingIds: string[] }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ save: [role: Role, isNew: boolean] }>()

const RESOURCES: { id: ResourceType; label: string; actions: PermissionAction[] }[] = [
  { id: 'catalog', label: 'Справочники', actions: ['read', 'create', 'update', 'delete', 'configure', 'approve'] },
  { id: 'classifier', label: 'Классификаторы', actions: ['read', 'create', 'update', 'delete', 'configure', 'approve'] },
  { id: 'request', label: 'Заявки', actions: ['read', 'create', 'approve'] },
  { id: 'admin', label: 'Администрирование', actions: ['read', 'create', 'update', 'delete'] },
  { id: 'audit', label: 'Журнал действий', actions: ['read'] },
]
const ACTIONS: { id: PermissionAction; label: string; hint: string }[] = [
  { id: 'read', label: 'Просмотр', hint: '' },
  { id: 'create', label: 'Создание', hint: 'элементов / записей' },
  { id: 'update', label: 'Изменение', hint: 'элементов, присвоение шифров' },
  { id: 'delete', label: 'Удаление', hint: 'элементов' },
  { id: 'configure', label: 'Настройка', hint: 'структура, фасеты, согласование' },
  { id: 'approve', label: 'Согласование', hint: '' },
]
const SCOPES: { id: ScopeType; label: string }[] = [
  { id: 'global', label: 'Вся система' },
  { id: 'catalog', label: 'Справочник' },
  { id: 'classifier', label: 'Классификатор' },
]

const isNew = computed(() => !props.role)
const form = ref<Role>({ id: '', name: '', permissions: [] })
/** Ограничения справочника — текстом: id через запятую */
const columnsText = ref('')
const statesText = ref('')

watch(visible, (v) => {
  if (!v) return
  form.value = props.role ? deepClone(props.role) : { id: '', name: '', description: '', permissions: [] }
  const cat = form.value.permissions.find((p) => p.resource === 'catalog')
  columnsText.value = cat && cat.columnIds !== '*' ? cat.columnIds.join(', ') : ''
  const states = cat?.rowFilter?.all.find((c) => c.field === '$state')?.value
  statesText.value = Array.isArray(states) ? states.join(', ') : ''
})

const perm = (r: ResourceType) => form.value.permissions.find((p) => p.resource === r)
const has = (r: ResourceType, a: PermissionAction) => !!perm(r)?.actions.includes(a)

function toggle(r: ResourceType, a: PermissionAction, on: boolean): void {
  const cur = perm(r)
  const actions = on ? [...new Set([...(cur?.actions ?? []), a])] : (cur?.actions ?? []).filter((x) => x !== a)
  const others = form.value.permissions.filter((p) => p.resource !== r)
  form.value.permissions = actions.length ? [...others, { resource: r, resourceId: '*', columnIds: '*', ...cur, actions }] : others
}

function toggleScope(s: ScopeType, on: boolean): void {
  const cur = form.value.scopes ?? SCOPES.map((x) => x.id)
  const next = on ? [...new Set([...cur, s])] : cur.filter((x) => x !== s)
  form.value.scopes = next.length === SCOPES.length ? undefined : next
}
const scopeOn = (s: ScopeType) => !form.value.scopes || form.value.scopes.includes(s)

const split = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean)

function save(): void {
  if (!form.value.name.trim()) return
  const role: Role = { ...form.value, name: form.value.name.trim() }
  if (isNew.value) role.id = uniqueId('role', role.name, props.existingIds)
  // Ограничения справочника применяются к праву на справочники
  role.permissions = role.permissions.map((p): Permission => {
    if (p.resource !== 'catalog') return p
    const { rowFilter: _rf, ...rest } = p
    const cols = split(columnsText.value)
    const states = split(statesText.value)
    return {
      ...rest,
      columnIds: cols.length ? cols : '*',
      ...(states.length ? { rowFilter: { all: [{ field: '$state', op: 'in' as const, value: states }] } } : {}),
    }
  })
  emit('save', role, isNew.value)
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="isNew ? 'Новая роль' : `Роль «${form.name}»`" class="w-full max-w-3xl" :draggable="false">
    <div class="flex flex-col gap-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UiField label="Наименование" for-id="rd-name" required><InputText id="rd-name" v-model="form.name" fluid /></UiField>
        <UiField label="Описание" for-id="rd-desc"><InputText id="rd-desc" v-model="form.description" fluid /></UiField>
      </div>

      <section>
        <h3 class="mb-2 text-sm font-bold text-brand-dark">Права</h3>
        <div class="overflow-x-auto rounded-md border border-line">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-brand-soft text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
                <th class="px-3 py-2 text-left">Ресурс</th>
                <th v-for="a in ACTIONS" :key="a.id" v-tooltip.top="a.hint || undefined" class="px-2 py-2 text-center">{{ a.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in RESOURCES" :key="r.id" class="border-t border-line">
                <td class="px-3 py-2.5 font-semibold text-ink">{{ r.label }}</td>
                <td v-for="a in ACTIONS" :key="a.id" class="px-2 py-2.5 text-center">
                  <Checkbox v-if="r.actions.includes(a.id)" :model-value="has(r.id, a.id)" binary @update:model-value="(v: boolean) => toggle(r.id, a.id, v)" />
                  <span v-else class="text-line-strong">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="perm('catalog')" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UiField label="Только колонки справочника" for-id="rd-cols" hint="id атрибутов через запятую; пусто — все колонки">
          <InputText id="rd-cols" v-model="columnsText" class="code-font" fluid />
        </UiField>
        <UiField label="Только элементы в состояниях" for-id="rd-states" hint="id состояний через запятую; пусто — все строки">
          <InputText id="rd-states" v-model="statesText" class="code-font" fluid />
        </UiField>
      </section>

      <section>
        <h3 class="mb-2 text-sm font-bold text-brand-dark">Где можно назначать</h3>
        <div class="flex flex-wrap gap-5">
          <label v-for="s in SCOPES" :key="s.id" class="flex items-center gap-2 text-sm">
            <Checkbox :model-value="scopeOn(s.id)" binary @update:model-value="(v: boolean) => toggleScope(s.id, v)" />{{ s.label }}
          </label>
        </div>
      </section>
    </div>
    <template #footer>
      <Button label="Отмена" severity="secondary" text @click="visible = false" />
      <Button :label="isNew ? 'Создать' : 'Сохранить'" :disabled="!form.name.trim()" @click="save" />
    </template>
  </Dialog>
</template>
