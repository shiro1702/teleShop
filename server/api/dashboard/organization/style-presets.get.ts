import { defineEventHandler } from 'h3'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { SYSTEM_STYLE_PRESETS } from '~/server/utils/organizationStyle'

export default defineEventHandler(async (event) => {
  await requireDashboardAccess(event)
  return {
    ok: true,
    items: SYSTEM_STYLE_PRESETS,
  }
})
