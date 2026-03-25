import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type {
  OrganizationStyleAuditEntry,
  OrganizationStyleConfig,
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

const TABLE_NAME = 'organization_style_settings'
const MAX_AUDIT_ITEMS = 25
const HEX_RE = /^#[0-9A-Fa-f]{6}$/
const memoryStoreKey = '__organization_style_memory_store__'

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
      darkLogoUrl: '',
      faviconUrl: '',
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
      darkLogoUrl: '',
      faviconUrl: '',
    }
  } catch (e) {
    return getDefaultStyleConfig().identity
  }
}

function getMemoryStore(): Map<string, PersistedStyleRecord> {
  const root = globalThis as any
  if (!root[memoryStoreKey]) {
    root[memoryStoreKey] = new Map<string, PersistedStyleRecord>()
  }
  return root[memoryStoreKey] as Map<string, PersistedStyleRecord>
}

function cloneConfig(config: OrganizationStyleConfig): OrganizationStyleConfig {
  return JSON.parse(JSON.stringify(config)) as OrganizationStyleConfig
}

function normalizeAuditEntry(raw: any): OrganizationStyleAuditEntry | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.at !== 'string' || typeof raw.actorUserId !== 'string') return null
  if (raw.action !== 'save' && raw.action !== 'rollback') return null
  const notes = Array.isArray(raw.notes) ? raw.notes.filter((item) => typeof item === 'string') : []
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
      darkLogoUrl: typeof config.identity?.darkLogoUrl === 'string' ? config.identity.darkLogoUrl : defaults.identity.darkLogoUrl,
      faviconUrl: typeof config.identity?.faviconUrl === 'string' ? config.identity.faviconUrl : defaults.identity.faviconUrl,
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
