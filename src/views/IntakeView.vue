<script setup lang="ts">
// «Пополнение и корректировка»: ввод наименования → умный поиск → корректировка найденного
// или заявка на новый элемент с полями, разобранными из запроса. Логика — в useIntake.
import { computed, onMounted } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import DynamicForm from '@/components/dynamic/DynamicForm.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import { CONFIDENT_SCORE, useIntake } from '@/composables/useIntake'
import { formatAttribute, textOf } from '@/lib/attributes'
import { useRequestStore } from '@/stores/request'
import type { CatalogElement, ElementCodeStatus } from '@/types'

const intake = useIntake()
const requests = useRequestStore()
onMounted(() => void intake.init())

const displayAttr = computed(() => intake.catalog.value?.displayAttributeId ?? 'name')
const nameOf = (el: CatalogElement) => textOf(el.attributes[displayAttr.value], el.id)
/** Краткая сводка свойств элемента в строке результата */
const summary = (el: CatalogElement) =>
  intake.attributes.value
    .filter((a) => a.id !== displayAttr.value && a.type !== 'blob')
    .map((a) => formatAttribute(a, el.attributes[a.id]))
    .filter(Boolean)
    .slice(0, 4)
    .join(' · ')

const CODE_STATUS: Record<ElementCodeStatus, { label: string; cls: string }> = {
  approved: { label: 'утверждён', cls: 'text-emerald-700' },
  on_approval: { label: 'на согласовании', cls: 'text-brand' },
  rejected: { label: 'отклонён', cls: 'text-red-600' },
}
const attrName = (id: string) => intake.attributes.value.find((a) => a.id === id)?.name ?? id
const matchedBy = (fields: string[]) => [...new Set(fields)].join(', ')

function toggleRecode(classifierId: string, on: boolean): void {
  intake.recode.value = on ? [...intake.recode.value, classifierId] : intake.recode.value.filter((x) => x !== classifierId)
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <UiPageHeader title="Пополнение и корректировка" subtitle="Введите наименование спецификации — система найдёт позицию в справочнике или подготовит заявку на новую">
      <template #actions>
        <Select
          v-if="intake.available.value.length > 1"
          :model-value="intake.catalogId.value"
          :options="intake.available.value"
          option-label="name"
          option-value="id"
          class="w-60"
          aria-label="Справочник"
          data-testid="intake-catalog"
          @update:model-value="(v: string) => intake.selectCatalog(v)"
        />
      </template>
    </UiPageHeader>

    <!-- Поиск -->
    <div v-if="intake.mode.value === 'search'">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="intake.query.value"
          placeholder="Например: Болт М12х50 оцинкованный, шт"
          class="!py-3.5 !text-lg"
          fluid
          autofocus
          aria-label="Наименование спецификации"
          data-testid="intake-query"
        />
      </IconField>
      <p class="mt-2 text-xs text-ink-3">
        Ищется по наименованию, свойствам и шифрам; опечатки, сокращения, «М12/M12», «12х50/12x50» не мешают. Свойства можно указать явно через «;» —
        <span class="code-font text-ink-2">Артикул: BT-12-50; Цена: 120</span>
      </p>

      <!-- Подсказка до ввода -->
      <div v-if="intake.query.value.trim().length < 2" class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div v-for="(s, i) in ['Введите наименование — как в спецификации', 'Нашлось — уточните изменившиеся свойства', 'Не нашлось — отправьте заявку модераторам']" :key="i" class="rounded-lg border border-line p-4">
          <div class="mb-2 grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-dark">{{ i + 1 }}</div>
          <p class="text-sm text-ink-2">{{ s }}</p>
        </div>
      </div>

      <template v-else>
        <div v-if="intake.parsed.value.properties.length" class="mt-4 flex flex-wrap gap-2 text-xs">
          <span v-for="p in intake.parsed.value.properties" :key="p.attributeId" class="rounded bg-brand-soft px-2 py-1 text-brand-dark">
            {{ p.label }}: <b>{{ p.value }}</b>
          </span>
        </div>

        <div class="mt-5 overflow-hidden rounded-lg border border-line" data-testid="intake-results">
          <div class="flex items-center justify-between border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
            <span>Найдено в справочнике «{{ intake.catalog.value?.name }}»</span>
            <span>{{ intake.hits.value.length }}</span>
          </div>
          <div v-if="intake.hits.value.length === 0" class="px-4 py-6 text-sm text-ink-2">Похожих позиций нет.</div>
          <div
            v-for="h in intake.hits.value"
            :key="h.item.id"
            class="grid grid-cols-[1fr_140px_120px] items-center gap-4 border-b border-line px-4 py-3 last:border-b-0"
            :data-testid="`hit-${h.item.id}`"
          >
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-ink">{{ nameOf(h.item) }}</div>
              <div class="truncate text-xs text-ink-3">{{ summary(h.item) }}</div>
              <div v-if="h.item.codes?.length" class="mt-1 flex flex-wrap gap-x-3 text-xs">
                <span v-for="c in h.item.codes" :key="c.classifierId" class="code-font text-brand-dark">{{ c.code }}</span>
              </div>
            </div>
            <div class="text-xs text-ink-3">
              <div class="mb-1 h-1.5 overflow-hidden rounded-full bg-line">
                <div class="h-full rounded-full" :class="h.score >= CONFIDENT_SCORE ? 'bg-emerald-500' : 'bg-brand'" :style="{ width: `${Math.round(h.score * 100)}%` }" />
              </div>
              совпадение {{ Math.round(h.score * 100) }}%
              <div class="truncate" :title="matchedBy(h.matched.map((m) => m.fieldLabel))">по: {{ matchedBy(h.matched.map((m) => m.fieldLabel)) }}</div>
            </div>
            <Button label="Это она" size="small" :outlined="h.score < CONFIDENT_SCORE" :data-testid="`pick-${h.item.id}`" @click="intake.startEdit(h.item)" />
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-4">
          <div>
            <div class="text-sm font-semibold text-ink">Нужной позиции нет?</div>
            <div class="text-xs text-ink-3">Поля заполнятся из введённого, заявка уйдёт модераторам справочника</div>
          </div>
          <Button
            label="Создать заявку на пополнение"
            icon="pi pi-plus"
            :outlined="intake.confident.value"
            :disabled="!intake.ready.value"
            data-testid="intake-new"
            @click="intake.startNew"
          />
        </div>
      </template>
    </div>

    <!-- Корректировка / пополнение -->
    <div v-else-if="intake.mode.value === 'edit' || intake.mode.value === 'new'" class="flex flex-col gap-5">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-soft px-4 py-3">
        <div class="min-w-0">
          <div class="text-2xs font-bold uppercase tracking-[0.08em] text-brand-dark/70">
            {{ intake.mode.value === 'edit' ? 'Корректировка позиции' : 'Заявка на пополнение' }}
          </div>
          <div class="truncate text-base font-bold text-brand-dark">
            {{ intake.mode.value === 'edit' && intake.selected.value ? nameOf(intake.selected.value) : `«${intake.query.value}»` }}
          </div>
        </div>
        <Button label="К результатам поиска" icon="pi pi-arrow-left" severity="secondary" text size="small" @click="intake.backToSearch" />
      </div>

      <UiCard :title="intake.mode.value === 'edit' ? 'Свойства' : 'Данные новой позиции'">
        <p v-if="intake.mode.value === 'new' && intake.autoFilled.value.length" class="mb-4 text-xs text-ink-2">
          <i class="pi pi-sparkles mr-1 text-brand" />Заполнено из запроса: <b>{{ intake.autoFilled.value.map(attrName).join(', ') }}</b>. Проверьте и дополните.
        </p>
        <p v-if="intake.mode.value === 'edit'" class="mb-4 text-xs" :class="intake.changes.value.length ? 'text-[var(--accent)]' : 'text-ink-3'">
          {{ intake.changes.value.length ? `Изменено: ${intake.changes.value.map(attrName).join(', ')}` : 'Измените свойства, которые поменялись' }}
        </p>
        <DynamicForm
          :attributes="intake.attributes.value"
          :model-value="intake.form.model.value"
          :errors="intake.form.errors.value"
          id-prefix="intake"
          @field="intake.form.setField"
        />
        <label v-if="intake.mode.value === 'new' && intake.catalog.value?.hierarchical" class="mt-4 flex max-w-sm flex-col gap-1.5">
          <span class="text-xs font-medium text-ink-2">Группа <span class="font-normal text-ink-3">— от неё зависит, кто шифрует позицию</span></span>
          <Select v-model="intake.parentId.value" :options="intake.groupOptions.value" option-label="label" option-value="id" show-clear placeholder="Корень" input-id="intake-group" @update:model-value="intake.suggestedFrom.value = null" />
          <small v-if="intake.suggestedFrom.value" class="text-2xs text-ink-3" data-testid="group-suggested">
            <i class="pi pi-sparkles mr-1 text-[10px] text-brand" />предложена по похожей позиции «{{ intake.suggestedFrom.value }}»
          </small>
        </label>
      </UiCard>

      <!-- Шифры найденной позиции -->
      <UiCard v-if="intake.mode.value === 'edit' && intake.bindings.value.length" title="Шифры" flush>
        <div v-for="b in intake.bindings.value" :key="b.classifierId" class="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-4 py-3 last:border-b-0">
          <div class="min-w-0">
            <div class="text-sm font-semibold text-ink">{{ intake.classifierName(b.classifierId) }}</div>
            <div v-if="intake.codeOf(b.classifierId)" class="text-xs">
              <span class="code-font text-brand-dark">{{ intake.codeOf(b.classifierId)?.code }}</span>
              <span class="ml-2" :class="CODE_STATUS[intake.codeOf(b.classifierId)!.status].cls">{{ CODE_STATUS[intake.codeOf(b.classifierId)!.status].label }}</span>
            </div>
            <div v-else class="text-xs text-ink-3">шифра нет</div>
          </div>
          <label class="flex items-center gap-2 text-sm text-ink-2">
            <Checkbox
              :model-value="intake.recode.value.includes(b.classifierId)"
              binary
              :data-testid="`recode-${b.classifierId}`"
              @update:model-value="(v: boolean) => toggleRecode(b.classifierId, v)"
            />
            {{ intake.codeOf(b.classifierId) ? 'шифр требует изменения' : 'нужен шифр' }}
          </label>
        </div>
      </UiCard>

      <!-- Куда уйдёт -->
      <div class="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line px-4 py-4">
        <div class="min-w-0 text-sm">
          <template v-if="intake.appliesImmediately.value">
            <b class="text-ink">Корректировка будет внесена сразу</b>
            <div class="text-xs text-ink-3">Шифры не меняются — согласование не требуется</div>
          </template>
          <template v-else>
            <b class="text-ink">Заявка пройдёт обходной лист</b>
            <ol class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
              <li v-for="s in intake.route.value" :key="s.id">
                {{ s.order }}. {{ s.name }}<span v-if="s.optional" class="text-ink-3"> (если применимо)</span>
              </li>
            </ol>
          </template>
        </div>
        <Button
          :label="intake.appliesImmediately.value ? 'Внести корректировку' : 'Отправить заявку'"
          icon="pi pi-send"
          :disabled="!intake.canSubmit.value"
          :loading="intake.submitting.value"
          data-testid="intake-submit"
          @click="intake.submit"
        />
      </div>
    </div>

    <!-- Готово -->
    <UiCard v-else-if="intake.mode.value === 'done' && intake.result.value" data-testid="intake-done">
      <div class="flex flex-col items-start gap-3 py-2">
        <div class="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600"><i class="pi pi-check" /></div>
        <template v-if="intake.result.value.request">
          <h2 class="text-lg font-extrabold text-brand-dark">Заявка № {{ intake.result.value.request.id }} отправлена</h2>
          <p class="text-sm text-ink-2">
            Модераторам пришли уведомления. Когда все строки обходного листа будут пройдены, изменения появятся в справочнике, а вам придёт уведомление.
          </p>
          <ol class="flex flex-col gap-1 text-sm">
            <li v-for="s in intake.result.value.request.steps" :key="s.id" class="text-ink-2">
              {{ s.order }}. {{ s.name }} <span class="text-ink-3">— {{ requests.roleName(s.roleId) }}</span>
            </li>
          </ol>
        </template>
        <h2 v-else class="text-lg font-extrabold text-brand-dark">Изменения внесены в справочник</h2>
        <div class="mt-2 flex gap-2">
          <router-link v-if="intake.result.value.request" :to="{ path: '/requests', query: { id: intake.result.value.request.id } }">
            <Button label="Открыть заявку" severity="secondary" outlined />
          </router-link>
          <Button label="Новый поиск" icon="pi pi-search" data-testid="intake-again" @click="intake.startOver" />
        </div>
      </div>
    </UiCard>
  </div>
</template>
