import { defineEventHandler } from 'h3'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getOrganizationSettings, getStyleRecord } from '~/server/utils/organizationStyle'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const [record, settings] = await Promise.all([
    getStyleRecord(event, access.shopId),
    getOrganizationSettings(event, access.shopId),
  ])
  return {
    ok: true,
    role: access.role,
    settings,
    data: record.config,
    hasRollback: !!record.prevConfig,
    auditLog: record.auditLog,
  }
})
