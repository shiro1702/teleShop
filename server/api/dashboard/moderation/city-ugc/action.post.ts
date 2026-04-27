import { createError, defineEventHandler, readBody } from 'h3'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { applyFestivalModerationAction } from '~/server/utils/festivalUgcModeration'

type Body = {
  submissionId?: string
  action?: 'approve_menu' | 'approve_feed' | 'approve_menu_and_feed' | 'reject' | 'forward_to_corner' | 'shadow_ban' | 'tag_category'
  category?: 'live' | 'food' | 'stage' | 'vibe' | 'quest' | null
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can moderate city UGC' })
  }

  const body = await readBody<Body>(event).catch(() => ({}))
  const submissionId = body.submissionId?.trim()
  if (!submissionId) {
    throw createError({ statusCode: 400, statusMessage: 'submissionId is required' })
  }
  const action = body.action || 'reject'
  const allowed = new Set(['approve_menu', 'approve_feed', 'approve_menu_and_feed', 'reject', 'forward_to_corner', 'shadow_ban', 'tag_category'])
  if (!allowed.has(action)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid action' })
  }

  const result = await applyFestivalModerationAction(event, {
    submissionId,
    action: action as any,
    category: body.category || null,
    actorChannel: 'dashboard',
    actorUserId: access.userId,
  })

  return { ok: true, status: result.status }
})
