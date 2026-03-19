import type { TenantShop } from '~/server/utils/tenant'

declare module 'h3' {
  interface H3EventContext {
    tenant?: {
      shopId: string
      shop: TenantShop
      telegramBotToken: string
      integrationKeys: Record<string, unknown>
      uiSettings: Record<string, unknown>
    }
  }
}

export {}
