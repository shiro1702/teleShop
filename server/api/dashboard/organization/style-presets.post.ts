import { createError, defineEventHandler, readBody } from 'h3'
import type { OrganizationStylePreset } from '~/types/organization-style'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { createCustomPreset } from '~/server/utils/organizationStyle'

type CreatePresetBody = {
  title?: string
  mood?: string
  config?: OrganizationStylePreset['config']
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can create custom presets' })
  }

  const body = await readBody<CreatePresetBody>(event)
  if (!body?.title || !body?.config) {
    throw createError({ statusCode: 400, statusMessage: 'Preset title and config are required' })
  }

  const created = await createCustomPreset(event, access.shopId, access.userId, {
    title: body.title,
    mood: body.mood ?? '',
    config: body.config,
  })

  return {
    ok: true,
    item: created,
  }
})
