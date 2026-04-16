import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type QuickRestoMode = 'mock' | 'http'

export type QuickRestoConfig = {
  mode: QuickRestoMode
  baseUrl: string
  apiKey: string
  strictMode: boolean
  timeoutMs: number
}

export type QuickRestoMenuCategory = {
  externalId: string
  name: string
  sortOrder: number
}

export type QuickRestoMenuItem = {
  externalId: string
  categoryExternalId: string
  name: string
  price: number
  isActive: boolean
}

export type QuickRestoStopListItem = {
  externalProductId: string
  inStopList: boolean
}

type QuickRestoOrderPayload = {
  orderId: string
  orderNumber: string
  total: number
  items: Array<{ externalId: string | null; quantity: number; price: number }>
}

export type QuickRestoClient = {
  healthCheck: () => Promise<{ ok: boolean; message: string }>
  fetchMenu: () => Promise<{ categories: QuickRestoMenuCategory[]; items: QuickRestoMenuItem[] }>
  fetchStopList: (placeId: string) => Promise<QuickRestoStopListItem[]>
  pushOrder: (payload: QuickRestoOrderPayload, idempotencyKey: string) => Promise<{ externalOrderId: string; status: string }>
  validatePromocode: (code: string, amount: number) => Promise<{ valid: boolean; reason?: string; discountAmount?: number }>
  fetchPromocodes: () => Promise<Array<{ code: string; type: 'percent' | 'fixed'; value: number; minOrderAmount: number }>>
}

function getRuntimeDefaults() {
  const config = useRuntimeConfig()
  return {
    mode: String(process.env.QUICKRESTO_MODE || 'mock').toLowerCase() === 'http' ? 'http' : 'mock',
    baseUrl: String(process.env.QUICKRESTO_BASE_URL || config.public?.quickrestoBaseUrl || 'https://api.quickresto.ru'),
    apiKey: String(process.env.QUICKRESTO_API_KEY || ''),
    timeoutMs: Number(process.env.QUICKRESTO_TIMEOUT_MS || 8000),
  }
}

export function resolveQuickRestoConfig(integrationKeys: Record<string, any> | null | undefined): QuickRestoConfig {
  const defaults = getRuntimeDefaults()
  const cfg = integrationKeys?.quickresto && typeof integrationKeys.quickresto === 'object'
    ? integrationKeys.quickresto
    : {}
  const mode: QuickRestoMode = cfg.mode === 'http' || defaults.mode === 'http' ? 'http' : 'mock'
  return {
    mode,
    baseUrl: typeof cfg.baseUrl === 'string' && cfg.baseUrl.trim() ? cfg.baseUrl.trim() : defaults.baseUrl,
    apiKey: typeof cfg.apiKey === 'string' && cfg.apiKey.trim() ? cfg.apiKey.trim() : defaults.apiKey,
    strictMode: cfg.strictMode === true,
    timeoutMs: Number.isFinite(Number(cfg.timeoutMs)) ? Number(cfg.timeoutMs) : defaults.timeoutMs,
  }
}

function createMockClient(): QuickRestoClient {
  return {
    async healthCheck() {
      return { ok: true, message: 'Quick Resto mock adapter is active' }
    },
    async fetchMenu() {
      return {
        categories: [
          { externalId: 'cat-pizza', name: 'Пицца', sortOrder: 10 },
          { externalId: 'cat-drinks', name: 'Напитки', sortOrder: 20 },
        ],
        items: [
          { externalId: 'prod-margherita', categoryExternalId: 'cat-pizza', name: 'Маргарита', price: 690, isActive: true },
          { externalId: 'prod-cola', categoryExternalId: 'cat-drinks', name: 'Кола 0.5', price: 180, isActive: true },
        ],
      }
    },
    async fetchStopList() {
      return [{ externalProductId: 'prod-cola', inStopList: false }]
    },
    async pushOrder(payload, idempotencyKey) {
      return {
        externalOrderId: `qr-${payload.orderId.slice(0, 8)}-${idempotencyKey.slice(0, 8)}`,
        status: 'accepted',
      }
    },
    async validatePromocode(code, amount) {
      const normalized = code.trim().toUpperCase()
      if (normalized === 'QR10' && amount >= 1000) {
        return { valid: true, discountAmount: Math.round(amount * 0.1) }
      }
      return { valid: false, reason: 'Промокод недоступен в mock-контуре' }
    },
    async fetchPromocodes() {
      return [
        { code: 'QR10', type: 'percent', value: 10, minOrderAmount: 1000 },
        { code: 'QR200', type: 'fixed', value: 200, minOrderAmount: 1500 },
      ]
    },
  }
}

function createHttpClient(cfg: QuickRestoConfig): QuickRestoClient {
  const fetchJson = async <T>(path: string, options: { method?: string; body?: any } = {}): Promise<T> => {
    const response = await $fetch.raw(path, {
      baseURL: cfg.baseUrl,
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: options.body,
      timeout: cfg.timeoutMs,
    })
    return response._data as T
  }
  return {
    async healthCheck() {
      try {
        await fetchJson('/health')
        return { ok: true, message: 'Quick Resto HTTP health-check passed' }
      } catch (error: any) {
        return { ok: false, message: error?.data?.statusMessage || error?.message || 'Quick Resto health-check failed' }
      }
    },
    async fetchMenu() {
      const data = await fetchJson<{ categories?: QuickRestoMenuCategory[]; items?: QuickRestoMenuItem[] }>('/menu')
      return { categories: data.categories || [], items: data.items || [] }
    },
    async fetchStopList(placeId: string) {
      const data = await fetchJson<{ items?: QuickRestoStopListItem[] }>(`/places/${encodeURIComponent(placeId)}/stoplist`)
      return data.items || []
    },
    async pushOrder(payload, idempotencyKey) {
      const data = await fetchJson<{ externalOrderId: string; status: string }>('/orders', {
        method: 'POST',
        body: { ...payload, idempotencyKey },
      })
      return { externalOrderId: data.externalOrderId, status: data.status || 'accepted' }
    },
    async validatePromocode(code, amount) {
      const data = await fetchJson<{ valid: boolean; reason?: string; discountAmount?: number }>('/promocodes/validate', {
        method: 'POST',
        body: { code, amount },
      })
      return data
    },
    async fetchPromocodes() {
      const data = await fetchJson<{ items?: Array<{ code: string; type: 'percent' | 'fixed'; value: number; minOrderAmount: number }> }>('/promocodes')
      return data.items || []
    },
  }
}

export function getQuickRestoClient(integrationKeys: Record<string, any> | null | undefined): {
  config: QuickRestoConfig
  client: QuickRestoClient
} {
  const config = resolveQuickRestoConfig(integrationKeys)
  return {
    config,
    client: config.mode === 'http' ? createHttpClient(config) : createMockClient(),
  }
}

export async function enqueueQuickRestoOrderOutbox(
  client: SupabaseClient,
  input: {
    shopId: string
    restaurantId: string | null
    orderId: string
    orderNumber: string
    total: number
    items: Array<{ externalId: string | null; quantity: number; price: number }>
  },
): Promise<void> {
  const idempotencyKey = crypto.randomUUID()
  await client.from('quickresto_order_outbox').upsert({
    shop_id: input.shopId,
    restaurant_id: input.restaurantId,
    order_id: input.orderId,
    idempotency_key: idempotencyKey,
    payload: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      total: input.total,
      items: input.items,
    },
    status: 'pending',
    attempts: 0,
    next_retry_at: null,
    last_error: null,
  }, { onConflict: 'shop_id,order_id' })
}

export async function dispatchQuickRestoOutbox(
  serviceClient: SupabaseClient,
  shopId: string,
  integrationKeys: Record<string, any> | null | undefined,
): Promise<{ sent: number; failed: number }> {
  const { client } = getQuickRestoClient(integrationKeys)
  const { data: rows } = await serviceClient
    .from('quickresto_order_outbox')
    .select('id,shop_id,order_id,idempotency_key,payload,attempts')
    .eq('shop_id', shopId)
    .in('status', ['pending', 'failed'])
    .or('next_retry_at.is.null,next_retry_at.lte.now()')
    .order('created_at', { ascending: true })
    .limit(50)
  let sent = 0
  let failed = 0
  for (const row of rows || []) {
    const payload = (row as any).payload || {}
    try {
      const result = await client.pushOrder(payload, (row as any).idempotency_key)
      await serviceClient.from('quickresto_order_outbox').update({
        status: 'sent',
        external_order_id: result.externalOrderId,
        updated_at: new Date().toISOString(),
        last_error: null,
      }).eq('id', (row as any).id)
      await serviceClient.from('orders').update({
        external_order_id: result.externalOrderId,
        external_status: result.status,
        last_sync_error: null,
      }).eq('id', (row as any).order_id).eq('shop_id', shopId)
      sent += 1
    } catch (error: any) {
      const attempts = Number((row as any).attempts || 0) + 1
      const delayMinutes = Math.min(60, attempts * 5)
      const retryAt = new Date(Date.now() + delayMinutes * 60000).toISOString()
      const message = error?.data?.statusMessage || error?.message || 'Quick Resto dispatch failed'
      await serviceClient.from('quickresto_order_outbox').update({
        status: 'failed',
        attempts,
        last_error: message,
        next_retry_at: retryAt,
        updated_at: new Date().toISOString(),
      }).eq('id', (row as any).id)
      await serviceClient.from('orders').update({
        external_status: 'failed',
        last_sync_error: message,
      }).eq('id', (row as any).order_id).eq('shop_id', shopId)
      failed += 1
    }
  }
  return { sent, failed }
}
