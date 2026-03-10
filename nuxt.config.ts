// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-03-05',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  typescript: {
    strict: true,
  },
  runtimeConfig: {
    botToken: process.env.NUXT_BOT_TOKEN ?? '',
    managerChatId: process.env.NUXT_MANAGER_CHAT_ID ?? '',
    appUrl: process.env.NUXT_APP_URL ?? '',
    sessionSecret: process.env.NUXT_SESSION_SECRET ?? '',
    yandexMapsApiKey: process.env.YANDEX_MAPS_API_KEY ?? '',
    public: {
      yandexMapsApiKey: process.env.YANDEX_MAPS_API_KEY ?? '',
    },
  },
  app: {
    head: {
      script: [
        {
          src: 'https://telegram.org/js/telegram-web-app.js',
          tagPosition: 'head',
        },
      ],
    },
  },
})
