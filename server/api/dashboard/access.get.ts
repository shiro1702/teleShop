import { defineEventHandler } from 'h3'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  return {
    ok: true,
    userId: access.userId,
    shopId: access.shopId,
    role: access.role,
  }
})
