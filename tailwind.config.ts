import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E25E2D',
          50: '#FFF7ED',
          100: '#FFEDD5',
          600: '#C84E24',
          700: '#B2431F',
        },
      },
    },
  },
}

