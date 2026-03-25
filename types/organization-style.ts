export type OrganizationStyleIdentity = {
  name: string
  shortDescription: string
  fullDescription: string
  logoUrl: string
  darkLogoUrl: string
  faviconUrl: string
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

export type OrganizationStylePreset = {
  id: string
  title: string
  mood: string
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
  data: OrganizationStyleConfig
  hasRollback: boolean
  auditLog: OrganizationStyleAuditEntry[]
}
