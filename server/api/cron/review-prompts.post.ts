import { createError, defineEventHandler, getHeader } from 'h3'
import { processDueReviewPrompts } from '~/server/utils/reviewPromptFlow'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secret = String((config as any).cronReviewPromptsSecret || '').trim()
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Cron secret not configured' })
  }
  const header = String(getHeader(event, 'x-cron-secret') || '').trim()
  if (header !== secret) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const processed = await processDueReviewPrompts(event, { limit: 50 })
  return { ok: true, processed }
})
