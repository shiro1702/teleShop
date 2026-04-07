import { createError, defineEventHandler, readBody } from 'h3'
import type { OrganizationSettings, OrganizationStyleConfig } from '~/types/organization-style'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import {
  getOrganizationSettings,
  getStyleRecord,
  persistStyleRecord,
  validateStyleConfig,
  withAuditEntry,
} from '~/server/utils/organizationStyle'

type SaveStylesBody = {
  data?: OrganizationStyleConfig
  settings?: OrganizationSettings
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can save organization style' })
  }

  const body = await readBody<SaveStylesBody>(event)
  if (!body?.data) {
    throw createError({ statusCode: 400, statusMessage: 'Style payload is required' })
  }

  const errors = validateStyleConfig(body.data)
  if (errors.length) {
    throw createError({ statusCode: 400, statusMessage: errors.join(' ') })
  }

  const current = await getStyleRecord(event, access.shopId)
  const nextStyle: OrganizationStyleConfig = {
    ...current.config,
    tokens: body.data.tokens,
    radii: body.data.radii,
    presetId: body.data.presetId ?? null,
  }
  const nextRecord = withAuditEntry(
    {
      config: nextStyle,
      prevConfig: current.config,
      auditLog: current.auditLog,
    },
    access.userId,
    'save',
    ['Обновлены стили организации'],
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
