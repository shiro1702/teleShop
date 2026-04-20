<template>
  <section class="space-y-4">
    <div class="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg"
        :class="toast.kind === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-green-200 bg-green-50 text-green-700'"
        role="status"
      >
        <span class="min-w-0 flex-1 break-words">{{ toast.message }}</span>
        <button
          type="button"
          class="shrink-0 rounded px-1 leading-none text-gray-500 hover:bg-black/5 hover:text-gray-800"
          aria-label="Закрыть"
          @click="dismissToast(toast.id)"
        >
          ×
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Зоны доставки филиала</h1>
        <p class="text-sm text-gray-600">
          Полигоны GeoJSON, тарифы и приоритет при одинаковой цене доставки. На витрине филиал и зона подбираются по адресу (минимальная стоимость доставки, затем открытый филиал).
        </p>
      </div>
      <NuxtLink
        :to="`/dashboard/branches/${branchId}`"
        class="text-sm text-primary hover:underline"
      >
        ← К филиалу
      </NuxtLink>
    </div>

    <div v-if="loading" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Загрузка…
    </div>

    <template v-else>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-sm font-semibold">Зоны</h2>
          <button
            type="button"
            class="rounded-lg border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
            :disabled="role !== 'owner' || saving"
            @click="startCreate"
          >
            Добавить зону
          </button>
        </div>

        <p class="mt-2 text-xs text-gray-600">
          При пересечении зон у разных филиалов на витрине выбирается филиал с минимальной стоимостью доставки; при одинаковой цене — выше приоритет зоны. Если самый дешёвый филиал закрыт, заказ уходит в следующий открытый с доставкой по адресу.
        </p>

        <ul v-if="items.length" class="mt-4 divide-y divide-gray-100">
          <li
            v-for="z in items"
            :key="z.id"
            class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="font-medium text-gray-900">{{ z.name }}</p>
              <p class="text-xs text-gray-500">
                Доставка {{ z.delivery_cost }} ₽ · бесплатно от {{ z.free_delivery_threshold }} ₽ · мин. заказ {{ z.min_order_amount }} ₽ · приоритет {{ z.priority ?? 0 }}
                · {{ z.is_active ? 'активна' : 'выкл' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                :disabled="role !== 'owner' || saving"
                @click="startEdit(z)"
              >
                Изменить
              </button>
              <button
                type="button"
                class="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                :disabled="role !== 'owner' || saving"
                @click="removeZone(z)"
              >
                Удалить
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="mt-4 text-sm text-gray-500">
          Зон пока нет. Добавьте полигон (GeoJSON) и тарифы.
        </p>
      </div>

      <div
        v-if="editorOpen"
        class="rounded-xl border border-gray-200 bg-white p-4"
      >
        <h3 class="text-sm font-semibold"> {{ editingId ? 'Редактирование зоны' : 'Новая зона' }}</h3>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <label class="text-sm md:col-span-2">
            <span class="mb-1 block text-gray-600">Название</span>
            <input v-model="form.name" class="w-full rounded-lg border border-gray-300 px-2 py-2" :disabled="role !== 'owner'">
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Доставка, ₽</span>
            <input v-model.number="form.delivery_cost" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-2 py-2" :disabled="role !== 'owner'">
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Бесплатно от, ₽</span>
            <input v-model.number="form.free_delivery_threshold" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-2 py-2" :disabled="role !== 'owner'">
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Минималка, ₽</span>
            <input v-model.number="form.min_order_amount" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-2 py-2" :disabled="role !== 'owner'">
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Приоритет (при равной цене — больше важнее)</span>
            <input v-model.number="form.priority" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-2 py-2" :disabled="role !== 'owner'">
          </label>
          <label class="inline-flex items-center gap-2 text-sm md:col-span-2">
            <input v-model="form.is_active" type="checkbox" class="rounded border-gray-300" :disabled="role !== 'owner'">
            Активна
          </label>
          <div class="text-sm md:col-span-2">
            <span class="mb-1 block text-gray-600">Зона доставки (полигон)</span>
            <p class="mb-2 text-xs text-gray-600">
              Нарисуйте зону на карте или отредактируйте GeoJSON в расширенном блоке.</p>
            <ClientOnly>
              <DeliveryZoneMapEditor
                ref="mapEditorRef"
                v-model="polygonText"
                :disabled="role !== 'owner'"
                :default-polygon-json="DEFAULT_POLYGON_JSON"
                @warn="onMapWarn"
              />
              <template #fallback>
                <div
                  class="flex min-h-[320px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500"
                >
                  Загрузка карты…
                </div>
              </template>
            </ClientOnly>
            <details class="mt-3 rounded-lg border border-gray-200 bg-gray-50/80">
              <summary
                class="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Расширенное: GeoJSON вручную
              </summary>
              <div class="border-t border-gray-200 p-3">
                <textarea
                  v-model="polygonText"
                  rows="8"
                  class="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 font-mono text-xs"
                  :disabled="role !== 'owner'"
                />
              </div>
            </details>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            :disabled="role !== 'owner' || saving"
            @click="saveZone"
          >
            {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            :disabled="saving"
            @click="editorOpen = false"
          >
            Отмена
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import DeliveryZoneMapEditor from '~/components/dashboard/DeliveryZoneMapEditor.vue'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const branchId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

type ZoneRow = {
  id: string
  name: string
  polygon_geojson: unknown
  min_order_amount: number
  delivery_cost: number
  free_delivery_threshold: number
  is_active: boolean
  priority?: number
}

const DEFAULT_POLYGON = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [107.6, 51.84],
      [107.62, 51.84],
      [107.62, 51.82],
      [107.6, 51.82],
      [107.6, 51.84],
    ],
  ],
}

const DEFAULT_POLYGON_JSON = JSON.stringify(DEFAULT_POLYGON, null, 2)

const loading = ref(true)
const saving = ref(false)
const items = ref<ZoneRow[]>([])
const role = ref<'owner' | 'manager'>('owner')

const editorOpen = ref(false)
const editingId = ref<string | null>(null)
const polygonText = ref(DEFAULT_POLYGON_JSON)
const mapEditorRef = ref<{ syncFromMap: () => void } | null>(null)
const form = ref({
  name: 'Новая зона',
  delivery_cost: 199,
  free_delivery_threshold: 1800,
  min_order_amount: 700,
  priority: 0,
  is_active: true,
})

type Toast = { id: string; kind: 'success' | 'error'; message: string }
const toasts = ref<Toast[]>([])
let toastSeq = 0

function pushToast(kind: Toast['kind'], message: string) {
  const id = `t-${++toastSeq}`
  toasts.value = [...toasts.value, { id, kind, message }]
  const ms = kind === 'error' ? 14000 : 5000
  window.setTimeout(() => dismissToast(id), ms)
}

function dismissToast(id: string) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function onMapWarn(message: string) {
  pushToast('error', message)
}

async function loadAccess() {
  try {
    const res = await $fetch<{ ok?: boolean; role?: string }>('/api/dashboard/access')
    if (res?.ok && res.role === 'manager') role.value = 'manager'
    else role.value = 'owner'
  } catch {
    role.value = 'owner'
  }
}

async function loadZones() {
  if (!branchId.value) return
  loading.value = true
  try {
    const res = await $fetch<{ ok?: boolean; items?: ZoneRow[] }>(
      `/api/dashboard/branches/${encodeURIComponent(branchId.value)}/zones`,
    )
    items.value = Array.isArray(res?.items) ? res.items : []
    if (role.value === 'owner' && items.value.length === 0 && !editorOpen.value) {
      startCreate()
    }
  } catch (e: any) {
    pushToast('error', e?.data?.statusMessage || e?.message || 'Не удалось загрузить зоны')
    items.value = []
  } finally {
    loading.value = false
  }
}

function startCreate() {
  editingId.value = null
  form.value = {
    name: 'Новая зона',
    delivery_cost: 199,
    free_delivery_threshold: 1800,
    min_order_amount: 700,
    priority: 0,
    is_active: true,
  }
  polygonText.value = DEFAULT_POLYGON_JSON
  editorOpen.value = true
}

function stringifyPolygonForEditor(raw: unknown): string {
  if (raw == null) return DEFAULT_POLYGON_JSON
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return JSON.stringify(parsed, null, 2)
    } catch {
      return raw.trim() ? raw : DEFAULT_POLYGON_JSON
    }
  }
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return DEFAULT_POLYGON_JSON
  }
}

function startEdit(z: ZoneRow) {
  editingId.value = z.id
  form.value = {
    name: z.name,
    delivery_cost: z.delivery_cost,
    free_delivery_threshold: z.free_delivery_threshold,
    min_order_amount: z.min_order_amount,
    priority: typeof z.priority === 'number' ? z.priority : 0,
    is_active: z.is_active !== false,
  }
  polygonText.value = stringifyPolygonForEditor(z.polygon_geojson ?? DEFAULT_POLYGON)
  editorOpen.value = true
}

function parsePolygon(): unknown {
  const raw = JSON.parse(polygonText.value) as unknown
  return raw
}

async function saveZone() {
  if (!branchId.value || role.value !== 'owner') return
  // Sync pending geometry edits from map control before parsing payload.
  mapEditorRef.value?.syncFromMap()
  let polygon_geojson: unknown
  try {
    polygon_geojson = parsePolygon()
  } catch {
    pushToast('error', 'Некорректный JSON полигона')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      polygon_geojson,
      min_order_amount: form.value.min_order_amount,
      delivery_cost: form.value.delivery_cost,
      free_delivery_threshold: form.value.free_delivery_threshold,
      priority: form.value.priority,
      is_active: form.value.is_active,
    }
    if (editingId.value) {
      await $fetch(
        `/api/dashboard/branches/${encodeURIComponent(branchId.value)}/zones/${encodeURIComponent(editingId.value)}`,
        { method: 'PUT', body: payload },
      )
      pushToast('success', 'Зона сохранена')
    } else {
      await $fetch(
        `/api/dashboard/branches/${encodeURIComponent(branchId.value)}/zones`,
        { method: 'POST', body: payload },
      )
      pushToast('success', 'Зона создана')
    }
    editorOpen.value = false
    await loadZones()
  } catch (e: any) {
    pushToast('error', e?.data?.statusMessage || e?.message || 'Ошибка сохранения')
  } finally {
    saving.value = false
  }
}

async function removeZone(z: ZoneRow) {
  if (!branchId.value || role.value !== 'owner') return
  if (!window.confirm(`Удалить зону «${z.name}»?`)) return
  saving.value = true
  try {
    await $fetch(
      `/api/dashboard/branches/${encodeURIComponent(branchId.value)}/zones/${encodeURIComponent(z.id)}`,
      { method: 'DELETE' },
    )
    pushToast('success', 'Зона удалена')
    await loadZones()
  } catch (e: any) {
    pushToast('error', e?.data?.statusMessage || e?.message || 'Ошибка удаления')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadAccess()
  await loadZones()
})
</script>
