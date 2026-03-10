import type { H3Event } from 'h3'
import { getTelegramUserFromEvent } from '../../utils/getTelegramUserFromEvent'

export default defineEventHandler(async (event: H3Event) => {
  const user = await getTelegramUserFromEvent(event)
  return { user: user ?? null }
})

