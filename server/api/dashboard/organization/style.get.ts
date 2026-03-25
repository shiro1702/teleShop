import { defineEventHandler } from 'h3'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getStyleRecord } from '~/server/utils/organizationStyle'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const record = await getStyleRecord(event, access.shopId)
  return {
    ok: true,
    role: access.role,
    data: record.config,
    hasRollback: !!record.prevConfig,
    auditLog: record.auditLog,
  }
})
