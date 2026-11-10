<script setup lang="ts">
// Администрирование: пользователи (CRUD, назначения ролей по областям, блокировка, сброс пароля),
// роли (CRUD, матрица прав), парольная политика. Логика — в useAdmin.
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import { useConfirm } from 'primevue/useconfirm'
import RoleDialog from '@/components/admin/RoleDialog.vue'
import UserDialog from '@/components/admin/UserDialog.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiField from '@/components/ui/UiField.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import { adminApi, errorMessage } from '@/api'
import { isAbsent } from '@/lib/rbac'
import { useAdmin } from '@/composables/useAdmin'
import { useUiStore } from '@/stores/ui'
import type { PasswordPolicy, Permission, Role, User, UserStatus } from '@/types'

const admin = useAdmin()
const confirm = useConfirm()
const ui = useUiStore()

/* --------------------------- демо-стенд (моки) --------------------------- */

/** Демо-данные сохраняются между сеансами; сброс возвращает исходный набор */
const isDemo = import.meta.env.VITE_USE_MOCKS === 'true'
function askDemoReset(): void {
  confirm.require({
    header: 'Сбросить демо-данные?',
    message: 'Все заявки, правки справочников, пользователи и журнал вернутся к исходному набору. Действие нельзя отменить.',
    acceptProps: { label: 'Сбросить', severity: 'danger' },
    rejectProps: { label: 'Отмена', severity: 'secondary', outlined: true },
    accept: () =>
      void adminApi
        .demoReset()
        .then(() => window.location.reload())
        .catch((e: unknown) => ui.notify('error', 'Не удалось сбросить', errorMessage(e))),
  })
}
onMounted(() => void admin.load())

/* ----------------------------- пользователи ----------------------------- */

const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' })
const userName = (id: string) => admin.users.value.find((u) => u.id === id)?.fullName ?? id

const STATUS: Record<UserStatus, { label: string; dot: string }> = {
  active: { label: 'Активен', dot: 'bg-emerald-500' },
  blocked: { label: 'Заблокирован', dot: 'bg-amber-500' },
  deleted: { label: 'Удалён', dot: 'bg-red-500' },
}

const search = ref('')
const users = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? admin.users.value.filter((u) => `${u.fullName} ${u.login} ${u.position ?? ''}`.toLowerCase().includes(q)) : admin.users.value
})

const userVisible = ref(false)
const editingUser = ref<User | null>(null)
const tempPassword = ref<string | null>(null)

function openUser(u: User | null): void {
  editingUser.value = u
  userVisible.value = true
}

async function saveUser(u: User, password: string): Promise<void> {
  const { id: _id, passwordChangedAt: _p, ...dto } = u
  const ok = editingUser.value ? await admin.saveUser(u) : await admin.createUser({ ...dto, password })
  if (ok) userVisible.value = false
}

function askDelete(u: User): void {
  confirm.require({
    header: `Удалить «${u.login}»?`,
    message: 'Удаление возможно, только если пользователь не фигурирует в журналах. Иначе используйте статус «удалён».',
    acceptProps: { label: 'Удалить', severity: 'danger' },
    rejectProps: { label: 'Отмена', severity: 'secondary', outlined: true },
    accept: () => void admin.deleteUser(u),
  })
}

async function resetPassword(u: User): Promise<void> {
  tempPassword.value = await admin.resetPassword(u)
}

/* --------------------------------- роли --------------------------------- */

const roleVisible = ref(false)
const editingRole = ref<Role | null>(null)
function openRole(r: Role | null): void {
  editingRole.value = r
  roleVisible.value = true
}
function askDeleteRole(r: Role): void {
  confirm.require({
    header: `Удалить роль «${r.name}»?`,
    message: 'Роль, назначенную пользователям или используемую в обходных листах, удалить нельзя.',
    acceptProps: { label: 'Удалить', severity: 'danger' },
    rejectProps: { label: 'Отмена', severity: 'secondary', outlined: true },
    accept: () => void admin.deleteRole(r),
  })
}

const RES: Record<Permission['resource'], string> = { catalog: 'Справочники', classifier: 'Классификаторы', request: 'Заявки', admin: 'Администрирование', audit: 'Журнал действий' }
const ACT: Record<string, string> = { read: 'просмотр', create: 'создание', update: 'изменение', delete: 'удаление', configure: 'настройка', approve: 'согласование' }
const permText = (p: Permission) => `${RES[p.resource]}: ${p.actions.map((a) => ACT[a] ?? a).join(', ')}`

/* ------------------------------- политика ------------------------------- */

const policyDraft = ref<PasswordPolicy | null>(null)
const policy = computed(() => policyDraft.value ?? admin.policy.value)
function editPolicy<K extends keyof PasswordPolicy>(key: K, value: PasswordPolicy[K]): void {
  if (policy.value) policyDraft.value = { ...policy.value, [key]: value }
}
async function savePolicy(): Promise<void> {
  if (!policyDraft.value) return
  await admin.savePolicy(policyDraft.value)
  policyDraft.value = null
}
const POLICY_FLAGS: { key: 'requireUppercase' | 'requireLowercase' | 'requireDigits' | 'requireSpecial'; label: string }[] = [
  { key: 'requireUppercase', label: 'Заглавные буквы' },
  { key: 'requireLowercase', label: 'Строчные буквы' },
  { key: 'requireDigits', label: 'Цифры' },
  { key: 'requireSpecial', label: 'Спецсимволы' },
]
</script>

<template>
  <div>
    <UiPageHeader title="Администрирование" subtitle="Пользователи, роли и парольная политика">
      <template v-if="isDemo" #actions>
        <Button label="Сбросить демо-данные" icon="pi pi-refresh" severity="secondary" outlined @click="askDemoReset" />
      </template>
    </UiPageHeader>
    <Tabs value="users">
      <TabList>
        <Tab value="users">Пользователи <span class="ml-1 text-xs text-ink-3">{{ admin.users.value.length }}</span></Tab>
        <Tab value="roles">Роли <span class="ml-1 text-xs text-ink-3">{{ admin.roles.value.length }}</span></Tab>
        <Tab value="policy">Парольная политика</Tab>
      </TabList>
      <TabPanels class="!px-0">
        <!-- ПОЛЬЗОВАТЕЛИ -->
        <TabPanel value="users">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <InputText v-model="search" placeholder="Поиск по ФИО, логину, должности" class="w-80" aria-label="Поиск пользователей" />
            <Button label="Добавить пользователя" icon="pi pi-user-plus" data-testid="user-add" @click="openUser(null)" />
          </div>
          <div class="overflow-hidden rounded-lg border border-line">
            <div class="grid grid-cols-[1.2fr_1.6fr_130px_150px] gap-4 border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
              <span>Пользователь</span><span>Роли и области</span><span>Статус</span><span />
            </div>
            <UiEmpty v-if="users.length === 0" text="Никого не найдено" />
            <div v-for="u in users" :key="u.id" class="grid grid-cols-[1.2fr_1.6fr_130px_150px] items-center gap-4 border-b border-line px-4 py-3 last:border-b-0">
              <button type="button" class="min-w-0 text-left" @click="openUser(u)">
                <span class="block truncate text-sm font-semibold text-ink hover:text-brand">{{ u.fullName }}</span>
                <span class="block truncate text-xs text-ink-3">
                  <span class="code-font">{{ u.login }}</span><template v-if="u.provider === 'ldap'"> · LDAP</template><template v-if="u.position"> · {{ u.position }}</template>
                </span>
              </button>
              <div class="flex flex-wrap gap-1">
                <span v-if="u.assignments.length === 0" class="text-xs text-ink-3">нет ролей</span>
                <span
                  v-for="(a, i) in u.assignments.slice(0, 3)"
                  :key="i"
                  class="max-w-full truncate rounded bg-brand-soft px-2 py-0.5 text-xs text-brand-dark"
                  :title="`${admin.roleName.value(a.roleId)} · ${admin.scopeText(a.scope)}`"
                >
                  <b class="font-semibold">{{ admin.roleName.value(a.roleId) }}</b> · {{ admin.scopeText(a.scope) }}
                </span>
                <span v-if="u.assignments.length > 3" class="text-xs text-ink-3">+{{ u.assignments.length - 3 }}</span>
              </div>
              <span class="flex flex-col gap-0.5">
                <span class="flex items-center gap-2 text-xs text-ink-2"><i class="h-1.5 w-1.5 rounded-full" :class="STATUS[u.status].dot" />{{ STATUS[u.status].label }}</span>
                <span v-if="u.absence && isAbsent(u)" v-tooltip.top="`${u.absence.reason}, замещает ${userName(u.absence.deputyId)}`" class="w-fit rounded-sm bg-amber-50 px-1.5 text-2xs font-semibold text-[var(--accent)]">
                  отсутствует до {{ dayFmt.format(new Date(u.absence.until)) }}
                </span>
              </span>
              <div class="flex justify-end">
                <Button v-tooltip.top="'Изменить'" icon="pi pi-pencil" text rounded size="small" severity="secondary" @click="openUser(u)" />
                <Button
                  v-tooltip.top="u.status === 'active' ? 'Заблокировать' : 'Активировать'"
                  :icon="u.status === 'active' ? 'pi pi-lock' : 'pi pi-lock-open'"
                  text
                  rounded
                  size="small"
                  severity="secondary"
                  @click="admin.setStatus(u, u.status === 'active' ? 'blocked' : 'active')"
                />
                <Button v-tooltip.top="'Сбросить пароль'" icon="pi pi-key" text rounded size="small" severity="secondary" :disabled="u.provider !== 'local'" @click="resetPassword(u)" />
                <Button v-tooltip.top="'Статус «удалён»'" icon="pi pi-user-minus" text rounded size="small" severity="secondary" :disabled="u.status === 'deleted'" @click="admin.setStatus(u, 'deleted')" />
                <Button v-tooltip.top="'Удалить'" icon="pi pi-trash" text rounded size="small" severity="secondary" @click="askDelete(u)" />
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- РОЛИ -->
        <TabPanel value="roles">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p class="max-w-2xl text-sm text-ink-2">
              Роль — набор прав. Где она действует, задаётся при назначении пользователю: во всей системе, в справочнике или в классификаторе.
            </p>
            <Button label="Создать роль" icon="pi pi-plus" @click="openRole(null)" />
          </div>
          <div class="overflow-hidden rounded-lg border border-line">
            <div v-for="r in admin.roles.value" :key="r.id" class="grid grid-cols-[1fr_1.6fr_110px_92px] items-start gap-4 border-b border-line px-4 py-3.5 last:border-b-0">
              <div class="min-w-0">
                <div class="flex items-center gap-2 text-sm font-semibold text-ink">
                  {{ r.name }}
                  <span v-if="r.system" class="rounded bg-canvas px-1.5 py-0.5 text-2xs font-medium text-ink-3">системная</span>
                </div>
                <div class="text-xs text-ink-3">{{ r.description }}</div>
              </div>
              <ul class="flex flex-col gap-0.5 text-xs text-ink-2">
                <li v-for="(p, i) in r.permissions" :key="i">
                  {{ permText(p) }}
                  <span v-if="p.columnIds !== '*'" class="text-[var(--accent)]"> · только колонки: {{ p.columnIds.join(', ') }}</span>
                  <span v-if="p.rowFilter" class="text-[var(--accent)]"> · ограничение строк</span>
                </li>
              </ul>
              <span class="text-sm text-ink-2">{{ admin.holders(r.id) }} польз.</span>
              <div class="flex justify-end">
                <Button v-tooltip.top="'Изменить'" icon="pi pi-pencil" text rounded size="small" severity="secondary" @click="openRole(r)" />
                <Button v-tooltip.top="r.system ? 'Системную роль удалить нельзя' : 'Удалить'" icon="pi pi-trash" text rounded size="small" severity="secondary" :disabled="r.system" @click="askDeleteRole(r)" />
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- ПОЛИТИКА -->
        <TabPanel value="policy">
          <UiCard v-if="policy" title="Требования к паролям" class="max-w-xl">
            <div class="flex flex-col gap-4">
              <UiField label="Минимальная длина" for-id="pp-len">
                <InputNumber input-id="pp-len" :model-value="policy.minLength" :min="4" :max="128" show-buttons @update:model-value="(v: number) => editPolicy('minLength', v)" />
              </UiField>
              <div class="grid grid-cols-2 gap-2">
                <label v-for="flag in POLICY_FLAGS" :key="flag.key" class="flex items-center gap-2 text-sm">
                  <Checkbox :model-value="policy[flag.key]" binary @update:model-value="(v: boolean) => editPolicy(flag.key, v)" />
                  {{ flag.label }}
                </label>
              </div>
              <UiField label="Период смены пароля, дней (0 — без ограничения)" for-id="pp-age">
                <InputNumber input-id="pp-age" :model-value="policy.maxAgeDays" :min="0" show-buttons @update:model-value="(v: number) => editPolicy('maxAgeDays', v)" />
              </UiField>
              <UiField label="Количество уникальных паролей" for-id="pp-uniq">
                <InputNumber input-id="pp-uniq" :model-value="policy.uniqueHistoryCount" :min="0" show-buttons @update:model-value="(v: number) => editPolicy('uniqueHistoryCount', v)" />
              </UiField>
              <Button label="Сохранить политику" icon="pi pi-check" class="self-end" :disabled="!policyDraft" @click="savePolicy" />
            </div>
          </UiCard>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <UserDialog
      v-model:visible="userVisible"
      :user="editingUser"
      :roles="admin.roles.value"
      :scope-options="admin.scopeOptions.value"
      :password-errors="admin.passwordErrors"
      @save="saveUser"
    />
    <RoleDialog v-model:visible="roleVisible" :role="editingRole" :existing-ids="admin.roles.value.map((r) => r.id)" @save="admin.saveRole" />

    <Dialog :visible="tempPassword !== null" modal header="Временный пароль" class="w-full max-w-sm" @update:visible="tempPassword = null">
      <p class="mb-2 text-sm text-ink-2">Передайте пользователю. При входе он будет обязан сменить пароль.</p>
      <p class="code-font rounded bg-canvas p-3 text-center text-lg">{{ tempPassword }}</p>
    </Dialog>
  </div>
</template>
