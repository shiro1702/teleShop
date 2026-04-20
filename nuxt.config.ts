// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-03-05',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],
  typescript: {
    strict: true,
  },
  runtimeConfig: {
    botToken: process.env.NUXT_BOT_TOKEN ?? '',
    managerChatId: process.env.NUXT_MANAGER_CHAT_ID ?? '',
    appUrl: process.env.NUXT_APP_URL ?? '',
    sessionSecret: process.env.NUXT_SESSION_SECRET ?? '',
    yandexMapsApiKey: process.env.YANDEX_MAPS_API_KEY ?? '',
    yandexGeocoderApiKey: process.env.YANDEX_GEOCODER_API_KEY ?? '',
    maxApiBaseUrl: process.env.NUXT_MAX_API_BASE_URL ?? '',
    maxApiToken: process.env.NUXT_MAX_API_TOKEN ?? '',
    /** Валидация initData мини-приложения MAX (HMAC WebAppData); при отсутствии — fallback на maxApiToken. */
    maxMiniAppBotToken: process.env.NUXT_MAX_MINIAPP_BOT_TOKEN ?? '',
    maxWebhookSecret: process.env.NUXT_MAX_WEBHOOK_SECRET ?? '',
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    public: {
      platformBaseDomain: process.env.NUXT_PLATFORM_BASE_DOMAIN ?? '',
      defaultCitySlug: process.env.NUXT_DEFAULT_CITY_SLUG ?? 'ulan-ude',
      yandexMapsApiKey: process.env.YANDEX_MAPS_API_KEY ?? '',
      telegramBotName: process.env.NUXT_TELEGRAM_BOT_NAME ?? '',
      maxBotUrl: process.env.NUXT_MAX_BOT_URL ?? '',
      pickupPointsJson: process.env.NUXT_PICKUP_POINTS_JSON ?? '',
      fulfillmentTypes: process.env.NUXT_FULFILLMENT_TYPES ?? 'delivery,pickup,qr-menu',
      dadataToken: process.env.DADATA_TOKEN ?? '',
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseKey: process.env.SUPABASE_KEY ?? '',
    },
  },
  supabase: {
    redirect: false,
    // serviceKey используется только на сервере через serverSupabaseServiceRole
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  app: {
    head: {
      script: [
        {
          src: 'https://telegram.org/js/telegram-web-app.js',
          tagPosition: 'head',
        },
        {
          src: 'https://st.max.ru/js/max-web-app.js',
          tagPosition: 'head',
        },
      ],
    },
  },
})
