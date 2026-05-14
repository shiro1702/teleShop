/** Telegram callback_data: rt_<hexToken>_<1-5|e> where e = show stars again */

const PREFIX = 'rt_'

export type ParsedReviewTokenCallback =
  | { ok: true; token: string; action: 'rate'; stars: number }
  | { ok: true; token: string; action: 'edit' }
  | { ok: false; reason: string }

export function parseReviewTokenCallback(data: string): ParsedReviewTokenCallback {
  const raw = typeof data === 'string' ? data.trim() : ''
  if (!raw.startsWith(PREFIX)) {
    return { ok: false, reason: 'not_review_prompt' }
  }
  const rest = raw.slice(PREFIX.length)
  const lastUnderscore = rest.lastIndexOf('_')
  if (lastUnderscore <= 0 || lastUnderscore >= rest.length - 1) {
    return { ok: false, reason: 'malformed' }
  }
  const token = rest.slice(0, lastUnderscore).trim()
  const tail = rest.slice(lastUnderscore + 1).trim().toLowerCase()
  if (!/^[0-9a-f]{10,24}$/i.test(token)) {
    return { ok: false, reason: 'bad_token' }
  }
  if (tail === 'e' || tail === 'edit') {
    return { ok: true, token, action: 'edit' }
  }
  const stars = Number(tail)
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return { ok: false, reason: 'bad_stars' }
  }
  return { ok: true, token, action: 'rate', stars: Math.round(stars) }
}

export function buildReviewCallbackData(token: string, part: number | 'edit'): string {
  const safe = token.trim().toLowerCase()
  if (part === 'edit') return `${PREFIX}${safe}_e`
  return `${PREFIX}${safe}_${part}`
}

export function reviewPromptPlainText(orderRef: string): string {
  return [`Как вам заказ ${orderRef}?`, 'Оцените от 1 до 5 звёзд (нажмите на звезду).'].join('\n')
}

export function telegramStarKeyboardRows(token: string): Array<Array<Record<string, string>>> {
  const row = [1, 2, 3, 4, 5].map((n) => ({
    text: '⭐',
    callback_data: buildReviewCallbackData(token, n),
  }))
  return [row]
}

export function telegramChangeRatingRow(token: string): Array<Array<Record<string, string>>> {
  return [[{ text: 'Изменить оценку', callback_data: buildReviewCallbackData(token, 'edit') }]]
}

export function maxStarLinkAttachments(maxBotUrl: string, orderId: string): Array<Record<string, unknown>> {
  const base = maxBotUrl.replace(/\/$/, '')
  const sep = base.includes('?') ? '&' : '?'
  const row = [1, 2, 3, 4, 5].map((n) => {
    const startapp = `reviewrate_${orderId}_${n}`
    const url = `${base}${sep}startapp=${encodeURIComponent(startapp)}`
    return { type: 'link' as const, text: `${n}★`, url }
  })
  return [
    {
      type: 'inline_keyboard',
      payload: { buttons: [row] },
    },
  ]
}

export function parseMaxReviewRateStartPayload(raw: string): { orderId: string; stars: number } | null {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s.startsWith('reviewrate_')) return null
  const rest = s.slice('reviewrate_'.length)
  const lastUnderscore = rest.lastIndexOf('_')
  if (lastUnderscore <= 0) return null
  const orderId = rest.slice(0, lastUnderscore).trim().toLowerCase()
  const stars = Number(rest.slice(lastUnderscore + 1))
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(orderId) || !Number.isFinite(stars) || stars < 1 || stars > 5) {
    return null
  }
  return { orderId, stars: Math.round(stars) }
}
