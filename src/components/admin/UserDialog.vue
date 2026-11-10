<script setup lang="ts">
// Пользователь: учётные данные, контакты, срок действия и назначения ролей по областям
// (вся система / справочник / классификатор).
import { deepClone } from '@/lib/clone'
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import UiField from '@/components/ui/UiField.vue'
import { scopeKey, type ScopeOption } from '@/composables/useAdmin'
import type { AuthProvider, Role, RoleAssignment, User } from '@/types'

const props = defineProps<{
  user: User | null
  roles: Role[]
  scopeOptions: ScopeOption[]
  passwordErrors: (pw: string) => string[]
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ save: [user: User, password: string] }>()

const isNew = computed(() => !props.user)
const form = ref<User>(empty())
const password = ref('')
const expires = ref<Date | null>(null)

function empty(): User {
  return { id: '', login: '', fullName: '', assignments: [], status: 'active', provider: 'local' }
}

watch(visible, (v) => {
  if (!v) return
  form.value = props.user ? deepClone(props.user) : empty()
  expires.value = form.value.expiresAt ? new Date(form.value.expiresAt) : null
  password.value = ''
})

const providers: { value: AuthProvider; label: string }[] = [
  { value: 'local', label: 'Учётная запись системы' },
  { value: 'ldap', label: 'LDAP / домен' },
]

/* Назначения ролей */
const roleById = (id: string) => props.roles.find((r) => r.id === id)
/** Области, в которых допустима роль */
const scopesFor = (roleId: string) => {
  const allowed = roleById(roleId)?.scopes
  return props.scopeOptions.filter((o) => !allowed || allowed.includes(o.scope.type))
}
const groupedScopes = (roleId: string) => {
  const groups = new Map<string, ScopeOption[]>()
  for (const o of scopesFor(roleId)) groups.set(o.group, [...(groups.get(o.group) ?? []), o])
  return [...groups].map(([label, items]) => ({ label, items }))
}

function addAssignment(): void {
  const role = props.roles[0]
  if (role) form.value.assignments = [...form.value.assignments, { roleId: role.id, scope: { type: 'global' } }]
}
function setRole(i: number, roleId: string): void {
  const a = form.value.assignments[i]
  if (!a) return
  // Если прежняя область недопустима для новой роли — берём первую допустимую
  const ok = scopesFor(roleId).some((o) => scopeKey(o.scope) === scopeKey(a.scope))
  const scope = ok ? a.scope : (scopesFor(roleId)[0]?.scope ?? { type: 'global' as const })
  form.value.assignments = form.value.assignments.map((x, k) => (k === i ? { roleId, scope } : x))
}
function setScope(i: number, key: string): void {
  const opt = props.scopeOptions.find((o) => o.key === key)
  if (opt) form.value.assignments = form.value.assignments.map((x, k) => (k === i ? { ...x, scope: opt.scope } : x))
}
const removeAssignment = (i: number) => (form.value.assignments = form.value.assignments.filter((_, k) => k !== i))

const duplicates = computed(() => {
  const keys = form.value.assignments.map((a: RoleAssignment) => `${a.roleId}|${scopeKey(a.scope)}`)
  return keys.length !== new Set(keys).size
})
const pwErrors = computed(() => (isNew.value && form.value.provider === 'local' ? props.passwordErrors(password.value) : []))
const valid = computed(() => form.value.login.trim() && form.value.fullName.trim() && !duplicates.value && pwErrors.value.length === 0)

function save(): void {
  if (!valid.value) return
  const u: User = { ...form.value, login: form.value.login.trim(), fullName: form.value.fullName.trim() }
  if (expires.value) u.expiresAt = expires.value.toISOString()
  else delete u.expiresAt
  emit('save', u, password.value)
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="isNew ? 'Новый пользователь' : form.fullName" class="w-full max-w-3xl" :draggable="false">
    <div class="flex flex-col gap-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UiField label="Способ входа" class="sm:col-span-2">
          <SelectButton v-model="form.provider" :options="providers" option-label="label" option-value="value" :allow-empty="false" :disabled="!isNew" />
        </UiField>
        <UiField label="ФИО" for-id="ud-name" required><InputText id="ud-name" v-model="form.fullName" fluid /></UiField>
        <UiField label="Логин" for-id="ud-login" required><InputText id="ud-login" v-model="form.login" :disabled="!isNew" fluid /></UiField>
        <UiField label="Должность / подразделение" for-id="ud-pos"><InputText id="ud-pos" v-model="form.position" fluid /></UiField>
        <UiField label="E-mail" for-id="ud-email"><InputText id="ud-email" v-model="form.email" fluid /></UiField>
        <UiField label="Телефон" for-id="ud-phone"><InputText id="ud-phone" v-model="form.phone" fluid /></UiField>
        <UiField label="Учётная запись действует до" for-id="ud-exp">
          <DatePicker v-model="expires" input-id="ud-exp" date-format="dd.mm.yy" show-icon show-button-bar fluid />
        </UiField>
        <UiField v-if="isNew && form.provider === 'local'" label="Пароль" for-id="ud-pass" required :error="password ? pwErrors[0] : undefined" class="sm:col-span-2">
          <Password v-model="password" input-id="ud-pass" :feedback="false" toggle-mask fluid />
        </UiField>
      </div>

      <section>
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-bold text-brand-dark">Роли и области</h3>
          <Button label="Назначить роль" icon="pi pi-plus" size="small" text @click="addAssignment" />
        </div>
        <p class="mb-3 text-xs text-ink-3">Роль определяет, что можно делать; область — где: во всей системе или в конкретном справочнике / классификаторе.</p>
        <div class="overflow-hidden rounded-md border border-line">
          <div v-if="form.assignments.length === 0" class="px-3 py-4 text-sm text-ink-3">Ролей нет — пользователь не увидит данные</div>
          <div v-for="(a, i) in form.assignments" :key="i" class="grid grid-cols-[1fr_1.3fr_40px] items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
            <Select :model-value="a.roleId" :options="props.roles" option-label="name" option-value="id" size="small" @update:model-value="(v: string) => setRole(i, v)" />
            <Select
              :model-value="scopeKey(a.scope)"
              :options="groupedScopes(a.roleId)"
              option-group-label="label"
              option-group-children="items"
              option-label="label"
              option-value="key"
              size="small"
              filter
              @update:model-value="(v: string) => setScope(i, v)"
            />
            <Button icon="pi pi-times" text rounded size="small" severity="secondary" aria-label="Снять роль" @click="removeAssignment(i)" />
          </div>
        </div>
        <small v-if="duplicates" class="mt-1 block text-xs text-[var(--danger)]">Одна и та же роль назначена в одной области дважды</small>
      </section>
    </div>
    <template #footer>
      <Button label="Отмена" severity="secondary" text @click="visible = false" />
      <Button :label="isNew ? 'Зарегистрировать' : 'Сохранить'" :disabled="!valid" @click="save" />
    </template>
  </Dialog>
</template>
