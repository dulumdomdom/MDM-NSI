<script setup lang="ts">
// Профиль: мои роли по областям, отсутствие и заместитель, кого я замещаю, смена пароля.
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Password from 'primevue/password'
import Select from 'primevue/select'
import UiCard from '@/components/ui/UiCard.vue'
import UiField from '@/components/ui/UiField.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import { adminApi, authApi, catalogApi, classifierApi, errorMessage } from '@/api'
import { scopeLabel } from '@/lib/rbac'
import { validatePassword } from '@/lib/security/password'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { UserBrief } from '@/api/auth'
import type { PasswordPolicy } from '@/types'

const auth = useAuthStore()
const ui = useUiStore()

const names = ref<Record<string, string>>({})
const policy = ref<PasswordPolicy | null>(null)
const people = ref<UserBrief[]>([])

onMounted(async () => {
  try {
    const [cats, clss] = await Promise.all([catalogApi.list(), classifierApi.list()])
    names.value = Object.fromEntries([...cats, ...clss].map((x) => [x.id, x.name]))
    policy.value = await adminApi.passwordPolicy()
    people.value = (await adminApi.directory()).filter((u) => u.id !== auth.user?.id && !u.fullName.startsWith('Интеграция'))
  } catch {
    /* подписи областей останутся с id — не критично */
  }
})

const roleName = (id: string) => auth.session?.roles.find((r) => r.id === id)?.name ?? id

/* ------------------------- отсутствие и заместитель ------------------------- */

const REASONS = ['Ежегодный отпуск', 'Командировка', 'Больничный', 'Обучение']
const dt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmt = (iso: string) => dt.format(new Date(iso))
const personName = (id: string) => people.value.find((p) => p.id === id)?.fullName ?? id

const absence = computed(() => auth.user?.absence)
const absenceActive = computed(() => !!absence.value && Date.parse(absence.value.from) <= Date.now() && Date.now() <= Date.parse(absence.value.until))
const form = ref<{ reason: string; until: Date | null; deputyId: string | null }>({ reason: REASONS[0] ?? 'Отпуск', until: null, deputyId: null })
const absenceSaving = ref(false)

async function saveAbsence(): Promise<void> {
  if (!form.value.until || !form.value.deputyId) return
  absenceSaving.value = true
  try {
    const until = new Date(form.value.until)
    until.setHours(23, 59, 59)
    await auth.setAbsence({ reason: form.value.reason, until: until.toISOString(), deputyId: form.value.deputyId })
    ui.notify('success', 'Заместитель назначен', `${personName(form.value.deputyId)} получит ваши строки заявок и уведомления`)
  } catch (e) {
    ui.notify('error', 'Не сохранено', errorMessage(e))
  } finally {
    absenceSaving.value = false
  }
}

async function cancelAbsence(): Promise<void> {
  try {
    await auth.clearAbsence()
    ui.notify('success', 'Отсутствие отменено')
  } catch (e) {
    ui.notify('error', 'Не сохранено', errorMessage(e))
  }
}

const own = ref({ old: '', next: '', confirm: '' })
const errors = computed(() => [
  ...(policy.value && own.value.next ? validatePassword(own.value.next, policy.value) : []),
  ...(own.value.confirm && own.value.confirm !== own.value.next ? ['Пароли не совпадают'] : []),
])
const saving = ref(false)

async function change(): Promise<void> {
  saving.value = true
  try {
    await authApi.changePassword({ oldPassword: own.value.old, newPassword: own.value.next })
    ui.notify('success', 'Пароль изменён')
    own.value = { old: '', next: '', confirm: '' }
  } catch (e) {
    ui.notify('error', 'Пароль не изменён', errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <UiPageHeader :title="auth.user?.fullName ?? 'Профиль'" :subtitle="auth.user?.position" />
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
      <UiCard title="Мои роли" flush>
        <div v-for="(a, i) in auth.assignments" :key="i" class="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0">
          <span class="text-sm font-semibold text-ink">{{ roleName(a.roleId) }}</span>
          <span class="text-sm text-ink-2">{{ scopeLabel(a.scope, names) }}</span>
        </div>
        <p v-if="auth.assignments.length === 0" class="px-4 py-4 text-sm text-ink-3">Роли не назначены — обратитесь к администратору</p>
      </UiCard>

      <UiCard title="Отсутствие и заместитель" data-testid="absence-card">
        <div v-if="absence" class="flex flex-col gap-3">
          <div class="flex items-start gap-3 rounded border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
            <i class="pi pi-calendar-times mt-0.5 text-[var(--accent)]" />
            <div>
              <div class="font-semibold text-ink">{{ absence.reason }} · {{ fmt(absence.from) }} — {{ fmt(absence.until) }}</div>
              <div class="text-ink-2">
                Замещает <b>{{ personName(absence.deputyId) }}</b>.
                {{ absenceActive ? 'Ваши строки заявок и уведомления сейчас уходят заместителю.' : 'Начнётся в указанную дату.' }}
              </div>
            </div>
          </div>
          <Button label="Отменить отсутствие" severity="secondary" outlined size="small" class="self-end" @click="cancelAbsence" />
        </div>
        <div v-else class="flex flex-col gap-4">
          <p class="text-sm text-ink-2">На время отпуска или командировки ваши строки заявок и уведомления получит заместитель. Права администратора не передаются.</p>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <UiField label="Причина" for-id="ab-reason">
              <Select v-model="form.reason" input-id="ab-reason" :options="REASONS" fluid />
            </UiField>
            <UiField label="По какое число" for-id="ab-until">
              <DatePicker v-model="form.until" input-id="ab-until" date-format="dd.mm.yy" :min-date="new Date()" show-icon fluid />
            </UiField>
          </div>
          <UiField label="Заместитель" for-id="ab-deputy">
            <Select v-model="form.deputyId" input-id="ab-deputy" :options="people" option-label="fullName" option-value="id" filter placeholder="Выберите сотрудника" fluid>
              <template #option="{ option }">
                <div>
                  <div class="text-sm">{{ option.fullName }}</div>
                  <div class="text-2xs text-ink-3">{{ option.position }}</div>
                </div>
              </template>
            </Select>
          </UiField>
          <Button label="Назначить заместителя" icon="pi pi-user-plus" class="self-end" :loading="absenceSaving" :disabled="!form.until || !form.deputyId" data-testid="absence-save" @click="saveAbsence" />
        </div>
      </UiCard>

      <UiCard v-if="auth.delegations.length" title="Я замещаю" flush>
        <div v-for="d in auth.delegations" :key="d.userId" class="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0">
          <span class="text-sm font-semibold text-ink">{{ d.fullName }}</span>
          <span class="text-sm text-ink-2">до {{ fmt(d.until) }} · {{ d.assignments.length }} назнач.</span>
        </div>
      </UiCard>

      <UiCard v-if="auth.user?.provider === 'local'" title="Смена пароля">
        <div class="flex flex-col gap-4">
          <UiField label="Текущий пароль" for-id="pr-old"><Password v-model="own.old" input-id="pr-old" :feedback="false" toggle-mask fluid /></UiField>
          <UiField label="Новый пароль" for-id="pr-new"><Password v-model="own.next" input-id="pr-new" :feedback="false" toggle-mask fluid /></UiField>
          <UiField label="Повторите пароль" for-id="pr-confirm"><Password v-model="own.confirm" input-id="pr-confirm" :feedback="false" toggle-mask fluid /></UiField>
          <ul v-if="errors.length" class="list-inside list-disc text-xs text-[var(--danger)]">
            <li v-for="e in errors" :key="e">{{ e }}</li>
          </ul>
          <Button label="Сменить пароль" class="self-end" :loading="saving" :disabled="!own.old || !own.next || !own.confirm || errors.length > 0" @click="change" />
        </div>
      </UiCard>
      <UiCard v-else title="Пароль">
        <p class="text-sm text-ink-2">Вход через домен (LDAP): пароль меняется средствами домена.</p>
      </UiCard>
    </div>
  </div>
</template>
