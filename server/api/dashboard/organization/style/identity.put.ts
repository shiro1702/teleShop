import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { OrganizationSettings, OrganizationStyleConfig } from '~/types/organization-style'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import {
  getOrganizationSettings,
  getStyleRecord,
  persistOrganizationSettings,
  persistStyleRecord,
  validateStyleConfig,
  withAuditEntry,
} from '~/server/utils/organizationStyle'

type SaveIdentityBody = {
  data?: OrganizationStyleConfig
  settings?: OrganizationSettings
}

function validateIdentitySettings(settings: OrganizationSettings): string[] {
  const errors: string[] = []
  const slug = settings.slug.trim().toLowerCase()
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push('Slug должен быть в формате lowercase-kebab-case.')
  }
  if (settings.displayName.trim().length < 2 || settings.displayName.trim().length > 60) {
    errors.push('Публичное название должно быть от 2 до 60 символов.')
  }
  if (settings.tagline.trim().length > 120) {
    errors.push('Короткий слоган под названием не должен превышать 120 символов.')
  }
  if (settings.cuisine.trim().length > 300) {
    errors.push('Категория кухни не должна превышать 300 символов.')
  }
  return errors
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can save organization identity' })
  }

  const body = await readBody<SaveIdentityBody>(event)
  if (!body?.data || !body?.settings) {
    throw createError({ statusCode: 400, statusMessage: 'Payload is required' })
  }

  const errors = validateStyleConfig(body.data)
  errors.push(...validateIdentitySettings(body.settings))
  if (errors.length) {
    throw createError({ statusCode: 400, statusMessage: errors.join(' ') })
  }

  const normalizedSlug = body.settings.slug.trim().toLowerCase()
  const client = await serverSupabaseServiceRole(event)
  const duplicateSlug = await client
    .from('shops')
    .select('id')
    .eq('slug', normalizedSlug)
    .neq('id', access.shopId)
    .limit(1)
    .maybeSingle<{ id: string }>()
  if (duplicateSlug.error) {
    throw createError({ statusCode: 500, statusMessage: duplicateSlug.error.message || 'Failed to validate slug uniqueness' })
  }
  if (duplicateSlug.data?.id) {
    throw createError({ statusCode: 400, statusMessage: 'Этот slug уже используется другим рестораном.' })
  }

  const currentStyle = await getStyleRecord(event, access.shopId)
  const currentSettings = await getOrganizationSettings(event, access.shopId)
  const nextStyle: OrganizationStyleConfig = {
    ...currentStyle.config,
    identity: body.data.identity,
  }
  const nextSettings: OrganizationSettings = {
    ...currentSettings,
    slug: normalizedSlug,
    displayName: body.settings.displayName,
    tagline: body.settings.tagline,
    cuisine: body.settings.cuisine,
  }

  await persistOrganizationSettings(event, access.shopId, nextSettings)
  const nextRecord = withAuditEntry(
    {
      config: nextStyle,
      prevConfig: currentStyle.config,
      auditLog: currentStyle.auditLog,
    },
    access.userId,
    'save',
    ['Обновлены айдентика и публичные поля организации'],
  )
  await persistStyleRecord(event, access.shopId, nextRecord)

  const settings = await getOrganizationSettings(event, access.shopId)
  return {
    ok: true,
    role: access.role,
    settings,
    data: nextRecord.config,
    hasRollback: !!nextRecord.prevConfig,
    auditLog: nextRecord.auditLog,
  }
})
