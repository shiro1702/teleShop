import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { resolveCustomerIdentityOrThrow, resolveFestivalOrThrow } from '~/server/utils/festivalUgc'

const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const MAX_SIZE_BYTES = 20 * 1024 * 1024

type Body = {
  fileName?: string
  mimeType?: string
  dataBase64?: string
}

function sanitizeFileName(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'upload'
  return cleaned.replace(/\.[a-zA-Z0-9]+$/, '')
}

function getExtension(fileName: string, mimeType: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName
  if (mimeType === 'video/mp4') return 'mp4'
  if (mimeType === 'video/webm') return 'webm'
  if (mimeType === 'video/quicktime') return 'mov'
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'bin'
}

export default defineEventHandler(async (event) => {
  const festivalSlug = getRouterParam(event, 'festival_slug')
  if (!festivalSlug) {
    throw createError({ statusCode: 400, statusMessage: 'festival_slug is required' })
  }

  const body = await readBody<Body>(event).catch(() => ({}))
  if (!body?.fileName || !body?.mimeType || !body?.dataBase64) {
    throw createError({ statusCode: 400, statusMessage: 'fileName, mimeType and dataBase64 are required' })
  }
  if (!ALLOWED_MIME.has(body.mimeType)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported media type' })
  }

  const bytes = Buffer.from(body.dataBase64, 'base64')
  if (!bytes.byteLength || bytes.byteLength > MAX_SIZE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'File too large (max 20MB)' })
  }

  const { shopId } = await requireTenantShop(event)
  const festival = await resolveFestivalOrThrow(event, festivalSlug)
  const identity = await resolveCustomerIdentityOrThrow(event)
  const client = await serverSupabaseServiceRole(event)

  const extension = getExtension(body.fileName, body.mimeType)
  const safeName = sanitizeFileName(body.fileName)
  const objectPath = `${shopId}/festival/${festival.id}/ugc/${identity.profileId}/${Date.now()}-${safeName}.${extension}`

  const upload = await client.storage.from('organization-media').upload(objectPath, bytes, {
    contentType: body.mimeType,
    upsert: true,
  })
  if (upload.error) {
    throw createError({ statusCode: 500, statusMessage: upload.error.message || 'Upload failed' })
  }

  const publicUrl = client.storage.from('organization-media').getPublicUrl(objectPath).data.publicUrl
  return { ok: true, url: publicUrl, path: objectPath, mimeType: body.mimeType }
})
