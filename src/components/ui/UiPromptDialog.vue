<script setup lang="ts">
// Короткий диалог «введите наименование» — создание справочника, классификатора, атрибута, фасета, блока.
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

const props = defineProps<{ title: string; label?: string; placeholder?: string; submitLabel?: string; hint?: string }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ submit: [value: string] }>()

const value = ref('')
watch(visible, (v) => {
  if (v) value.value = ''
})

function submit(): void {
  const v = value.value.trim()
  if (!v) return
  emit('submit', v)
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="props.title" class="w-full max-w-md" :draggable="false">
    <form class="flex flex-col gap-2" @submit.prevent="submit">
      <label for="prompt-input" class="text-xs font-medium text-ink-2">{{ props.label ?? 'Наименование' }}</label>
      <InputText id="prompt-input" v-model="value" :placeholder="props.placeholder" autofocus fluid data-testid="prompt-input" />
      <small v-if="props.hint" class="text-xs text-ink-3">{{ props.hint }}</small>
      <slot />
    </form>
    <template #footer>
      <Button label="Отмена" severity="secondary" text @click="visible = false" />
      <Button :label="props.submitLabel ?? 'Создать'" :disabled="!value.trim()" data-testid="prompt-submit" @click="submit" />
    </template>
  </Dialog>
</template>
