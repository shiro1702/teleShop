import { createError } from 'h3'

export type FulfillmentType = 'delivery' | 'pickup' | 'qr-menu'

export type MenuTimeWindow = {
  days: number[]
  start: string
  end: string
}

const HH_MM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function timeToMinutes(value: string): number {
  const match = HH_MM_RE.exec(value)
  if (!match) return -1
  return Number(match[1]) * 60 + Number(match[2])
}

export function normalizeTimeWindows(input: unknown): MenuTimeWindow[] {
  if (!Array.isArray(input)) return []

  const out: MenuTimeWindow[] = []
  for (const row of input) {
    if (!row || typeof row !== 'object') continue
    const rawDays = Array.isArray((row as any).days) ? (row as any).days : []
    const rawStart = typeof (row as any).start === 'string' ? (row as any).start.trim() : ''
    const rawEnd = typeof (row as any).end === 'string' ? (row as any).end.trim() : ''

    const days = Array.from(
      new Set(
        rawDays
          .map((d) => Number(d))
          .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
      ),
    ).sort((a, b) => a - b)

    if (!days.length) continue
    if (!HH_MM_RE.test(rawStart) || !HH_MM_RE.test(rawEnd)) continue
    if (timeToMinutes(rawStart) >= timeToMinutes(rawEnd)) continue

    out.push({ days, start: rawStart, end: rawEnd })
  }

  return out
}

export function assertValidTimeWindows(input: unknown): MenuTimeWindow[] {
  const normalized = normalizeTimeWindows(input)
  if (!Array.isArray(input)) return normalized
  if (normalized.length !== input.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid time windows format',
    })
  }
  return normalized
}

export function resolveDeliveryRestricted(
  productDeliveryRestricted: boolean | null | undefined,
  categoryDeliveryRestricted: boolean | null | undefined,
): boolean {
  if (productDeliveryRestricted === true) return true
  if (productDeliveryRestricted === false) return false
  return !!categoryDeliveryRestricted
}

function isNowWithinWindows(windows: MenuTimeWindow[], now: Date): boolean {
  if (!windows.length) return true
  const day = now.getDay()
  const minutes = now.getHours() * 60 + now.getMinutes()
  return windows.some((w) => {
    if (!w.days.includes(day)) return false
    const start = timeToMinutes(w.start)
    const end = timeToMinutes(w.end)
    return minutes >= start && minutes < end
  })
}

export function resolveEffectiveTimeWindows(
  productWindows: MenuTimeWindow[],
  categoryWindows: MenuTimeWindow[],
): MenuTimeWindow[] {
  return productWindows.length ? productWindows : categoryWindows
}

export function evaluateMenuAvailability(input: {
  fulfillmentType: FulfillmentType
  productDeliveryRestricted?: boolean | null
  categoryDeliveryRestricted?: boolean | null
  productTimeWindows?: MenuTimeWindow[]
  categoryTimeWindows?: MenuTimeWindow[]
  now?: Date
}): {
  isOrderable: boolean
  reason: string | null
  deliveryRestrictedEffective: boolean
  effectiveTimeWindows: MenuTimeWindow[]
} {
  const now = input.now ?? new Date()
  const productWindows = Array.isArray(input.productTimeWindows) ? input.productTimeWindows : []
  const categoryWindows = Array.isArray(input.categoryTimeWindows) ? input.categoryTimeWindows : []
  const deliveryRestrictedEffective = resolveDeliveryRestricted(
    input.productDeliveryRestricted,
    input.categoryDeliveryRestricted,
  )
  const effectiveTimeWindows = resolveEffectiveTimeWindows(productWindows, categoryWindows)

  if (input.fulfillmentType === 'delivery' && deliveryRestrictedEffective) {
    return {
      isOrderable: false,
      reason: 'Доступно только в ресторане, самовывозе или QR-меню',
      deliveryRestrictedEffective,
      effectiveTimeWindows,
    }
  }

  if (!isNowWithinWindows(effectiveTimeWindows, now)) {
    return {
      isOrderable: false,
      reason: 'Сейчас недоступно по расписанию',
      deliveryRestrictedEffective,
      effectiveTimeWindows,
    }
  }

  return {
    isOrderable: true,
    reason: null,
    deliveryRestrictedEffective,
    effectiveTimeWindows,
  }
}
