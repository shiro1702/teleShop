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
      <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="o in kitchenOrders"
          :key="o.id"
          class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-mono text-xs text-gray-500">{{ shortId(o.id) }}</p>
              <p class="mt-1 text-xs text-gray-500">{{ formatTime(o.createdAt) }}</p>
            </div>
            <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{{ statusKitchen(o.status) }}</span>
          </div>
          <ul class="mt-3 space-y-2 text-sm">
            <li
              v-for="(line, idx) in o.items"
              :key="idx"
              class="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2 py-2"
              :class="line.isDuplicate ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-gray-50'"
            >
              <span class="font-medium text-gray-900">{{ line.name }} × {{ line.quantity }}</span>
              <span v-if="line.isDuplicate" class="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                x{{ line.dupQtySum }}
              </span>
            </li>
          </ul>
          <p v-if="o.comment" class="mt-2 text-xs text-gray-600">Комментарий: {{ o.comment }}</p>
          <div class="mt-3 flex gap-2 opacity-50">
            <button type="button" disabled class="flex-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-500">
              Действия (MVP)
            </button>
          </div>
        </article>
      </div>
    </div>

    <div v-else class="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
      Режим batch cooking появится в следующей итерации.
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const restaurantId = computed(() => String(route.params.id || ''))

type KitchenLine = {
  productId: string
  name: string
  quantity: number
  price: number
  dupQtySum: number
  isDuplicate: boolean
}

type KitchenOrder = {
  id: string
  status: string
  fulfillmentType: string
  total: number
  createdAt: string
  comment: string | null
  items: KitchenLine[]
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
        if (modes.length && !modes.some((m) => m.value === fulfillmentType.value)) {
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
  }
  return m[s] || s
}
</script>
