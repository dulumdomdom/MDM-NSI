<script setup lang="ts">
// Вход: локальная учётная запись (SHA-512 + соль на сервере) или LDAP.
// Минимальный экран: знак, одна карточка с формой; способ входа переключается ссылкой под кнопкой.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import { useAuth } from '@/composables/useAuth'
import { errorMessage } from '@/api'
import type { AuthProvider } from '@/types'

const route = useRoute()
const router = useRouter()
const { login } = useAuth()

const form = ref({ login: '', password: '', provider: 'local' as AuthProvider })
const error = ref('')
const loading = ref(false)

const isLdap = computed(() => form.value.provider === 'ldap')
/** Подсказка с демо-учётками — только когда работают моки */
const showDemo = import.meta.env.VITE_USE_MOCKS === 'true'

function toggleProvider(): void {
  form.value.provider = isLdap.value ? 'local' : 'ldap'
  error.value = ''
}

async function submit(): Promise<void> {
  error.value = ''
  loading.value = true
  try {
    await login({ ...form.value })
    const redirect = typeof route.query['redirect'] === 'string' ? route.query['redirect'] : '/'
    await router.replace(redirect)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center bg-canvas px-6 py-10">
    <div class="w-full max-w-[360px]">
      <!-- Знак -->
      <div class="mb-8 flex flex-col items-center text-center">
        <div class="grid h-11 w-11 place-items-center rounded-xl bg-brand-dark">
          <span class="text-lg font-extrabold leading-none text-white">М</span>
        </div>
        <h1 class="mt-4 text-[22px] font-extrabold tracking-[-0.02em] text-brand-dark">MDM НСИ</h1>
        <p class="mt-1 text-sm text-ink-3">Нормативно-справочная информация</p>
      </div>

      <!-- Форма -->
      <form
        class="rounded-xl border border-line bg-white p-7 shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(0_70_128/0.12)]"
        data-testid="login-form"
        @submit.prevent="submit"
      >
        <div class="mb-5 flex items-center justify-between">
          <h2 class="text-base font-bold text-ink">Вход</h2>
          <span v-if="isLdap" class="rounded bg-brand-soft px-2 py-0.5 text-2xs font-semibold text-brand-dark">LDAP</span>
        </div>

        <div class="flex flex-col gap-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-ink-2">{{ isLdap ? 'Доменный логин' : 'Логин' }}</span>
            <InputText id="login" v-model="form.login" autocomplete="username" autofocus fluid data-testid="login-input" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-ink-2">Пароль</span>
            <Password v-model="form.password" input-id="password" :feedback="false" toggle-mask autocomplete="current-password" fluid />
          </label>
          <Message v-if="error" severity="error" size="small" :closable="false">{{ error }}</Message>
          <Button type="submit" label="Войти" :loading="loading" class="mt-2" fluid data-testid="login-submit" />
        </div>

        <button type="button" class="mt-5 w-full text-center text-xs font-medium text-brand hover:text-brand-dark" @click="toggleProvider">
          {{ isLdap ? 'Войти с учётной записью системы' : 'Войти через домен (LDAP)' }}
        </button>
      </form>

      <p v-if="showDemo" class="mt-6 text-center text-2xs leading-5 text-ink-3">
        Демо: <span class="code-font">admin/admin</span> — администратор ·
        <span class="code-font">sokolov</span> — руководитель НСИ · <span class="code-font">petrov</span>, <span class="code-font">belova</span> — модераторы ·
        <span class="code-font">zakharova</span> — нормоконтроль (замещает Орлова) · пароль = логин ·
        <span class="code-font">volkova/volkova</span> — бухгалтер ·
        <span class="code-font">user/user</span> — пользователь · LDAP <span class="code-font">ivanov/ldap</span>
      </p>
    </div>
  </div>
</template>
