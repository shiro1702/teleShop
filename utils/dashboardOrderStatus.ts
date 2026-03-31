/** Статусы заказа в дашборде (и в БД как `orders.status`). */
export type DashboardOrderStatus =
  | 'new'
  | 'in_progress'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'handed_to_customer'
  | 'cancelled'

export const dashboardOrderStatusLabels: Record<DashboardOrderStatus, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  ready_for_pickup: 'На выдаче',
  out_for_delivery: 'Доставка',
  handed_to_customer: 'Выдан',
  cancelled: 'Отменён',
}

export function normalizeDashboardStatus(raw: string | null | undefined): DashboardOrderStatus {
  const s = (raw || 'new').toLowerCase().trim()
  if (s === 'in_progress' || s === 'in-progress') return 'in_progress'
  if (s === 'ready_for_pickup' || s === 'ready-for-pickup') return 'ready_for_pickup'
  if (s === 'out_for_delivery' || s === 'out-for-delivery') return 'out_for_delivery'
  if (s === 'handed_to_customer' || s === 'handed-to-customer') return 'handed_to_customer'
  if (s === 'done' || s === 'completed') return 'handed_to_customer'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  return 'new'
}

/** Доставка курьером — отдельная ветка статусов; остальные способы идут в «на выдаче». */
export function isDeliveryFulfillment(fulfillmentType: string | null | undefined): boolean {
  return (fulfillmentType || '').toLowerCase() === 'delivery'
}

export function getAllowedOrderStatusTransitions(
  current: DashboardOrderStatus,
  fulfillmentType: string | null | undefined,
): DashboardOrderStatus[] {
  const delivery = isDeliveryFulfillment(fulfillmentType)

  switch (current) {
    case 'new':
      return ['in_progress', 'cancelled']
    case 'in_progress':
      if (delivery) return ['out_for_delivery', 'handed_to_customer', 'cancelled']
      return ['ready_for_pickup', 'handed_to_customer', 'cancelled']
    case 'ready_for_pickup':
      return ['handed_to_customer', 'cancelled']
    case 'out_for_delivery':
      return ['handed_to_customer', 'cancelled']
    case 'handed_to_customer':
    case 'cancelled':
    default:
      return []
  }
}
