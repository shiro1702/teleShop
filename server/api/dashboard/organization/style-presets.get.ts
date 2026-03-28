import { defineEventHandler } from 'h3'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getCustomPresets, getSystemPresets } from '~/server/utils/organizationStyle'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const [system, custom] = await Promise.all([
    Promise.resolve(getSystemPresets()),
    getCustomPresets(event, access.shopId),
  ])
  return {
    ok: true,
    items: [...system, ...custom],
  }
})
