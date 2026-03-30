export type DashboardOrderStatus = 'new' | 'in_progress' | 'done' | 'cancelled'

export type NormalizedOrderItem = {
  productId: string
  name: string
  quantity: number
  price: number
  selectedParameters?: Array<{
    parameterKindId: string
    productParameterId: string
    optionId: string
    optionName: string
    price: number
    weightG?: number | null
    volumeMl?: number | null
    pieces?: number | null
  }>
  selectedModifiers?: Array<{
    groupId: string
    groupName: string
    optionId: string
    optionName: string
    pricingType?: 'delta' | 'multiplier'
    priceDelta: number
    priceMultiplier?: number | null
  }>
}

export type TimelineEntry = {
  at: string
  label: string
  from?: string
  to?: string
  source?: string
  userId?: string
  comment?: string | null
}

export const allowedOrderStatusTransitions: Record<DashboardOrderStatus, DashboardOrderStatus[]> = {
  new: ['in_progress', 'cancelled'],
  in_progress: ['done', 'cancelled'],
  done: [],
  cancelled: [],
}

function sortStrings(a: string, b: string) {
  return a.localeCompare(b)
}

export function orderItemDuplicateKey(item: NormalizedOrderItem): string {
  const paramSig = (item.selectedParameters ?? [])
    .map(
      (p) =>
        `${p.productParameterId}:${p.optionId}:${p.optionName}:${p.price}:${p.weightG ?? ''}:${p.volumeMl ?? ''}:${p.pieces ?? ''}`,
    )
    .sort(sortStrings)
    .join('|')
  const modSig = (item.selectedModifiers ?? [])
    .map(
      (m) =>
        `${m.groupId}:${m.optionId}:${m.optionName}:${m.pricingType ?? 'delta'}:${m.priceDelta}:${m.priceMultiplier ?? ''}`,
    )
    .sort(sortStrings)
    .join('|')
  return `${item.productId}::${paramSig}::${modSig}`
}

export function normalizeOrderItemsJson(raw: unknown): NormalizedOrderItem[] {
  if (!Array.isArray(raw)) return []
  const out: NormalizedOrderItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id : ''
    const name = typeof r.name === 'string' ? r.name : 'Товар'
    const qty = typeof r.quantity === 'number' && Number.isFinite(r.quantity) ? Math.max(0, Math.floor(r.quantity)) : 0
    const price = typeof r.price === 'number' && Number.isFinite(r.price) ? Math.round(r.price) : 0
    if (!id || qty <= 0) continue
    out.push({
      productId: id,
      name,
      quantity: qty,
      price,
      selectedParameters: Array.isArray(r.selectedParameters) ? (r.selectedParameters as NormalizedOrderItem['selectedParameters']) : undefined,
      selectedModifiers: Array.isArray(r.selectedModifiers) ? (r.selectedModifiers as NormalizedOrderItem['selectedModifiers']) : undefined,
    })
  }
  return out
}

export function computeDuplicateQtySumByKey(itemsByOrder: NormalizedOrderItem[][]): Map<string, number> {
  const sums = new Map<string, number>()
  for (const items of itemsByOrder) {
    for (const it of items) {
      const k = orderItemDuplicateKey(it)
      sums.set(k, (sums.get(k) ?? 0) + it.quantity)
    }
  }
  return sums
}

/** How many distinct orders contain at least one line with this duplicate key */
export function computeOrderCountByDuplicateKey(itemsByOrder: NormalizedOrderItem[][]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const items of itemsByOrder) {
    const keysInOrder = new Set<string>()
    for (const it of items) {
      keysInOrder.add(orderItemDuplicateKey(it))
    }
    for (const k of keysInOrder) {
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  return counts
}

export function parseOrderMetadata(metadata: unknown): { timeline: TimelineEntry[]; rest: Record<string, unknown> } {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { timeline: [], rest: {} }
  }
  const m = metadata as Record<string, unknown>
  const tl = m.timeline
  const timeline: TimelineEntry[] = []
  if (Array.isArray(tl)) {
    for (const e of tl) {
      if (!e || typeof e !== 'object') continue
      const o = e as Record<string, unknown>
      const at = typeof o.at === 'string' ? o.at : ''
      const label = typeof o.label === 'string' ? o.label : ''
      if (!at || !label) continue
      timeline.push({
        at,
        label,
        from: typeof o.from === 'string' ? o.from : undefined,
        to: typeof o.to === 'string' ? o.to : undefined,
        source: typeof o.source === 'string' ? o.source : undefined,
        userId: typeof o.userId === 'string' ? o.userId : undefined,
        comment: typeof o.comment === 'string' ? o.comment : o.comment === null ? null : undefined,
      })
    }
  }
  const { timeline: _t, ...rest } = m
  return { timeline, rest: rest as Record<string, unknown> }
}

export function mergeMetadataWithTimeline(
  metadata: unknown,
  entry: TimelineEntry,
): Record<string, unknown> {
  const { timeline, rest } = parseOrderMetadata(metadata)
  return {
    ...rest,
    timeline: [...timeline, entry],
  }
}

export function normalizeDashboardStatus(raw: string | null | undefined): DashboardOrderStatus {
  const s = (raw || 'new').toLowerCase().trim()
  if (s === 'in_progress' || s === 'in-progress') return 'in_progress'
  if (s === 'done' || s === 'completed') return 'done'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  return 'new'
}
