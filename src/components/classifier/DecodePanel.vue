<script setup lang="ts">
// Паспорт шифра: шифр на «шильдике», расшифровка, краткое наименование и состав по фасетам.
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import { useClassifier } from '@/composables/useClassifier'

const { store, focusField } = useClassifier()

const code = computed(() => store.parseResult?.code ?? '')
const missing = computed(() => store.issues.filter((i) => i.code === 'required').length)
const pad = (n: number) => String(n).padStart(2, '0')

const copied = ref('')
async function copy(what: 'code' | 'decoded'): Promise<void> {
  const text = what === 'code' ? code.value : store.decodedString
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = what
    setTimeout(() => (copied.value = ''), 1500)
  } catch {
    // Буфер обмена недоступен (не https / запрет браузера) — молча
  }
}
</script>

<template>
  <section class="overflow-hidden rounded-lg border border-line bg-white" data-testid="code-passport">
    <!-- Шильдик -->
    <div class="bg-brand-dark px-4 pb-3.5 pt-3 text-white">
      <div class="flex items-center justify-between">
        <span class="text-2xs font-bold uppercase tracking-[0.12em] text-white/60">Паспорт шифра</span>
        <span
          class="rounded-sm px-1.5 py-0.5 text-2xs font-bold uppercase tracking-[0.06em]"
          :class="store.canSubmit ? 'bg-emerald-500/90 text-white' : code ? 'bg-white/15 text-white/80' : 'bg-white/10 text-white/50'"
        >
          {{ store.canSubmit ? 'Годен' : code ? (missing ? `не хватает ${missing}` : 'есть ошибки') : 'пусто' }}
        </span>
      </div>
      <div class="mt-2 flex items-center gap-2">
        <span class="code-font min-w-0 flex-1 break-all text-[20px] font-bold leading-7 tracking-wide">{{ code || '—' }}</span>
        <Button
          v-if="code"
          v-tooltip.left="copied === 'code' ? 'Скопировано' : 'Копировать шифр'"
          :icon="copied === 'code' ? 'pi pi-check' : 'pi pi-copy'"
          text
          rounded
          size="small"
          class="!text-white/80 hover:!bg-white/10"
          aria-label="Копировать шифр"
          @click="copy('code')"
        />
      </div>
    </div>

    <div class="flex flex-col gap-3 px-4 py-3.5 text-sm">
      <div>
        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="text-2xs font-bold uppercase tracking-[0.08em] text-ink-3">Расшифровка</span>
          <span v-if="store.decoded" class="rounded-sm bg-canvas px-1.5 text-2xs text-ink-3">
            {{ store.decoded.structureId ? `шаблон «${store.decoded.structureName}»` : 'по умолчанию' }}
          </span>
        </div>
        <p class="min-h-[1.5rem] font-medium leading-5 text-ink" data-testid="decoded">{{ store.decodedString || '—' }}</p>
        <button
          v-if="store.decodedString"
          type="button"
          class="mt-1 text-2xs font-semibold text-brand hover:underline"
          @click="copy('decoded')"
        >
          {{ copied === 'decoded' ? 'Скопировано' : 'Копировать расшифровку' }}
        </button>
      </div>

      <div v-if="store.classifier?.shortNameRule" class="border-t border-line pt-3">
        <div class="mb-1 text-2xs font-bold uppercase tracking-[0.08em] text-ink-3">Краткое наименование</div>
        <p class="font-semibold text-brand-dark" data-testid="short-name">{{ (code && store.shortName) || '—' }}</p>
      </div>

      <table v-if="store.visibleFacets.length > 0" class="w-full border-t border-line text-xs">
        <caption class="pb-1.5 pt-3 text-left text-2xs font-bold uppercase tracking-[0.08em] text-ink-3">Состав</caption>
        <tbody>
          <tr
            v-for="f in store.visibleFacets"
            :key="f.facetId"
            class="cursor-pointer border-t border-line/70 hover:bg-brand-soft"
            :class="store.focusFacetId === f.facetId ? 'bg-brand-soft' : ''"
            @click="focusField(f.facetId)"
          >
            <td class="code-font w-7 py-1.5 align-top text-ink-3">{{ pad(f.index + 1) }}</td>
            <td class="py-1.5 pr-2 align-top text-ink-2">{{ f.label }}</td>
            <td class="code-font py-1.5 pr-2 text-right align-top font-bold" :class="f.issues.length && f.value ? 'text-[var(--danger)]' : 'text-brand-dark'">
              {{ f.value || '—' }}
            </td>
            <td class="max-w-[9rem] py-1.5 align-top text-ink">{{ f.options?.find((o) => o.code === f.value)?.name ?? '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
