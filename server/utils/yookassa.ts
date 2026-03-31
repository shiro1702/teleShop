import { createError } from 'h3'

type CreateYooKassaPaymentInput = {
  shopId: string
  secretKey: string
  idempotenceKey: string
  amountRub: number
  description: string
  returnUrl: string
  metadata?: Record<string, string>
}

export type YooKassaCreatePaymentResult = {
  id: string
  status: string
  confirmationUrl: string | null
  raw: Record<string, unknown>
}

function toRubDecimal(amountRub: number): string {
  return (Math.max(0, amountRub) / 100).toFixed(2)
}

function authHeader(shopId: string, secretKey: string): string {
  const credentials = Buffer.from(`${shopId}:${secretKey}`).toString('base64')
  return `Basic ${credentials}`
}

export async function createYooKassaPayment(input: CreateYooKassaPaymentInput): Promise<YooKassaCreatePaymentResult> {
  const body = {
    amount: {
      value: toRubDecimal(input.amountRub),
      currency: 'RUB',
    },
    capture: true,
    confirmation: {
      type: 'redirect',
      return_url: input.returnUrl,
    },
    description: input.description,
    metadata: input.metadata ?? {},
  }

  const res = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(input.shopId, input.secretKey),
      'Idempotence-Key': input.idempotenceKey,
    },
    body: JSON.stringify(body),
  })

  const raw = (await res.json().catch(() => ({}))) as Record<string, any>
  if (!res.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `YooKassa create payment failed (${res.status})`,
      data: raw,
    })
  }

  return {
    id: String(raw.id || ''),
    status: String(raw.status || ''),
    confirmationUrl: typeof raw?.confirmation?.confirmation_url === 'string'
      ? raw.confirmation.confirmation_url
      : null,
    raw,
  }
}
