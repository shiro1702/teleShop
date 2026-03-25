import { createError, defineEventHandler } from 'h3'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getStyleRecord, persistStyleRecord, withAuditEntry } from '~/server/utils/organizationStyle'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can rollback organization style' })
  }

  const current = await getStyleRecord(event, access.shopId)
  if (!current.prevConfig) {
    throw createError({ statusCode: 400, statusMessage: 'No previous style state for rollback' })
  }

  const nextRecord = withAuditEntry(
    {
      config: current.prevConfig,
      prevConfig: null,
      auditLog: current.auditLog,
    },
    access.userId,
    'rollback',
    ['Выполнен rollback стиля организации'],
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
