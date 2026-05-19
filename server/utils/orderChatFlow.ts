import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { appendOrderTimelineEntry } from '~/server/utils/orderFlowActions'
import type { ShopBranchRow } from '~/server/utils/orderChatFlowPure'

export * from '~/server/utils/orderChatFlowPure'

export type AssignBranchResult =
  | { ok: true; branchName: string; branchAddress: string; branchId: string; previousBranchId: string | null }
  | { ok: false; reason: 'order_not_found' | 'branch_not_found' | 'forbidden' | 'same_branch' }

export async function loadActiveShopBranches(event: H3Event, shopId: string): Promise<ShopBranchRow[]> {
  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('restaurants')
    .select('id,name,address,manager_group_chat_id')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) {
    console.error('loadActiveShopBranches:', error)
    return []
  }
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name || '—'),
    address: typeof row.address === 'string' ? row.address : null,
    managerGroupChatId:
      typeof row.manager_group_chat_id === 'string' && row.manager_group_chat_id.trim()
        ? row.manager_group_chat_id.trim()
        : null,
  }))
}

export async function canManageOrderFromManagerChat(
  event: H3Event,
  shopId: string,
  chatId: string,
): Promise<boolean> {
  const normalizedChatId = chatId.trim()
  if (!normalizedChatId) return false
  const client = await serverSupabaseServiceRole(event)
  const { data: shop } = await client
    .from('shops')
    .select('manager_chat_id')
    .eq('id', shopId)
    .maybeSingle()
  const centralChatId =
    typeof (shop as any)?.manager_chat_id === 'string' ? String((shop as any).manager_chat_id).trim() : ''
  if (centralChatId && centralChatId === normalizedChatId) return true

  const branches = await loadActiveShopBranches(event, shopId)
  return branches.some((b) => b.managerGroupChatId === normalizedChatId)
}

export async function assignOrderBranchFromChat(
  event: H3Event,
  args: {
    orderId: string
    branchIndex: number
    source: 'telegram' | 'max'
    actorUserId: string
    managerChatId: string
  },
): Promise<AssignBranchResult> {
  const client = await serverSupabaseServiceRole(event)
  const { data: order } = await client
    .from('orders')
    .select('id,shop_id,restaurant_id,status,order_number')
    .eq('id', args.orderId)
    .maybeSingle()
  if (!order) return { ok: false, reason: 'order_not_found' }

  const shopId = String((order as any).shop_id)
  const allowed = await canManageOrderFromManagerChat(event, shopId, args.managerChatId)
  if (!allowed) return { ok: false, reason: 'forbidden' }

  const branches = await loadActiveShopBranches(event, shopId)
  const target = branches[args.branchIndex]
  if (!target) return { ok: false, reason: 'branch_not_found' }

  const previousBranchId = (order as any).restaurant_id ? String((order as any).restaurant_id) : null
  if (previousBranchId === target.id) return { ok: false, reason: 'same_branch' }

  const now = new Date().toISOString()
  await client
    .from('orders')
    .update({ restaurant_id: target.id, updated_at: now })
    .eq('id', args.orderId)
    .eq('shop_id', shopId)

  const prevName = previousBranchId
    ? branches.find((b) => b.id === previousBranchId)?.name || previousBranchId
    : '—'
  await appendOrderTimelineEntry(event, {
    orderId: args.orderId,
    shopId,
    label: `Филиал переназначен из чата: ${prevName} → ${target.name}`,
    source: args.source,
    userId: args.actorUserId,
    comment: null,
  })

  return {
    ok: true,
    branchName: target.name,
    branchAddress: target.address || 'Адрес не указан',
    branchId: target.id,
    previousBranchId,
  }
}

export async function notifyBranchAssignedInTelegram(
  event: H3Event,
  args: {
    botToken: string
    shopId: string
    branchId: string
    orderId: string
    orderNumber: string | null
  },
): Promise<void> {
  const branches = await loadActiveShopBranches(event, args.shopId)
  const branch = branches.find((b) => b.id === args.branchId)
  if (!branch?.managerGroupChatId) return
  const shortRef =
    typeof args.orderNumber === 'string' && args.orderNumber.trim()
      ? `#${args.orderNumber.trim().replace(/\s+/g, '').slice(0, 8)}`
      : `#${args.orderId.slice(0, 8)}`
  const text = [
    '🔀 Заказ переназначен на ваш филиал',
    `📦 ${shortRef}`,
    `🏪 ${branch.name}`,
    'Откройте карточку в чате диспетчера или в дашборде.',
  ].join('\n')
  try {
    await fetch(`https://api.telegram.org/bot${args.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: branch.managerGroupChatId, text }),
    })
  } catch (err) {
    console.error('notifyBranchAssignedInTelegram:', err)
  }
}
