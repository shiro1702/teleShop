import { createError, defineEventHandler, readBody } from 'h3'
import type { OrganizationStyleConfig } from '~/types/organization-style'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import {
  getStyleRecord,
  persistStyleRecord,
  validateStyleConfig,
  withAuditEntry,
} from '~/server/utils/organizationStyle'

type SaveStyleBody = {
  data?: OrganizationStyleConfig
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

  const errors = validateStyleConfig(body.data)
  if (errors.length) {
    throw createError({ statusCode: 400, statusMessage: errors.join(' ') })
  }

  const current = await getStyleRecord(event, access.shopId)
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

  return {
    ok: true,
    role: access.role,
    data: nextRecord.config,
    hasRollback: !!nextRecord.prevConfig,
    auditLog: nextRecord.auditLog,
  }
})
