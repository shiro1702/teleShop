export type OrganizationStyleIdentity = {
  name: string
  shortDescription: string
  fullDescription: string
  logoUrl: string
  faviconUrl: string
  restaurantCardImageUrl: string
  heroImageUrl: string
}

export type OrganizationStyleTokens = {
  brandPrimary: string
  brandSecondary: string
  brandAccent: string
  surfaceBackground: string
  surfaceCard: string
  textPrimary: string
  textMuted: string
  stateSuccess: string
  stateWarning: string
  stateError: string
}

export type OrganizationStyleRadii = {
  button: number
  modal: number
  input: number
  card: number
}

export type OrganizationStyleConfig = {
  identity: OrganizationStyleIdentity
  tokens: OrganizationStyleTokens
  radii: OrganizationStyleRadii
  presetId: string | null
}

export type OrganizationContactSettings = {
  phone: string
  max: string
  telegram: string
  email: string
}

export type OrganizationOpsSettings = {
  status: 'open' | 'closed' | 'coming_soon' | 'temporarily_unavailable'
  minOrderAmount: number | null
  prepTimeMinutes: number | null
  deliveryFee: number | null
  freeDeliveryFrom: number | null
  fulfillmentTypes: Array<'delivery' | 'pickup' | 'dine-in' | 'qr-menu' | 'showcase-order'>
  orderAcceptanceMode: 'auto' | 'manual'
  ordersPaused: boolean
  ordersPausedReason: string
}

export type OrganizationLocaleSettings = {
  currency: string
  timezone: string
  languages: string[]
}

export type OrganizationTaxSettings = {
  vatMode: 'none' | 'included' | 'excluded'
}

export type OrganizationSettings = {
  slug: string
  displayName: string
  tagline: string
  cuisine: string
  contacts: OrganizationContactSettings
  ops: OrganizationOpsSettings
  locale: OrganizationLocaleSettings
  tax: OrganizationTaxSettings
}

export type OrganizationStylePreset = {
  id: string
  title: string
  mood: string
  isSystem?: boolean
  config: Pick<OrganizationStyleConfig, 'tokens' | 'radii'>
}

export type OrganizationStyleAuditEntry = {
  at: string
  actorUserId: string
  action: 'save' | 'rollback'
  notes: string[]
}

export type OrganizationStyleResponse = {
  ok: true
  role: 'owner' | 'manager'
  settings: OrganizationSettings
  data: OrganizationStyleConfig
  hasRollback: boolean
  auditLog: OrganizationStyleAuditEntry[]
}
