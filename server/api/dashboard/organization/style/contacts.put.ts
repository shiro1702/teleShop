import { createError, defineEventHandler, readBody } from 'h3'
import type { OrganizationSettings, OrganizationStyleConfig } from '~/types/organization-style'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import {
  getOrganizationSettings,
  getStyleRecord,
  persistOrganizationSettings,
  validateOrganizationSettings,
} from '~/server/utils/organizationStyle'

type SaveContactsBody = {
  data?: OrganizationStyleConfig
  settings?: OrganizationSettings
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can save organization contacts' })
  }

  const body = await readBody<SaveContactsBody>(event)
  if (!body?.settings) {
    throw createError({ statusCode: 400, statusMessage: 'Organization settings payload is required' })
  }

  const current = await getOrganizationSettings(event, access.shopId)
  const nextSettings: OrganizationSettings = {
    ...current,
    contacts: body.settings.contacts,
    ops: body.settings.ops,
    locale: body.settings.locale,
    tax: body.settings.tax,
    legal: body.settings.legal,
  }
  const errors = validateOrganizationSettings(nextSettings)
  if (errors.length) {
    throw createError({ statusCode: 400, statusMessage: errors.join(' ') })
  }

  await persistOrganizationSettings(event, access.shopId, nextSettings)
  const style = await getStyleRecord(event, access.shopId)
  const settings = await getOrganizationSettings(event, access.shopId)
  return {
    ok: true,
    role: access.role,
    settings,
    data: style.config,
    hasRollback: !!style.prevConfig,
    auditLog: style.auditLog,
  }
})
