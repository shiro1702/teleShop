export type DashboardOrderStatus = 'new' | 'confirmed' | 'preparing' | 'delivering' | 'done' | 'cancelled'

export type DashboardOrder = {
  id: string
  customerName: string
  phone: string
  city: string
  branch: string
  brand: string
  total: number
  createdAt: string
  status: DashboardOrderStatus
  issue: boolean
  timeline: { at: string; label: string }[]
}

export const dashboardOrders: DashboardOrder[] = [
  {
    id: 'ord-1001',
    customerName: 'Иван Петров',
    phone: '+7 900 111-22-33',
    city: 'Улан-Удэ',
    branch: 'Ленина 10',
    brand: 'TelePizza',
    total: 1890,
    createdAt: '2026-03-24T09:20:00Z',
    status: 'new',
    issue: false,
    timeline: [{ at: '09:20', label: 'Заказ создан' }],
  },
  {
    id: 'ord-1002',
    customerName: 'Мария Кузнецова',
    phone: '+7 900 444-00-11',
    city: 'Улан-Удэ',
    branch: 'Советская 15',
    brand: 'TelePizza',
    total: 2450,
    createdAt: '2026-03-24T08:55:00Z',
    status: 'confirmed',
    issue: false,
    timeline: [
      { at: '08:55', label: 'Заказ создан' },
      { at: '09:00', label: 'Подтвержден оператором' },
    ],
  },
  {
    id: 'ord-1003',
    customerName: 'Олег Сидоров',
    phone: '+7 900 777-88-99',
    city: 'Чита',
    branch: 'Центральная 7',
    brand: 'TeleBurger',
    total: 1290,
    createdAt: '2026-03-24T07:40:00Z',
    status: 'preparing',
    issue: true,
    timeline: [
      { at: '07:40', label: 'Заказ создан' },
      { at: '07:44', label: 'Подтвержден оператором' },
      { at: '07:52', label: 'Передан на кухню' },
    ],
  },
  {
    id: 'ord-1004',
    customerName: 'Анна Иванова',
    phone: '+7 901 123-45-67',
    city: 'Иркутск',
    branch: 'Байкальская 1',
    brand: 'TelePizza',
    total: 980,
    createdAt: '2026-03-24T06:10:00Z',
    status: 'delivering',
    issue: false,
    timeline: [
      { at: '06:10', label: 'Заказ создан' },
      { at: '06:15', label: 'Подтвержден оператором' },
      { at: '06:28', label: 'Передан в доставку' },
    ],
  },
  {
    id: 'ord-1005',
    customerName: 'Евгений Смирнов',
    phone: '+7 902 000-00-00',
    city: 'Улан-Удэ',
    branch: 'Ленина 10',
    brand: 'TeleBurger',
    total: 3200,
    createdAt: '2026-03-23T20:20:00Z',
    status: 'done',
    issue: false,
    timeline: [
      { at: '20:20', label: 'Заказ создан' },
      { at: '20:23', label: 'Подтвержден оператором' },
      { at: '20:49', label: 'Доставлен' },
    ],
  },
]

export const allowedStatusTransitions: Record<DashboardOrderStatus, DashboardOrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['delivering', 'cancelled'],
  delivering: ['done', 'cancelled'],
  done: [],
  cancelled: [],
}
