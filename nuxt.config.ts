// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-03-05',
  devtools: { enabled: true },
  // Workaround for intermittent source-map wasm crashes in Nuxt dev error parser.
  sourcemap: {
    client: false,
    server: false,
  },
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
    /** Telegram transport mode: direct (legacy) | relay (via Vercel relay service) */
    telegramTransport: process.env.NUXT_TELEGRAM_TRANSPORT ?? 'direct',
    /** Relay endpoint for Telegram methods, e.g. https://<relay>.vercel.app/api/telegram/send */
    telegramRelayUrl: process.env.NUXT_TELEGRAM_RELAY_URL ?? '',
    /** Shared secret between main backend and relay service (x-relay-secret). */
    relaySharedSecret: process.env.NUXT_RELAY_SHARED_SECRET ?? '',
    /** Minutes after handed_to_customer before sending review prompt (Telegram / Max). */
    reviewPromptDelayMinutes: Number(process.env.NUXT_REVIEW_PROMPT_DELAY_MIN ?? '45'),
    /** Secret for POST /api/cron/review-prompts (header x-cron-secret). */
    cronReviewPromptsSecret: process.env.NUXT_CRON_REVIEW_PROMPTS_SECRET ?? '',
    vkIdClientSecret: process.env.NUXT_VK_ID_CLIENT_SECRET ?? '',
    /** Must match redirect URL in VK ID app settings (e.g. https://your.app/api/auth/vk-id/callback) */
    vkIdRedirectUri: process.env.NUXT_VK_ID_REDIRECT_URI ?? '',
    /** OAuth host: id.vk.com or id.vk.ru per VK ID docs */
    vkIdBaseUrl: process.env.NUXT_VK_ID_BASE_URL ?? 'https://id.vk.com',
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    public: {
      platformBaseDomain: process.env.NUXT_PLATFORM_BASE_DOMAIN ?? '',
      defaultCitySlug: process.env.NUXT_DEFAULT_CITY_SLUG ?? 'ulan-ude',
      yandexMapsApiKey: process.env.YANDEX_MAPS_API_KEY ?? '',
      telegramBotName: process.env.NUXT_PUBLIC_TELEGRAM_BOT_NAME ?? process.env.NUXT_TELEGRAM_BOT_NAME ?? '',
      maxBotUrl: process.env.NUXT_PUBLIC_MAX_BOT_URL ?? process.env.NUXT_MAX_BOT_URL ?? '',
      pickupPointsJson: process.env.NUXT_PICKUP_POINTS_JSON ?? '',
      fulfillmentTypes: process.env.NUXT_FULFILLMENT_TYPES ?? 'delivery,pickup,qr-menu',
      dadataToken: process.env.DADATA_TOKEN ?? '',
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseKey: process.env.SUPABASE_KEY ?? '',
      /** Public VK ID app id (same as NUXT_VK_ID_CLIENT_ID); used for «Войти через VK» button */
      vkIdClientId: process.env.NUXT_PUBLIC_VK_ID_CLIENT_ID ?? process.env.NUXT_VK_ID_CLIENT_ID ?? '',
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
          src: '/js/telegram-web-app.js',
          tagPosition: 'head',
        },
        {
          src: '/js/max-web-app.js',
          tagPosition: 'head',
        },
      ],
    },
  },
})
