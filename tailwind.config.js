/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      // Фирменная палитра. Те же значения — в src/plugins/primevue.ts (preset темы)
      colors: {
        brand: {
          DEFAULT: '#007dba',
          dark: '#004680',
          light: '#b9e5fa',
          soft: '#eef7fc',
          white: '#ffffff',
        },
        // Нейтральные: текст трёх уровней, линии, фон приложения
        ink: { DEFAULT: '#101828', 2: '#475467', 3: '#8a94a6' },
        line: { DEFAULT: '#e6e8ec', strong: '#d0d5dd' },
        canvas: '#f5f6f8',
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"Cascadia Mono"', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      fontSize: {
        // Плотная интерфейсная шкала
        '2xs': ['11px', '14px'],
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        base: ['14px', '20px'],
      },
    },
  },
  plugins: [],
}
