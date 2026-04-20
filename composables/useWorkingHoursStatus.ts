import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { WeeklyWorkingHours } from '~/types/organization-style'
import { isOpenNowBySchedule } from '~/utils/workingHours'

type WorkingHoursSnapshot = {
  isOpen: boolean
  checkedAtMs: number
  nextRefreshAtMs: number
}

type UseWorkingHoursStatusOptions = {
  workingHours: Ref<Record<string, any> | WeeklyWorkingHours | null | undefined>
  timezone: Ref<string | null | undefined>
  cacheKey: Ref<string>
  defaultIsOpenWhenNoSchedule?: boolean
}

const CHECK_INTERVAL_FALLBACK_MS = 60_000

function buildStorageKey(cacheKey: string) {
  return `working-hours-status:${cacheKey || 'default'}`
}

function getNextMinuteTimestamp(nowMs: number) {
  return Math.floor(nowMs / 60_000) * 60_000 + 60_000
}

export function useWorkingHoursStatus(options: UseWorkingHoursStatusOptions) {
  const defaultIsOpenWhenNoSchedule = options.defaultIsOpenWhenNoSchedule ?? false
  const snapshot = ref<WorkingHoursSnapshot | null>(null)
  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  const clearRefreshTimer = () => {
    if (!refreshTimer) return
    clearTimeout(refreshTimer)
    refreshTimer = null
  }

  const persistSnapshot = (nextSnapshot: WorkingHoursSnapshot | null) => {
    if (!import.meta.client) return
    const key = buildStorageKey(options.cacheKey.value)
    if (!nextSnapshot) {
      sessionStorage.removeItem(key)
      return
    }
    sessionStorage.setItem(key, JSON.stringify(nextSnapshot))
  }

  const restoreSnapshot = () => {
    if (!import.meta.client) return
    const key = buildStorageKey(options.cacheKey.value)
    const raw = sessionStorage.getItem(key)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as WorkingHoursSnapshot
      if (
        parsed
        && typeof parsed.isOpen === 'boolean'
        && Number.isFinite(parsed.checkedAtMs)
        && Number.isFinite(parsed.nextRefreshAtMs)
      ) {
        snapshot.value = parsed
      }
    } catch {
      sessionStorage.removeItem(key)
    }
  }

  const scheduleNextRefresh = () => {
    if (!import.meta.client) return
    clearRefreshTimer()
    const nowMs = Date.now()
    const nextRefreshAtMs = snapshot.value?.nextRefreshAtMs ?? (nowMs + CHECK_INTERVAL_FALLBACK_MS)
    const delay = Math.max(250, nextRefreshAtMs - nowMs + 50)
    refreshTimer = setTimeout(() => {
      refreshStatus(true)
    }, delay)
  }

  const refreshStatus = (force = false) => {
    const schedule = options.workingHours.value
    const timezone = options.timezone.value || 'Asia/Irkutsk'
    if (!schedule) {
      snapshot.value = null
      persistSnapshot(null)
      clearRefreshTimer()
      return
    }

    const nowMs = Date.now()
    if (!force && snapshot.value && nowMs < snapshot.value.nextRefreshAtMs) {
      return
    }

    const result = isOpenNowBySchedule(schedule as WeeklyWorkingHours, timezone, new Date(nowMs))
    const nextSnapshot: WorkingHoursSnapshot = {
      isOpen: result.isOpen,
      checkedAtMs: nowMs,
      nextRefreshAtMs: getNextMinuteTimestamp(nowMs),
    }
    snapshot.value = nextSnapshot
    persistSnapshot(nextSnapshot)
    scheduleNextRefresh()
  }

  const refreshIfStale = () => {
    const nowMs = Date.now()
    if (!snapshot.value || nowMs >= snapshot.value.nextRefreshAtMs) {
      refreshStatus(true)
    }
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      refreshIfStale()
    }
  }

  const handleWindowFocus = () => {
    refreshIfStale()
  }

  watch(options.cacheKey, () => {
    clearRefreshTimer()
    snapshot.value = null
    restoreSnapshot()
    refreshStatus(true)
  })

  watch([options.workingHours, options.timezone], () => {
    refreshStatus(true)
  })

  onMounted(() => {
    restoreSnapshot()
    refreshStatus(true)
    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    clearRefreshTimer()
    if (import.meta.client) {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  return {
    isOpenNow: computed(() => snapshot.value?.isOpen ?? defaultIsOpenWhenNoSchedule),
    lastCheckedAtMs: computed(() => snapshot.value?.checkedAtMs ?? null),
    refreshWorkingHoursStatus: refreshStatus,
  }
}
