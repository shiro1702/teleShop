import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])
const MAX_SIZE_BYTES = 8 * 1024 * 1024 // 8MB for short story clips

type Body = {
  fileName?: string
  mimeType?: string
  dataBase64?: string
  kind?: 'preview' | 'slide'
}

function sanitizeFileName(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'upload'
  return cleaned.replace(/\.[a-zA-Z0-9]+$/, '')
}

function getExtension(fileName: string, mimeType: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'video/mp4') return 'mp4'
  if (mimeType === 'video/webm') return 'webm'
  if (mimeType === 'video/quicktime') return 'mov'
  return 'bin'
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const body = await readBody<Body>(event)

  if (!body?.mimeType || !body.dataBase64 || !body.fileName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'fileName, mimeType and dataBase64 are required',
    })
  }
  if (!ALLOWED_MIME.has(body.mimeType)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported media type' })
  }

  const bytes = Buffer.from(body.dataBase64, 'base64')
  if (!bytes.byteLength || bytes.byteLength > MAX_SIZE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'File too large (max 8MB)' })
  }

  const extension = getExtension(body.fileName, body.mimeType)
  const safeName = sanitizeFileName(body.fileName)
  const sub = body.kind === 'preview' ? 'stories/preview' : 'stories/slides'
  const objectPath = `${access.shopId}/${sub}/${Date.now()}-${safeName}.${extension}`

  const client = await serverSupabaseServiceRole(event)
  const upload = await client.storage.from('organization-media').upload(objectPath, bytes, {
    contentType: body.mimeType,
    upsert: true,
  })

  if (upload.error) {
    throw createError({ statusCode: 500, statusMessage: upload.error.message || 'Upload failed' })
  }

  const publicUrl = client.storage.from('organization-media').getPublicUrl(objectPath).data.publicUrl

  return {
    ok: true,
    url: publicUrl,
    path: objectPath,
  }
})
