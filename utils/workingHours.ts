import type { WeeklyWorkingHours, WorkingDayKey } from '~/types/organization-style'

export type BranchWorkingHoursOverride = {
  useOrganizationHours: boolean
  workingHours: WeeklyWorkingHours | null
}

export const WORKING_DAY_KEYS: WorkingDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const DAY_INDEX_TO_KEY: Record<number, WorkingDayKey> = {
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
  7: 'sun',
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function normalizeWeeklyWorkingHours(input: unknown, fallback: WeeklyWorkingHours): WeeklyWorkingHours {
  const source = input && typeof input === 'object' ? input as Record<string, any> : {}
  const out = {} as WeeklyWorkingHours
  for (const day of WORKING_DAY_KEYS) {
    const row = source[day] && typeof source[day] === 'object' ? source[day] : {}
    const fallbackRow = fallback[day]
    out[day] = {
      isOpen: typeof row.isOpen === 'boolean' ? row.isOpen : fallbackRow.isOpen,
      openAt: typeof row.openAt === 'string' && HHMM_RE.test(row.openAt) ? row.openAt : fallbackRow.openAt,
      closeAt: typeof row.closeAt === 'string' && HHMM_RE.test(row.closeAt) ? row.closeAt : fallbackRow.closeAt,
    }
  }
  return out
}

export function resolveEffectiveWorkingHours(
  organizationWorkingHours: WeeklyWorkingHours,
  branchOverride?: BranchWorkingHoursOverride | null,
): WeeklyWorkingHours {
  if (!branchOverride || branchOverride.useOrganizationHours || !branchOverride.workingHours) {
    return organizationWorkingHours
  }
  return branchOverride.workingHours
}

export function getTimezoneLocalParts(date: Date, timezone: string): { dayKey: WorkingDayKey; hhmm: string } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(date)
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Mon'
  const hour = parts.find((p) => p.type === 'hour')?.value || '00'
  const minute = parts.find((p) => p.type === 'minute')?.value || '00'
  const normalizedWeekday = weekday.slice(0, 3).toLowerCase()
  const dayIndexMap: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 }
  const dayIndex = dayIndexMap[normalizedWeekday] ?? 1
  return {
    dayKey: DAY_INDEX_TO_KEY[dayIndex],
    hhmm: `${hour}:${minute}`,
  }
}

export function isOpenNowBySchedule(
  workingHours: WeeklyWorkingHours,
  timezone: string,
  now = new Date(),
): { isOpen: boolean; dayKey: WorkingDayKey; nowHHMM: string } {
  const local = getTimezoneLocalParts(now, timezone)
  const row = workingHours[local.dayKey]
  if (!row || !row.isOpen) {
    return { isOpen: false, dayKey: local.dayKey, nowHHMM: local.hhmm }
  }
  const isOpen = row.openAt <= local.hhmm && local.hhmm < row.closeAt
  return { isOpen, dayKey: local.dayKey, nowHHMM: local.hhmm }
}

