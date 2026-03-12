import { defineEventHandler, readBody, createError } from 'h3'

interface BridgeItemInput {
  id: string
  quantity: number
}

interface BridgeRequestBody {
  items: BridgeItemInput[]
}

function encodeItems(items: BridgeItemInput[]): string {
  // Формат: 1x2,5x1 (id x qty), только цифры и запятые/буквы до base64url
  const compact = items
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.id}x${item.quantity}`)
    .join(',')

  return Buffer.from(compact, 'utf8').toString('base64url')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const botName = (config.public as any).telegramBotName as string | undefined
  const appUrl = config.appUrl as string

  if (!botName) {
    throw createError({ statusCode: 500, message: 'telegramBotName is not configured' })
  }

  const body = await readBody<BridgeRequestBody | null>(event)
  if (!body?.items?.length) {
    throw createError({ statusCode: 400, message: 'Expected items for bridge token' })
  }

  const token = encodeItems(body.items)

  // deep link в Mini App с startapp=<token>
  const deepLink = `https://t.me/${botName}?startapp=${encodeURIComponent(token)}`

  // дополнительный URL на саму web-версию Mini App (на случай, если нужно)
  const webAppUrl = appUrl || ''

  return {
    ok: true,
    token,
    deepLink,
    webAppUrl,
  }
})

