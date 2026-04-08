<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Кухня (KDS)</h1>
        <p v-if="branchName" class="mt-1 text-sm text-gray-600">{{ branchName }}</p>
      </div>
      <NuxtLink :to="`/dashboard/branches/${restaurantId}`" class="text-sm text-primary hover:underline">
        Карточка филиала
      </NuxtLink>
    </div>

    <div class="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2">
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
        :class="mainTab === 'duplicates' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50'"
        @click="mainTab = 'duplicates'"
      >
        Подсветка дублей
      </button>
      <button
        type="button"
        disabled
        class="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 opacity-60"
        title="Скоро: batch cooking"
      >
        Batch cooking
      </button>
    </div>

    <div v-if="mainTab === 'duplicates'" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in fulfillmentModes"
          :key="m.value"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm transition"
          :class="
            fulfillmentType === m.value
              ? 'border-primary bg-primary text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          "
          @click="fulfillmentType = m.value"
        >
          {{ m.label }}
        </button>
      </div>

      <div v-if="pending" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        Загрузка…
      </div>
      <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ errorMessage }}
      </div>
      <div v-else-if="!kitchenOrders.length" class="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600">
        Нет активных заказов для выбранного способа получения.
      </div>
      <div v-else class="space-y-3">
        <div v-if="allDuplicateGroups.length" class="rounded-xl border border-gray-200 bg-white p-3">
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Дубли по всем заказам</p>
            <button
              v-if="crossedDuplicateKeys.length"
              type="button"
              class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              @click="crossedDuplicateKeys = []"
            >
              Сбросить вычеркивания
            </button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="group in allDuplicateGroups"
              :key="`all:${group.key}`"
              type="button"
              class="rounded-full border px-2 py-0.5 text-xs font-semibold transition"
              :class="[group.colorClass, isDuplicateCrossed(group.key) ? 'line-through opacity-45' : '']"
              :title="isDuplicateCrossed(group.key) ? 'Вернуть дубль' : 'Вычеркнуть дубль во всех заказах'"
              @click="toggleDuplicateCross(group.key)"
            >
              {{ group.name }} x{{ group.totalQty }}
            </button>
          </div>
        </div>
      <div class="overflow-x-auto pb-1">
        <div class="flex min-w-[980px] gap-3">
          <div
            v-for="col in kitchenColumns"
            :key="col"
            class="w-80 shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-3"
          >
            <p class="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ statusKitchen(col) }}
              <span class="font-normal text-gray-400">({{ ordersInColumn(col).length }})</span>
            </p>
            <div v-if="duplicateGroupsForColumn(col).length" class="mb-3 flex flex-wrap gap-1.5">
              <button
                v-for="group in duplicateGroupsForColumn(col)"
                :key="`${col}:${group.key}`"
                type="button"
                class="rounded-full border px-2 py-0.5 text-xs font-semibold transition"
                :class="[group.colorClass, isDuplicateCrossedInColumn(col, group.key) ? 'line-through opacity-45' : '']"
                :title="isDuplicateCrossedInColumn(col, group.key) ? 'Вернуть дубль в колонке' : 'Вычеркнуть дубль только в этой колонке'"
                @click="toggleDuplicateCrossInColumn(col, group.key)"
              >
                {{ group.name }} x{{ group.totalQty }}
              </button>
            </div>
            <div class="space-y-2">
              <article
                v-for="o in ordersInColumn(col)"
                :key="o.id"
                class="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                @click="openOrderModal(o)"
              >
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="font-mono text-xs text-gray-500">{{ displayOrderNumber(o) }}</p>
                    <p class="mt-1 text-xs text-gray-500">{{ formatTime(o.createdAt) }}</p>
                  </div>
                  <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{{ statusKitchen(o.status) }}</span>
                </div>
                <ul class="mt-3 space-y-2 text-sm">
                  <li
                    v-for="(line, idx) in o.items"
                    :key="idx"
                    class="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2 py-2"
                    :class="[lineBadgeClass(line, o.status), lineTextClass(line, o.status)]"
                  >
                    <div class="flex min-w-0 flex-col">
                      <span class="font-medium text-gray-900">
                        {{ line.name }}
                        <span v-if="itemMetaLabel(line)" class="text-gray-600">({{ itemMetaLabel(line) }})</span>
                        × {{ line.quantity }}
                      </span>
                      <span v-if="modifierLabel(line)" class="truncate text-xs text-gray-600">
                        Модификаторы: {{ modifierLabel(line) }}
                      </span>
                    </div>
                  </li>
                </ul>
                <p v-if="o.comment" class="mt-2 text-xs text-gray-600">Комментарий: {{ o.comment }}</p>
                <div class="mt-3 flex flex-wrap gap-1.5">
                  <button
                    v-for="nextStatus in moveTargets(o)"
                    :key="`${o.id}:${nextStatus}`"
                    type="button"
                    class="rounded border px-2.5 py-1 text-xs disabled:opacity-50"
                    :class="moveButtonClass(nextStatus)"
                    :disabled="isSaving(o.id)"
                    @click.stop="applyStatus(o.id, nextStatus)"
                  >
                    {{ statusKitchen(nextStatus) }}
                  </button>
                </div>
              </article>
              <p v-if="!ordersInColumn(col).length" class="rounded-lg border border-dashed border-gray-300 bg-white py-6 text-center text-xs text-gray-400">
                Пусто
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <div v-else class="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
      Режим batch cooking появится в следующей итерации.
    </div>

    <div
      v-if="orderModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeOrderModal"
    >
      <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-wide text-gray-500">Заказ</p>
            <h3 class="font-mono text-lg font-semibold text-gray-900">
              {{ orderModalData ? displayOrderNumber(orderModalData) : '—' }}
            </h3>
          </div>
          <button type="button" class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50" @click="closeOrderModal">
            Закрыть
          </button>
        </div>

        <div v-if="orderModalPending" class="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          Загрузка деталей заказа...
        </div>
        <div v-else-if="orderModalError" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ orderModalError }}
        </div>
        <div v-else-if="orderModalData" class="space-y-3 text-sm">
          <div class="grid gap-2 sm:grid-cols-2">
            <p><span class="text-gray-500">Статус:</span> {{ statusKitchen(orderModalData.status) }}</p>
            <p><span class="text-gray-500">Способ:</span> {{ fulfillmentLabel(orderModalData.fulfillmentType) }}</p>
            <p><span class="text-gray-500">Сумма:</span> {{ orderModalData.total }} ₽</p>
            <p><span class="text-gray-500">Создан:</span> {{ formatTime(orderModalData.createdAt) }}</p>
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <p><span class="text-gray-500">Telegram:</span> {{ orderModalData.customerTelegramId ?? '—' }}</p>
            <p><span class="text-gray-500">Профиль:</span> {{ orderModalData.customerProfileId || '—' }}</p>
          </div>
          <p v-if="orderModalData.comment"><span class="text-gray-500">Комментарий:</span> {{ orderModalData.comment }}</p>
          <div class="rounded-lg border border-gray-200 bg-white p-3">
            <p class="mb-2 text-xs uppercase tracking-wide text-gray-500">Перенос по флоу</p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="nextStatus in moveTargets(orderModalData)"
                :key="`modal:${orderModalData.id}:${nextStatus}`"
                type="button"
                class="rounded border px-2.5 py-1 text-xs disabled:opacity-50"
                :class="moveButtonClass(nextStatus)"
                :disabled="isSaving(orderModalData.id)"
                @click="applyStatus(orderModalData.id, nextStatus)"
              >
                {{ statusKitchen(nextStatus) }}
              </button>
            </div>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p class="mb-2 text-xs uppercase tracking-wide text-gray-500">Состав заказа</p>
            <ul class="space-y-2">
              <li v-for="(line, idx) in orderModalData.items" :key="`modal:${idx}`" class="rounded border border-gray-200 bg-white p-2">
                <p class="font-medium text-gray-900">
                  {{ line.name }}
                  <span v-if="itemMetaLabel(line)" class="text-gray-600">({{ itemMetaLabel(line) }})</span>
                  × {{ line.quantity }}
                </p>
                <p v-if="modifierLabel(line)" class="text-xs text-gray-600">Модификаторы: {{ modifierLabel(line) }}</p>
              </li>
            </ul>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p class="mb-2 text-xs uppercase tracking-wide text-gray-500">Смена статусов</p>
            <ul v-if="orderModalData.timeline?.length" class="space-y-1.5">
              <li v-for="(t, idx) in orderModalData.timeline" :key="`tl:${idx}`" class="rounded border border-gray-200 bg-white px-2 py-1.5">
                <p class="text-xs text-gray-500">{{ formatTime(t.at) }}</p>
                <p class="text-sm text-gray-900">
                  {{ t.label }}
                  <span v-if="t.from || t.to" class="text-gray-600">({{ t.from || '—' }} → {{ t.to || '—' }})</span>
                </p>
              </li>
            </ul>
            <p v-else class="text-xs text-gray-500">История статусов пока пустая.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getAllowedOrderStatusTransitions, normalizeDashboardStatus, type DashboardOrderStatus } from '~/utils/dashboardOrderStatus'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const restaurantId = computed(() => String(route.params.id || ''))

type KitchenLine = {
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
  dupQtySum: number
  isDuplicate: boolean
}

type KitchenOrder = {
  id: string
  orderNumber?: string | null
  status: string
  fulfillmentType: string
  total: number
  createdAt: string
  comment: string | null
  items: KitchenLine[]
  customerTelegramId?: number | null
  customerProfileId?: string | null
  timeline?: Array<{
    at: string
    label: string
    from?: string
    to?: string
    source?: string
    userId?: string
    comment?: string | null
  }>
}

type BranchRow = {
  id: string
  name: string
  supportsDelivery: boolean
  supportsPickup: boolean
  supportsDineIn: boolean
  supportsQrMenu: boolean
  supportsShowcaseOrder: boolean
}

const mainTab = ref<'duplicates' | 'batch'>('duplicates')
const fulfillmentType = ref('delivery')
const branchName = ref('')
const branchSupports = ref<BranchRow | null>(null)

const kitchenOrders = ref<KitchenOrder[]>([])
const pending = ref(true)
const errorMessage = ref<string | null>(null)
const savingByOrder = ref<Record<string, boolean>>({})
const crossedDuplicateKeys = ref<string[]>([])
const crossedByColumn = ref<Record<string, string[]>>({})
const orderModalOpen = ref(false)
const orderModalPending = ref(false)
const orderModalError = ref<string | null>(null)
const orderModalData = ref<KitchenOrder | null>(null)

type DuplicateGroup = {
  key: string
  name: string
  totalQty: number
  colorClass: string
}

const duplicatePalette = [
  'border-amber-300 bg-amber-50 text-amber-900',
  'border-sky-300 bg-sky-50 text-sky-900',
  'border-emerald-300 bg-emerald-50 text-emerald-900',
  'border-violet-300 bg-violet-50 text-violet-900',
  'border-rose-300 bg-rose-50 text-rose-900',
  'border-orange-300 bg-orange-50 text-orange-900',
]

const fulfillmentModes = computed(() => {
  const b = branchSupports.value
  if (!b) {
    return [
      { value: 'delivery', label: 'Доставка' },
      { value: 'pickup', label: 'Самовывоз' },
    ]
  }
  const opts: { value: string; label: string }[] = []
  if (b.supportsDelivery) opts.push({ value: 'delivery', label: 'Доставка' })
  if (b.supportsPickup) opts.push({ value: 'pickup', label: 'Самовывоз' })
  if (b.supportsDineIn) opts.push({ value: 'dine-in', label: 'В зале' })
  if (b.supportsQrMenu) opts.push({ value: 'qr-menu', label: 'QR-меню' })
  if (b.supportsShowcaseOrder) opts.push({ value: 'showcase-order', label: 'Витрина' })
  return opts.length ? opts : [{ value: 'delivery', label: 'Доставка' }]
})

const kitchenColumns = computed<string[]>(() => {
  // Показываем полный канбан-флоу всегда, даже если колонка сейчас пустая.
  return ['new', 'in_progress', 'ready_for_pickup', 'out_for_delivery', 'cancelled']
})

const duplicateColorByKey = computed<Record<string, string>>(() => {
  const mapping: Record<string, string> = {}
  let idx = 0
  for (const o of kitchenOrders.value) {
    for (const line of o.items || []) {
      if (!line.isDuplicate) continue
      const key = duplicateKey(line)
      if (!mapping[key]) {
        mapping[key] = duplicatePalette[idx % duplicatePalette.length]
        idx += 1
      }
    }
  }
  return mapping
})

const allDuplicateGroups = computed<DuplicateGroup[]>(() =>
  duplicateGroups(kitchenOrders.value.filter((o: KitchenOrder) => isDuplicateStatus(o.status))),
)

async function loadBranch() {
  try {
    const res = await fetch('/api/dashboard/restaurants')
    const data = await res.json() as { ok?: boolean; items?: BranchRow[] }
    if (data.ok && Array.isArray(data.items)) {
      const b = data.items.find((x) => x.id === restaurantId.value)
      if (b) {
        branchSupports.value = b
        branchName.value = b.name
        const modes = fulfillmentModes.value
        if (modes.length && !modes.some((m: { value: string; label: string }) => m.value === fulfillmentType.value)) {
          fulfillmentType.value = modes[0].value
        }
      }
    }
  } catch {
    /* ignore */
  }
}

async function loadKitchen() {
  pending.value = true
  errorMessage.value = null
  try {
    const qs = new URLSearchParams({ fulfillment_type: fulfillmentType.value })
    const res = await fetch(`/api/dashboard/branches/${restaurantId.value}/kitchen?${qs}`)
    const data = await res.json() as { ok?: boolean; orders?: KitchenOrder[]; statusMessage?: string }
    if (!res.ok) {
      throw new Error(data.statusMessage || 'Не удалось загрузить кухню')
    }
    kitchenOrders.value = Array.isArray(data.orders) ? data.orders : []
  } catch (e: any) {
    errorMessage.value = e?.message || 'Ошибка'
    kitchenOrders.value = []
  } finally {
    pending.value = false
  }
}

async function applyStatus(orderId: string, nextStatus: DashboardOrderStatus) {
  const needsComment = nextStatus === 'cancelled'
  let comment: string | undefined
  if (needsComment) {
    const raw = window.prompt('Комментарий к отмене (обязательно):', '')
    if (!raw || !raw.trim()) return
    comment = raw.trim()
  }
  savingByOrder.value = { ...savingByOrder.value, [orderId]: true }
  const prevStatus = kitchenOrders.value.find((o: KitchenOrder) => o.id === orderId)?.status || null
  const prevModalStatus = orderModalData.value?.id === orderId ? orderModalData.value.status : null
  if (prevStatus) {
    kitchenOrders.value = kitchenOrders.value.map((o: KitchenOrder) =>
      o.id === orderId ? { ...o, status: nextStatus } : o,
    )
  }
  if (orderModalData.value?.id === orderId) {
    orderModalData.value = { ...orderModalData.value, status: nextStatus }
  }
  try {
    const res = await fetch(`/api/dashboard/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nextStatus, comment }),
    })
    const json = (await res.json().catch(() => null)) as { statusMessage?: string } | null
    if (!res.ok) throw new Error(json?.statusMessage || 'Не удалось обновить статус')
  } catch (e: any) {
    if (prevStatus) {
      kitchenOrders.value = kitchenOrders.value.map((o: KitchenOrder) =>
        o.id === orderId ? { ...o, status: prevStatus } : o,
      )
    }
    if (orderModalData.value?.id === orderId && prevModalStatus) {
      orderModalData.value = { ...orderModalData.value, status: prevModalStatus }
    }
    window.alert(e?.message || 'Ошибка изменения статуса')
  } finally {
    const copy = { ...savingByOrder.value }
    delete copy[orderId]
    savingByOrder.value = copy
  }
}

onMounted(async () => {
  await loadBranch()
  await loadKitchen()
})

watch(fulfillmentType, () => {
  if (mainTab.value === 'duplicates') loadKitchen()
})

function shortId(id: string) {
  if (!id) return '—'
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function displayOrderNumber(order: KitchenOrder) {
  return order.orderNumber && order.orderNumber.trim() ? order.orderNumber : shortId(order.id)
}

function fulfillmentLabel(ft: string) {
  const m: Record<string, string> = {
    delivery: 'Доставка',
    pickup: 'Самовывоз',
    'dine-in': 'В зале',
    'qr-menu': 'QR-меню',
    'showcase-order': 'Витрина',
  }
  return m[ft] || ft
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function statusKitchen(s: string) {
  const m: Record<string, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    ready_for_pickup: 'Готов к выдаче',
    out_for_delivery: 'В доставке',
    handed_to_customer: 'Выдан',
    cancelled: 'Отменен',
  }
  return m[s] || s
}

function ordersInColumn(status: string) {
  return kitchenOrders.value.filter((o: KitchenOrder) => o.status === status)
}

function duplicateKey(line: KitchenLine) {
  const paramSig = (line.selectedParameters ?? [])
    .map(
      (p) =>
        `${p.productParameterId}:${p.optionId}:${p.optionName}:${p.price}:${p.weightG ?? ''}:${p.volumeMl ?? ''}:${p.pieces ?? ''}`,
    )
    .sort()
    .join('|')
  const modSig = (line.selectedModifiers ?? [])
    .map(
      (m) =>
        `${m.groupId}:${m.optionId}:${m.optionName}:${m.pricingType ?? 'delta'}:${m.priceDelta}:${m.priceMultiplier ?? ''}`,
    )
    .sort()
    .join('|')
  return `${(line.productId || line.name).trim().toLowerCase()}::${paramSig}::${modSig}`
}

function duplicateBadgeClass(key: string) {
  return duplicateColorByKey.value[key] || 'border-amber-300 bg-amber-50 text-amber-900'
}

function lineBadgeClass(line: KitchenLine, status: string) {
  if (!line.isDuplicate || !isDuplicateStatus(status)) return 'border-gray-100 bg-gray-50'
  return duplicateBadgeClass(duplicateKey(line))
}

function lineTextClass(line: KitchenLine, status: string) {
  if (!line.isDuplicate || !isDuplicateStatus(status)) return ''
  const key = duplicateKey(line)
  if (isDuplicateCrossed(key)) return 'line-through opacity-45'
  if (isDuplicateCrossedInColumn(status, key)) return 'line-through opacity-45'
  return ''
}

function duplicateGroups(list: KitchenOrder[]): DuplicateGroup[] {
  const groups = new Map<string, DuplicateGroup>()
  for (const order of list) {
    for (const line of order.items || []) {
      if (!line.isDuplicate) continue
      const key = duplicateKey(line)
      const current = groups.get(key)
      if (current) {
        current.totalQty += line.quantity
      } else {
        groups.set(key, {
          key,
          name: line.name,
          totalQty: line.quantity,
          colorClass: duplicateBadgeClass(key),
        })
      }
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.totalQty - a.totalQty)
}

function isDuplicateCrossed(key: string) {
  return crossedDuplicateKeys.value.includes(key)
}

function toggleDuplicateCross(key: string) {
  if (isDuplicateCrossed(key)) {
    crossedDuplicateKeys.value = crossedDuplicateKeys.value.filter((x: string) => x !== key)
  } else {
    crossedDuplicateKeys.value = [...crossedDuplicateKeys.value, key]
  }
}

function duplicateGroupsForColumn(status: string): DuplicateGroup[] {
  if (!isDuplicateStatus(status)) return []
  return duplicateGroups(ordersInColumn(status))
}

function isDuplicateStatus(status: string) {
  return status === 'new' || status === 'in_progress'
}

function isDuplicateCrossedInColumn(status: string, key: string) {
  const list = crossedByColumn.value[status] || []
  return list.includes(key)
}

function toggleDuplicateCrossInColumn(status: string, key: string) {
  const current = crossedByColumn.value[status] || []
  if (current.includes(key)) {
    crossedByColumn.value = {
      ...crossedByColumn.value,
      [status]: current.filter((x: string) => x !== key),
    }
    return
  }
  crossedByColumn.value = {
    ...crossedByColumn.value,
    [status]: [...current, key],
  }
}

function isSaving(orderId: string) {
  return !!savingByOrder.value[orderId]
}

function moveTargets(order: KitchenOrder): DashboardOrderStatus[] {
  return getAllowedOrderStatusTransitions(normalizeDashboardStatus(order.status), order.fulfillmentType)
}

function moveButtonClass(nextStatus: DashboardOrderStatus) {
  if (nextStatus === 'cancelled') return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
}

function itemMetaLabel(line: KitchenLine) {
  const params = (line.selectedParameters ?? []).map((p) => p.optionName).filter(Boolean)
  return params.join(', ')
}

function modifierLabel(line: KitchenLine) {
  const modifiers = (line.selectedModifiers ?? []).map((m) => m.optionName).filter(Boolean)
  return modifiers.join(', ')
}

async function openOrderModal(order: KitchenOrder) {
  orderModalOpen.value = true
  orderModalPending.value = true
  orderModalError.value = null
  orderModalData.value = { ...order }
  try {
    const res = await fetch(`/api/dashboard/orders/${order.id}`)
    const data = (await res.json()) as { ok?: boolean; order?: KitchenOrder; statusMessage?: string }
    if (!res.ok || !data?.order) {
      throw new Error(data?.statusMessage || 'Не удалось загрузить детали заказа')
    }
    orderModalData.value = data.order
  } catch (e: any) {
    orderModalError.value = e?.message || 'Ошибка загрузки деталей заказа'
  } finally {
    orderModalPending.value = false
  }
}

function closeOrderModal() {
  orderModalOpen.value = false
}
</script>
