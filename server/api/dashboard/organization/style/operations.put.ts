import { createError, defineEventHandler, readBody } from 'h3'
import type { OrganizationSettings, OrganizationStyleConfig } from '~/types/organization-style'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import {
  getOrganizationSettings,
  getStyleRecord,
  persistOrganizationSettings,
  validateOrganizationOperationsSettings,
} from '~/server/utils/organizationStyle'

type SaveOperationsBody = {
  data?: OrganizationStyleConfig
  settings?: OrganizationSettings
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can save organization operations' })
  }

  const body = await readBody<SaveOperationsBody>(event)
  if (!body?.settings) {
    throw createError({ statusCode: 400, statusMessage: 'Organization settings payload is required' })
  }

  const current = await getOrganizationSettings(event, access.shopId)
  const nextSettings: OrganizationSettings = {
    ...current,
    ops: body.settings.ops,
    locale: body.settings.locale,
    tax: body.settings.tax,
  }
  const errors = validateOrganizationOperationsSettings(nextSettings)
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
