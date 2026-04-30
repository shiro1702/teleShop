export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()
  
  // Map non-public environment variables to public config at runtime
  // This is needed because Docker passes NUXT_TELEGRAM_BOT_NAME instead of NUXT_PUBLIC_TELEGRAM_BOT_NAME
  if (process.env.NUXT_TELEGRAM_BOT_NAME && !config.public.telegramBotName) {
    config.public.telegramBotName = process.env.NUXT_TELEGRAM_BOT_NAME
  }
  
  if (process.env.NUXT_MAX_BOT_URL && !config.public.maxBotUrl) {
    config.public.maxBotUrl = process.env.NUXT_MAX_BOT_URL
  }
})
