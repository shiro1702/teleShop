/**
 * Evaluate whether a story campaign's `targeting` jsonb matches the viewer context.
 * Empty `{}` / null means "everyone" (including guests).
 */

export type StoryTargeting = {
  genders?: string[]
  birthday_within_days?: number
  min_orders_count?: number
  days_since_last_order_gt?: number
}

export function isTargetingEmpty(targeting: unknown): boolean {
  if (targeting == null) return true
  if (typeof targeting !== 'object') return true
  return Object.keys(targeting as Record<string, unknown>).length === 0
}

export type ViewerContext = {
  userId: string | null
  gender: string | null
  birthDate: string | null // ISO date YYYY-MM-DD
  ordersCount: number
  daysSinceLastOrder: number | null // null if never ordered
}

export function campaignMatchesTargeting(
  targeting: unknown,
  ctx: ViewerContext,
): boolean {
  if (isTargetingEmpty(targeting)) return true
  if (!ctx.userId) return false

  const t = targeting as StoryTargeting

  if (Array.isArray(t.genders) && t.genders.length > 0) {
    const g = (ctx.gender || '').toLowerCase()
    const allowed = t.genders.map((x) => String(x).toLowerCase())
    if (!g || !allowed.includes(g)) return false
  }

  if (typeof t.birthday_within_days === 'number' && t.birthday_within_days >= 0) {
    if (!ctx.birthDate) return false
    const next = nextBirthdayDate(ctx.birthDate)
    if (!next) return false
    const today = startOfDay(new Date())
    const diffDays = Math.ceil((next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
    if (diffDays < 0 || diffDays > t.birthday_within_days) return false
  }

  if (typeof t.min_orders_count === 'number' && t.min_orders_count > 0) {
    if (ctx.ordersCount < t.min_orders_count) return false
  }

  if (typeof t.days_since_last_order_gt === 'number' && t.days_since_last_order_gt >= 0) {
    if (ctx.daysSinceLastOrder === null) return false
    if (ctx.daysSinceLastOrder <= t.days_since_last_order_gt) return false
  }

  return true
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Next calendar birthday from birth date (this year or next). */
function nextBirthdayDate(birthDateIso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDateIso.trim())
  if (!m) return null
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const now = new Date()
  let y = now.getFullYear()
  let next = new Date(y, month, day)
  if (next < startOfDay(now)) {
    y += 1
    next = new Date(y, month, day)
  }
  return startOfDay(next)
}
