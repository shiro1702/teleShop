import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
        },
      },
      borderRadius: {
        // MVP: маппим существующие tailwind rounded-* классы на радиусы из настроек ресторана
        // (чтобы без массового рефактора разом начать применять radius preset’ы).
        lg: 'var(--radius-button, 10px)',
        xl: 'var(--radius-modal, 16px)',
        '2xl': 'var(--radius-card, 14px)',
      },
    },
  },
}

