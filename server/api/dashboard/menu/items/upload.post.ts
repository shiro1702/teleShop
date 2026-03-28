import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB

type UploadMediaBody = {
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
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'bin'
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  // Both owner and manager can upload product images

  const body = await readBody<UploadMediaBody>(event)
  if (!body?.mimeType || !body.dataBase64 || !body.fileName) {
    throw createError({ statusCode: 400, statusMessage: 'fileName, mimeType and dataBase64 are required' })
  }
  if (!ALLOWED_MIME.has(body.mimeType)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported media type. Allowed: PNG, JPEG, WEBP' })
  }

  const bytes = Buffer.from(body.dataBase64, 'base64')
  if (!bytes.byteLength || bytes.byteLength > MAX_SIZE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'File size must be between 1B and 2MB' })
  }

  const extension = getExtension(body.fileName, body.mimeType)
  const safeName = sanitizeFileName(body.fileName)
  const objectPath = `${access.shopId}/products/${Date.now()}-${safeName}.${extension}`
  
  const client = await serverSupabaseServiceRole(event)
  const upload = await client
    .storage
    .from('organization-media')
    .upload(objectPath, bytes, {
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
