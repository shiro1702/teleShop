type DashboardRole = 'owner' | 'manager'

type DashboardAccessResponse = {
  ok: boolean
  userId: string
  shopId: string
  role: DashboardRole
}

type DashboardPermission =
  | 'orders.view'
  | 'orders.status.change'
  | 'orders.kanban.move'
  | 'menu.manage'
  | 'marketing.manage'
  | 'branches.view'
  | 'branches.create'
  | 'branches.archive'
  | 'team.manage'
  | 'settings.org.edit'
  | 'integrations.manage'

const ownerPermissions: DashboardPermission[] = [
  'orders.view',
  'orders.status.change',
  'orders.kanban.move',
  'menu.manage',
  'marketing.manage',
  'branches.view',
  'branches.create',
  'branches.archive',
  'team.manage',
  'settings.org.edit',
  'integrations.manage',
]

const managerPermissions: DashboardPermission[] = [
  'orders.view',
  'orders.status.change',
  'menu.manage',
  'marketing.manage',
  'branches.view',
  'branches.create',
]

export function useDashboardAccess() {
  const state = useState<DashboardAccessResponse | null>('dashboard-access-state', () => null)
  const loading = useState<boolean>('dashboard-access-loading', () => false)
  const error = useState<string | null>('dashboard-access-error', () => null)

  const role = computed<DashboardRole>(() => state.value?.role ?? 'manager')

  const permissions = computed<Set<DashboardPermission>>(() => {
    const list = role.value === 'owner' ? ownerPermissions : managerPermissions
    return new Set<DashboardPermission>(list)
  })

  const can = (permission: DashboardPermission) => permissions.value.has(permission)

  const load = async () => {
    if (loading.value) return
    loading.value = true
    error.value = null
    try {
      const access = await $fetch<DashboardAccessResponse>('/api/dashboard/access')
      state.value = access
    } catch (err: any) {
      state.value = null
      error.value = err?.data?.statusMessage || err?.message || 'Failed to load dashboard access'
    } finally {
      loading.value = false
    }
  }

  return {
    access: state,
    role,
    loading,
    error,
    can,
    load,
  }
}
