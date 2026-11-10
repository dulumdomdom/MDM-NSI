// PrimeVue: тема на фирменной палитре, русская локаль, сервисы Toast/Confirm, директива Tooltip.

import type { App } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import { ruLocale } from './primevue-locale'

/** Фирменные цвета: #007dba (500), #004680 (800), #b9e5fa (100), #ffffff */
const BrandPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef8fd',
      100: '#b9e5fa',
      200: '#8dd3f5',
      300: '#55bae9',
      400: '#1f9bd2',
      500: '#007dba',
      600: '#006aa0',
      700: '#005889',
      800: '#004680',
      900: '#003866',
      950: '#00264a',
    },
    // Сдержанная геометрия: небольшие радиусы, компактные поля
    formField: { borderRadius: '6px', paddingY: '0.45rem', paddingX: '0.7rem' },
    content: { borderRadius: '8px' },
    overlay: { modal: { borderRadius: '10px' }, popover: { borderRadius: '8px' }, select: { borderRadius: '8px' } },
    colorScheme: {
      light: {
        // Нейтральная шкала поверхностей
        surface: {
          0: '#ffffff',
          50: '#f9fafb',
          100: '#f2f4f7',
          200: '#e6e8ec',
          300: '#d0d5dd',
          400: '#98a2b3',
          500: '#8a94a6',
          600: '#475467',
          700: '#344054',
          800: '#1d2939',
          900: '#101828',
          950: '#0c111d',
        },
        primary: { color: '{primary.500}', contrastColor: '#ffffff', hoverColor: '{primary.600}', activeColor: '{primary.700}' },
        highlight: { background: '{primary.50}', focusBackground: '{primary.100}', color: '{primary.800}', focusColor: '{primary.900}' },
        formField: { borderColor: '{surface.300}', hoverBorderColor: '{surface.400}', placeholderColor: '{surface.400}' },
      },
    },
  },
  components: {
    button: { root: { borderRadius: '6px', paddingY: '0.45rem', paddingX: '0.85rem', label: { fontWeight: '600' } } },
    datatable: {
      // Шапка таблицы — в фирменном светло-голубом, строки при наведении — в его бледном оттенке
      headerCell: { background: '{primary.50}', color: '{primary.800}', borderColor: '{primary.100}', padding: '0.55rem 0.75rem' },
      bodyCell: { borderColor: '{surface.100}', padding: '0.5rem 0.75rem' },
      row: { hoverBackground: '{primary.50}' },
    },
    tabs: {
      tablist: { background: 'transparent', borderColor: '{surface.200}' },
      tab: { padding: '0.6rem 0.25rem', margin: '0 1.25rem 0 0', fontWeight: '700', activeColor: '{primary.800}' },
      activeBar: { background: '{primary.500}', height: '2px' },
      tabpanel: { background: 'transparent', padding: '1.25rem 0 0 0' },
    },
    // SelectButton: выбранный вариант — фирменный #b9e5fa с тёмно-синим текстом #004680
    togglebutton: {
      root: { borderRadius: '6px', fontWeight: '600' },
      content: { borderRadius: '5px', checkedShadow: '0 0 0 1px {primary.300}' },
      colorScheme: {
        light: {
          root: { background: '{surface.100}', checkedBackground: '{surface.100}', checkedColor: '{primary.800}', color: '{surface.600}', hoverColor: '{primary.800}' },
          content: { checkedBackground: '{primary.100}' },
        },
      },
    },
  },
})

export function installPrimeVue(app: App): void {
  app.use(PrimeVue, {
    locale: ruLocale,
    ripple: false,
    theme: {
      preset: BrandPreset,
      options: {
        // Тёмная тема включается классом (пока не используется) — не зависим от настроек ОС
        darkModeSelector: '.app-dark',
        // Порядок слоёв: утилиты Tailwind могут перекрывать стили PrimeVue
        cssLayer: { name: 'primevue', order: 'tailwind-base, primevue, tailwind-utilities' },
      },
    },
  })
  app.use(ToastService)
  app.use(ConfirmationService)
  app.directive('tooltip', Tooltip)
}
