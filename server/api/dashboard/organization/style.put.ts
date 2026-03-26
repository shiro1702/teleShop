import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { OrganizationStyleConfig } from '~/types/organization-style'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import {
  getOrganizationSettings,
  getStyleRecord,
  persistOrganizationSettings,
  persistStyleRecord,
  validateOrganizationSettings,
  validateStyleConfig,
  withAuditEntry,
} from '~/server/utils/organizationStyle'
import type { OrganizationSettings } from '~/types/organization-style'

type SaveStyleBody = {
  data?: OrganizationStyleConfig
  settings?: OrganizationSettings
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can save organization style' })
  }

  const body = await readBody<SaveStyleBody>(event)
  if (!body?.data) {
    throw createError({ statusCode: 400, statusMessage: 'Style payload is required' })
  }
  if (!body?.settings) {
    throw createError({ statusCode: 400, statusMessage: 'Organization settings payload is required' })
  }

  const errors = validateStyleConfig(body.data)
  errors.push(...validateOrganizationSettings(body.settings))
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

  const current = await getStyleRecord(event, access.shopId)
  const nextSettings: OrganizationSettings = {
    ...body.settings,
    slug: normalizedSlug,
  }
  await persistOrganizationSettings(event, access.shopId, nextSettings)
  const nextRecord = withAuditEntry(
    {
      config: body.data,
      prevConfig: current.config,
      auditLog: current.auditLog,
    },
    access.userId,
    'save',
    ['Обновлены стиль и идентика организации'],
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
