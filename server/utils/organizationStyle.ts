import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type {
  OrganizationStyleAuditEntry,
  OrganizationStyleConfig,
  OrganizationSettings,
  OrganizationStylePreset,
} from '~/types/organization-style'

type PersistedStyleRecord = {
  config: OrganizationStyleConfig
  prevConfig: OrganizationStyleConfig | null
  auditLog: OrganizationStyleAuditEntry[]
}

type DbStyleRow = {
  shop_id: string
  config: unknown
  prev_config: unknown
  audit_log: unknown
}

type DbPresetRow = {
  id: string
  title: string
  mood: string
  config: unknown
}

const TABLE_NAME = 'organization_style_settings'
const PRESETS_TABLE_NAME = 'organization_style_presets'
const MAX_AUDIT_ITEMS = 25
const HEX_RE = /^#[0-9A-Fa-f]{6}$/
const memoryStoreKey = '__organization_style_memory_store__'
const presetsMemoryStoreKey = '__organization_style_presets_memory_store__'

export const SYSTEM_STYLE_PRESETS: OrganizationStylePreset[] = [
  {
    id: 'classic-bistro',
    title: 'Classic Bistro',
    mood: 'Теплый, аппетитный, универсальный',
    config: {
      tokens: {
        brandPrimary: '#B3472A',
        brandSecondary: '#D9A441',
        brandAccent: '#6E3B2A',
        surfaceBackground: '#FFF9F5',
        surfaceCard: '#FFFFFF',
        textPrimary: '#2B211E',
        textMuted: '#6B5C56',
        stateSuccess: '#16A34A',
        stateWarning: '#D97706',
        stateError: '#DC2626',
      },
      radii: { button: 10, modal: 16, input: 10, card: 14 },
    },
  },
  {
    id: 'modern-minimal',
    title: 'Modern Minimal',
    mood: 'Чистый, технологичный, спокойный',
    config: {
      tokens: {
        brandPrimary: '#1F6FEB',
        brandSecondary: '#7AA2F7',
        brandAccent: '#0EA5E9',
        surfaceBackground: '#F7FAFC',
        surfaceCard: '#FFFFFF',
        textPrimary: '#0F172A',
        textMuted: '#475569',
        stateSuccess: '#16A34A',
        stateWarning: '#D97706',
        stateError: '#DC2626',
      },
      radii: { button: 8, modal: 14, input: 8, card: 12 },
    },
  },
  {
    id: 'dark-urban',
    title: 'Dark Urban',
    mood: 'Вечерний, премиальный, контрастный',
    config: {
      tokens: {
        brandPrimary: '#F97316',
        brandSecondary: '#FDBA74',
        brandAccent: '#FB7185',
        surfaceBackground: '#111827',
        surfaceCard: '#1F2937',
        textPrimary: '#F9FAFB',
        textMuted: '#CBD5E1',
        stateSuccess: '#22C55E',
        stateWarning: '#F59E0B',
        stateError: '#EF4444',
      },
      radii: { button: 12, modal: 20, input: 10, card: 16 },
    },
  },
  {
    id: 'soft-cafe',
    title: 'Soft Cafe',
    mood: 'Мягкий, дружелюбный, десертный',
    config: {
      tokens: {
        brandPrimary: '#8B5CF6',
        brandSecondary: '#C4B5FD',
        brandAccent: '#F472B6',
        surfaceBackground: '#FDF4FF',
        surfaceCard: '#FFFFFF',
        textPrimary: '#3B0764',
        textMuted: '#6B21A8',
        stateSuccess: '#16A34A',
        stateWarning: '#D97706',
        stateError: '#DC2626',
      },
      radii: { button: 14, modal: 24, input: 12, card: 18 },
    },
  },
]

export function getDefaultStyleConfig(): OrganizationStyleConfig {
  const first = SYSTEM_STYLE_PRESETS[0]
  return {
    identity: {
      name: 'My Restaurant',
      shortDescription: '',
      fullDescription: '',
      logoUrl: '',
      faviconUrl: '',
      restaurantCardImageUrl: '',
      heroImageUrl: '',
    },
    tokens: { ...first.config.tokens },
    radii: { ...first.config.radii },
    presetId: first.id,
  }
}

async function getIdentityFromExistingData(event: any, shopId: string): Promise<OrganizationStyleConfig['identity']> {
  // MVP: если стиль не создан, берем название/описание/лого из существующих таблиц.
  // Это позволяет сразу увидеть корректную организационную информацию на странице настроек.
  try {
    const client = await serverSupabaseServiceRole(event)

    const [shopRes, restaurantRes] = await Promise.all([
      client
        .from('shops')
        .select('name,ui_settings')
        .eq('id', shopId)
        .maybeSingle<{ name: string; ui_settings: Record<string, unknown> | null }>(),
      client
        .from('restaurants')
        .select('name')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ name: string }>(),
    ])

    const shopData = shopRes?.data
    const restaurantData = restaurantRes?.data

    const restaurantName = typeof restaurantData?.name === 'string' ? restaurantData.name : ''
    const shopName = typeof shopData?.name === 'string' ? shopData.name : ''

    const uiSettings = (shopData?.ui_settings ?? {}) as Record<string, unknown>
    const logoUrl = typeof uiSettings?.logo_url === 'string' ? uiSettings.logo_url : ''
    const description = typeof uiSettings?.description === 'string' ? uiSettings.description : ''

    const base = getDefaultStyleConfig()
    return {
      ...base.identity,
      name: restaurantName || shopName || base.identity.name,
      shortDescription: description,
      fullDescription: description,
      logoUrl,
      faviconUrl: '',
      restaurantCardImageUrl: '',
      heroImageUrl: '',
    }
  } catch (e) {
    return getDefaultStyleConfig().identity
  }
}

export function getDefaultOrganizationSettings(): OrganizationSettings {
  return {
    slug: '',
    displayName: '',
    tagline: '',
    cuisine: '',
    contacts: {
      phone: '',
      max: '',
      telegram: '',
      email: '',
    },
    ops: {
      status: 'open',
      minOrderAmount: 500,
      prepTimeMinutes: 30,
      deliveryFee: 150,
      freeDeliveryFrom: 1000,
      fulfillmentTypes: ['delivery', 'pickup'],
      orderAcceptanceMode: 'manual',
      ordersPaused: false,
      ordersPausedReason: '',
    },
    locale: {
      currency: 'RUB',
      timezone: 'Asia/Irkutsk',
      languages: ['ru'],
    },
    tax: {
      vatMode: 'none',
    },
  }
}

function getMemoryStore(): Map<string, PersistedStyleRecord> {
  const root = globalThis as any
  if (!root[memoryStoreKey]) {
    root[memoryStoreKey] = new Map<string, PersistedStyleRecord>()
  }
  return root[memoryStoreKey] as Map<string, PersistedStyleRecord>
}

function getPresetsMemoryStore(): Map<string, OrganizationStylePreset[]> {
  const root = globalThis as any
  if (!root[presetsMemoryStoreKey]) {
    root[presetsMemoryStoreKey] = new Map<string, OrganizationStylePreset[]>()
  }
  return root[presetsMemoryStoreKey] as Map<string, OrganizationStylePreset[]>
}

function cloneConfig(config: OrganizationStyleConfig): OrganizationStyleConfig {
  return JSON.parse(JSON.stringify(config)) as OrganizationStyleConfig
}

function normalizeAuditEntry(raw: any): OrganizationStyleAuditEntry | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.at !== 'string' || typeof raw.actorUserId !== 'string') return null
  if (raw.action !== 'save' && raw.action !== 'rollback') return null
  const notes = Array.isArray(raw.notes) ? raw.notes.filter((item: unknown) => typeof item === 'string') : []
  return { at: raw.at, actorUserId: raw.actorUserId, action: raw.action, notes }
}

function normalizeConfig(raw: any): OrganizationStyleConfig {
  const defaults = getDefaultStyleConfig()
  const config = raw && typeof raw === 'object' ? raw : {}
  return {
    identity: {
      name: typeof config.identity?.name === 'string' ? config.identity.name : defaults.identity.name,
      shortDescription: typeof config.identity?.shortDescription === 'string' ? config.identity.shortDescription : defaults.identity.shortDescription,
      fullDescription: typeof config.identity?.fullDescription === 'string' ? config.identity.fullDescription : defaults.identity.fullDescription,
      logoUrl: typeof config.identity?.logoUrl === 'string' ? config.identity.logoUrl : defaults.identity.logoUrl,
      faviconUrl: typeof config.identity?.faviconUrl === 'string' ? config.identity.faviconUrl : defaults.identity.faviconUrl,
      restaurantCardImageUrl: typeof config.identity?.restaurantCardImageUrl === 'string'
        ? config.identity.restaurantCardImageUrl
        : defaults.identity.restaurantCardImageUrl,
      heroImageUrl: typeof config.identity?.heroImageUrl === 'string'
        ? config.identity.heroImageUrl
        : defaults.identity.heroImageUrl,
    },
    tokens: {
      brandPrimary: typeof config.tokens?.brandPrimary === 'string' ? config.tokens.brandPrimary : defaults.tokens.brandPrimary,
      brandSecondary: typeof config.tokens?.brandSecondary === 'string' ? config.tokens.brandSecondary : defaults.tokens.brandSecondary,
      brandAccent: typeof config.tokens?.brandAccent === 'string' ? config.tokens.brandAccent : defaults.tokens.brandAccent,
      surfaceBackground: typeof config.tokens?.surfaceBackground === 'string' ? config.tokens.surfaceBackground : defaults.tokens.surfaceBackground,
      surfaceCard: typeof config.tokens?.surfaceCard === 'string' ? config.tokens.surfaceCard : defaults.tokens.surfaceCard,
      textPrimary: typeof config.tokens?.textPrimary === 'string' ? config.tokens.textPrimary : defaults.tokens.textPrimary,
      textMuted: typeof config.tokens?.textMuted === 'string' ? config.tokens.textMuted : defaults.tokens.textMuted,
      stateSuccess: typeof config.tokens?.stateSuccess === 'string' ? config.tokens.stateSuccess : defaults.tokens.stateSuccess,
      stateWarning: typeof config.tokens?.stateWarning === 'string' ? config.tokens.stateWarning : defaults.tokens.stateWarning,
      stateError: typeof config.tokens?.stateError === 'string' ? config.tokens.stateError : defaults.tokens.stateError,
    },
    radii: {
      button: Number.isFinite(config.radii?.button) ? Number(config.radii.button) : defaults.radii.button,
      modal: Number.isFinite(config.radii?.modal) ? Number(config.radii.modal) : defaults.radii.modal,
      input: Number.isFinite(config.radii?.input) ? Number(config.radii.input) : defaults.radii.input,
      card: Number.isFinite(config.radii?.card) ? Number(config.radii.card) : defaults.radii.card,
    },
    presetId: typeof config.presetId === 'string' ? config.presetId : null,
  }
}

function asString(input: unknown, fallback = ''): string {
  return typeof input === 'string' ? input : fallback
}

function asNullableNumber(input: unknown): number | null {
  if (input === null || input === undefined || input === '') return null
  const value = Number(input)
  return Number.isFinite(value) ? value : null
}

function normalizeSettings(raw: unknown): OrganizationSettings {
  const defaults = getDefaultOrganizationSettings()
  const source = raw && typeof raw === 'object' ? raw as any : {}
  const contacts = source.contacts && typeof source.contacts === 'object' ? source.contacts : {}
  const ops = source.ops && typeof source.ops === 'object' ? source.ops : {}
  const locale = source.locale && typeof source.locale === 'object' ? source.locale : {}
  const tax = source.tax && typeof source.tax === 'object' ? source.tax : {}
  const status = ['open', 'closed', 'coming_soon', 'temporarily_unavailable'].includes(ops.status) ? ops.status : defaults.ops.status
  const orderAcceptanceMode = ['auto', 'manual'].includes(ops.orderAcceptanceMode) ? ops.orderAcceptanceMode : defaults.ops.orderAcceptanceMode
  const vatMode = ['none', 'included', 'excluded'].includes(tax.vatMode) ? tax.vatMode : defaults.tax.vatMode
  const fulfillmentRaw = Array.isArray(ops.fulfillmentTypes) ? ops.fulfillmentTypes : defaults.ops.fulfillmentTypes
  const fulfillmentTypes = fulfillmentRaw.filter(
    (item: unknown) => ['delivery', 'pickup', 'dine-in', 'qr-menu', 'showcase-order'].includes(String(item)),
  ) as Array<'delivery' | 'pickup' | 'dine-in' | 'qr-menu' | 'showcase-order'>
  return {
    slug: asString(source.slug, defaults.slug),
    displayName: asString(source.displayName, defaults.displayName),
    tagline: asString(source.tagline, defaults.tagline),
    cuisine: asString(source.cuisine, defaults.cuisine),
    contacts: {
      phone: asString(contacts.phone, defaults.contacts.phone),
      max: asString(contacts.max ?? contacts.whatsapp, defaults.contacts.max),
      telegram: asString(contacts.telegram, defaults.contacts.telegram),
      email: asString(contacts.email, defaults.contacts.email),
    },
    ops: {
      status,
      minOrderAmount: asNullableNumber(ops.minOrderAmount),
      prepTimeMinutes: asNullableNumber(ops.prepTimeMinutes),
      deliveryFee: asNullableNumber(ops.deliveryFee),
      freeDeliveryFrom: asNullableNumber(ops.freeDeliveryFrom),
      fulfillmentTypes: fulfillmentTypes.length ? fulfillmentTypes : defaults.ops.fulfillmentTypes,
      orderAcceptanceMode,
      ordersPaused: Boolean(ops.ordersPaused),
      ordersPausedReason: asString(ops.ordersPausedReason, defaults.ops.ordersPausedReason),
    },
    locale: {
      currency: asString(locale.currency, defaults.locale.currency).toUpperCase().slice(0, 3) || defaults.locale.currency,
      timezone: asString(locale.timezone, defaults.locale.timezone),
      languages: Array.isArray(locale.languages)
        ? locale.languages
          .filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item: string) => item.trim().toLowerCase())
        : defaults.locale.languages,
    },
    tax: {
      vatMode,
    },
  }
}

function canUseFallback(error: any): boolean {
  if (!error) return false
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''
  if (['42P01', '42703', '42501', 'PGRST116', 'PGRST205'].includes(code)) return true
  if (message.includes('does not exist')) return true
  if (message.includes('relation')) return true
  if (message.includes('column')) return true
  if (message.includes('permission denied')) return true
  if (message.includes('no rows')) return true
  // MVP fail-safe: стиль не должен ломать страницу при проблемах с БД-схемой.
  return true
}

function normalizeRecord(raw?: Partial<PersistedStyleRecord> | null): PersistedStyleRecord {
  return {
    config: normalizeConfig(raw?.config),
    prevConfig: raw?.prevConfig ? normalizeConfig(raw.prevConfig) : null,
    auditLog: Array.isArray(raw?.auditLog)
      ? raw!.auditLog!.map(normalizeAuditEntry).filter((item): item is OrganizationStyleAuditEntry => !!item)
      : [],
  }
}

async function loadFromDb(event: any, shopId: string): Promise<PersistedStyleRecord | null> {
  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from(TABLE_NAME)
    .select('shop_id,config,prev_config,audit_log')
    .eq('shop_id', shopId)
    .maybeSingle<DbStyleRow>()

  if (error) {
    console.warn('organization style load fallback:', { code: (error as any)?.code, message: (error as any)?.message })
    if (canUseFallback(error)) return null
    throw createError({ statusCode: 500, statusMessage: 'Failed to load organization style' })
  }

  if (!data) return null
  return normalizeRecord({
    config: data.config as OrganizationStyleConfig,
    prevConfig: (data.prev_config ?? null) as OrganizationStyleConfig | null,
    auditLog: Array.isArray(data.audit_log) ? (data.audit_log as OrganizationStyleAuditEntry[]) : [],
  })
}

async function saveToDb(event: any, shopId: string, record: PersistedStyleRecord): Promise<boolean> {
  const client = await serverSupabaseServiceRole(event)
  const payload = {
    shop_id: shopId,
    config: record.config,
    prev_config: record.prevConfig,
    audit_log: record.auditLog,
  }
  const { error } = await client.from(TABLE_NAME).upsert(payload, { onConflict: 'shop_id' })
  if (!error) return true
  console.warn('organization style save fallback:', { code: (error as any)?.code, message: (error as any)?.message })
  if (canUseFallback(error)) return false
  throw createError({ statusCode: 500, statusMessage: 'Failed to save organization style' })
}

function saveToMemory(shopId: string, record: PersistedStyleRecord) {
  getMemoryStore().set(shopId, normalizeRecord(record))
}

export async function getStyleRecord(event: any, shopId: string): Promise<PersistedStyleRecord> {
  const fromDb = await loadFromDb(event, shopId)
  if (fromDb) return fromDb
  const memory = getMemoryStore().get(shopId)
  if (memory) return normalizeRecord(memory)
  const baseConfig = getDefaultStyleConfig()
  const identity = await getIdentityFromExistingData(event, shopId)
  return normalizeRecord({
    config: {
      ...baseConfig,
      identity,
    },
    prevConfig: null,
    auditLog: [],
  })
}

export async function getOrganizationSettings(event: any, shopId: string): Promise<OrganizationSettings> {
  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('shops')
    .select('slug,name,ui_settings')
    .eq('id', shopId)
    .maybeSingle<{ slug: string; name: string; ui_settings: Record<string, unknown> | null }>()
  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load organization settings' })
  }
  const ui = (data.ui_settings ?? {}) as Record<string, unknown>
  const org = normalizeSettings(ui.organization)
  const displayName = org.displayName || data.name || ''
  return {
    ...org,
    slug: data.slug || '',
    displayName,
  }
}

export async function persistOrganizationSettings(event: any, shopId: string, settings: OrganizationSettings) {
  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('shops')
    .select('ui_settings,name')
    .eq('id', shopId)
    .maybeSingle<{ ui_settings: Record<string, unknown> | null; name: string }>()
  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load current shop settings' })
  }
  const currentUi = (data.ui_settings ?? {}) as Record<string, unknown>
  const normalized = normalizeSettings(settings)
  const nextUi: Record<string, unknown> = {
    ...currentUi,
    organization: normalized,
    logo_url: normalized.displayName ? currentUi.logo_url : currentUi.logo_url,
    description: currentUi.description,
  }
  const payload: Record<string, unknown> = {
    slug: normalized.slug,
    ui_settings: nextUi,
  }
  if (normalized.displayName) payload.name = normalized.displayName
  const update = await client
    .from('shops')
    .update(payload)
    .eq('id', shopId)
    .select('id')
  if (update.error) {
    throw createError({ statusCode: 500, statusMessage: update.error.message || 'Failed to save organization settings' })
  }
}

function normalizePreset(raw: any): OrganizationStylePreset | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return null
  return {
    id: raw.id,
    title: raw.title,
    mood: typeof raw.mood === 'string' ? raw.mood : '',
    isSystem: Boolean(raw.isSystem),
    config: {
      tokens: normalizeConfig({ tokens: raw.config?.tokens }).tokens,
      radii: normalizeConfig({ radii: raw.config?.radii }).radii,
    },
  }
}

export async function getCustomPresets(event: any, shopId: string): Promise<OrganizationStylePreset[]> {
  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from(PRESETS_TABLE_NAME)
    .select('id,title,mood,config')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .returns<DbPresetRow[]>()
  if (error) {
    if (canUseFallback(error)) {
      return (getPresetsMemoryStore().get(shopId) ?? []).map((item) => ({ ...item, isSystem: false }))
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to load custom presets' })
  }
  return (data ?? [])
    .map((row) => normalizePreset({ ...row, isSystem: false }))
    .filter((item): item is OrganizationStylePreset => !!item)
}

export async function createCustomPreset(
  event: any,
  shopId: string,
  actorUserId: string,
  payload: Pick<OrganizationStylePreset, 'title' | 'mood' | 'config'>,
): Promise<OrganizationStylePreset> {
  const title = payload.title.trim()
  if (!title || title.length > 60) {
    throw createError({ statusCode: 400, statusMessage: 'Preset title must be between 1 and 60 chars' })
  }
  const mood = payload.mood.trim().slice(0, 160)
  const config = {
    tokens: normalizeConfig({ tokens: payload.config.tokens }).tokens,
    radii: normalizeConfig({ radii: payload.config.radii }).radii,
  }
  const client = await serverSupabaseServiceRole(event)
  const insert = await client
    .from(PRESETS_TABLE_NAME)
    .insert({
      shop_id: shopId,
      title,
      mood,
      config,
      created_by: actorUserId,
    })
    .select('id,title,mood,config')
    .maybeSingle<DbPresetRow>()
  if (insert.error || !insert.data) {
    if (canUseFallback(insert.error)) {
      const fallback: OrganizationStylePreset = {
        id: `custom-${Date.now()}`,
        title,
        mood,
        config,
        isSystem: false,
      }
      const existing = getPresetsMemoryStore().get(shopId) ?? []
      getPresetsMemoryStore().set(shopId, [fallback, ...existing].slice(0, 50))
      return fallback
    }
    throw createError({ statusCode: 500, statusMessage: insert.error?.message || 'Failed to create custom preset' })
  }
  const normalized = normalizePreset({ ...insert.data, isSystem: false })
  if (!normalized) {
    throw createError({ statusCode: 500, statusMessage: 'Invalid custom preset payload' })
  }
  return normalized
}

export async function persistStyleRecord(event: any, shopId: string, record: PersistedStyleRecord) {
  const normalized = normalizeRecord(record)
  const saved = await saveToDb(event, shopId, normalized)
  if (!saved) saveToMemory(shopId, normalized)
}

export function applyPresetToConfig(config: OrganizationStyleConfig, presetId: string): OrganizationStyleConfig {
  const preset = SYSTEM_STYLE_PRESETS.find((item) => item.id === presetId)
  if (!preset) return config
  return {
    ...config,
    tokens: { ...preset.config.tokens },
    radii: { ...preset.config.radii },
    presetId: preset.id,
  }
}

export function getSystemPresets(): OrganizationStylePreset[] {
  return SYSTEM_STYLE_PRESETS.map((item) => ({ ...item, isSystem: true }))
}

export function validateOrganizationSettings(settings: OrganizationSettings): string[] {
  const errors: string[] = []
  const slug = settings.slug.trim().toLowerCase()
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push('Slug должен быть в формате lowercase-kebab-case.')
  }
  if (settings.displayName.trim().length < 2 || settings.displayName.trim().length > 60) {
    errors.push('Публичное название должно быть от 2 до 60 символов.')
  }
  if (settings.tagline.trim().length > 120) errors.push('Короткий слоган под названием не должен превышать 120 символов.')
  if (settings.cuisine.trim().length > 80) errors.push('Категория кухни не должна превышать 80 символов.')
  if (settings.contacts.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contacts.email)) {
    errors.push('Некорректный email в контактах.')
  }
  const numericChecks: Array<[string, number | null]> = [
    ['minOrderAmount', settings.ops.minOrderAmount],
    ['prepTimeMinutes', settings.ops.prepTimeMinutes],
    ['deliveryFee', settings.ops.deliveryFee],
    ['freeDeliveryFrom', settings.ops.freeDeliveryFrom],
  ]
  for (const [key, value] of numericChecks) {
    if (value !== null && value < 0) errors.push(`Поле ${key} не может быть отрицательным.`)
  }
  if (settings.locale.languages.length === 0) {
    errors.push('Нужен минимум один язык витрины.')
  }
  return errors
}

export function validateStyleConfig(config: OrganizationStyleConfig): string[] {
  const errors: string[] = []
  const name = config.identity.name.trim()
  const shortDescription = config.identity.shortDescription.trim()
  const fullDescription = config.identity.fullDescription.trim()
  if (name.length < 2 || name.length > 60) {
    errors.push('Название ресторана должно содержать от 2 до 60 символов.')
  }
  if (shortDescription.length > 160) {
    errors.push('Короткое описание должно содержать не более 160 символов.')
  }
  if (fullDescription.length > 1000) {
    errors.push('Полное описание должно содержать не более 1000 символов.')
  }

  const tokenEntries = Object.entries(config.tokens)
  for (const [key, value] of tokenEntries) {
    if (!HEX_RE.test(value)) {
      errors.push(`Поле ${key} должно быть в HEX-формате #RRGGBB.`)
    }
  }

  const radiusEntries = Object.entries(config.radii)
  for (const [key, raw] of radiusEntries) {
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0 || value > 32) {
      errors.push(`Скругление ${key} должно быть в диапазоне от 0 до 32.`)
    }
  }
  return errors
}

export function withAuditEntry(
  record: PersistedStyleRecord,
  actorUserId: string,
  action: 'save' | 'rollback',
  notes: string[],
): PersistedStyleRecord {
  const entry: OrganizationStyleAuditEntry = {
    at: new Date().toISOString(),
    actorUserId,
    action,
    notes,
  }
  return {
    config: cloneConfig(record.config),
    prevConfig: record.prevConfig ? cloneConfig(record.prevConfig) : null,
    auditLog: [entry, ...record.auditLog].slice(0, MAX_AUDIT_ITEMS),
  }
}
