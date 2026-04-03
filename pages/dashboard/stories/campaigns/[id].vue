<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <NuxtLink to="/dashboard/stories" class="text-sm text-primary hover:underline">← К списку</NuxtLink>
        <h1 class="mt-2 text-2xl font-semibold">Кампания сториз</h1>
      </div>
      <button
        type="button"
        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Сохранение…' : 'Сохранить' }}
      </button>
    </div>

    <div v-if="pending" class="text-sm text-gray-500">Загрузка…</div>
    <div v-else-if="loadError" class="text-sm text-red-500">{{ loadError }}</div>

    <div v-else class="space-y-6">
      <div class="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 class="text-lg font-medium text-gray-900">Основное</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="text-gray-700">Название (под кружочком)</span>
            <input
              v-model="form.title"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Размещение</span>
            <select v-model="form.placement" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="top_bar">Верхняя полоса (кружочки)</option>
              <option value="catalog_grid">Сетка каталога (баннер)</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.isActive" type="checkbox" class="rounded border-gray-300">
            Активна
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Превью (картинка кружочка)</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" class="mt-1 text-sm" @change="onPreviewFile">
            <span v-if="form.previewUrl" class="mt-1 block text-xs text-gray-500 truncate">{{ form.previewUrl }}</span>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">С даты (UTC, опционально)</span>
            <input v-model="form.validFrom" type="datetime-local" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">По дату (UTC, опционально)</span>
            <input v-model="form.validUntil" type="datetime-local" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
          </label>
        </div>
        <div class="mt-4">
          <label class="block text-sm">
            <span class="text-gray-700">Таргетинг (JSON). Пустой <code class="text-xs">{}</code> — для всех гостей.</span>
            <textarea
              v-model="targetingJson"
              rows="4"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
              placeholder='{"genders":["female"],"birthday_within_days":7}'
            />
          </label>
          <p v-if="targetingError" class="mt-1 text-xs text-red-600">{{ targetingError }}</p>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-medium text-gray-900">Слайды</h2>
          <button
            type="button"
            class="text-sm text-primary hover:underline"
            @click="addSlide"
          >
            + Слайд
          </button>
        </div>
        <ul class="mt-4 space-y-4">
          <li
            v-for="(slide, idx) in form.slides"
            :key="slide.clientKey"
            class="rounded-lg border border-gray-100 p-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <span class="text-sm font-medium text-gray-700">Слайд {{ idx + 1 }}</span>
              <button type="button" class="text-sm text-red-600 hover:underline" @click="removeSlide(idx)">
                Удалить
              </button>
            </div>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="text-gray-700">Медиа</span>
                <input type="file" accept="image/*,video/mp4,video/webm" class="mt-1 text-sm" @change="(e) => onSlideFile(e, idx)">
                <span v-if="slide.mediaUrl" class="mt-1 block truncate text-xs text-gray-500">{{ slide.mediaUrl }}</span>
              </label>
              <label class="block text-sm">
                <span class="text-gray-700">Длительность (сек)</span>
                <input
                  v-model.number="slide.durationSeconds"
                  type="number"
                  min="1"
                  max="120"
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
              </label>
              <label class="block text-sm sm:col-span-2">
                <span class="text-gray-700">Действие кнопки</span>
                <select v-model="slide.actionType" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                  <option value="none">Нет</option>
                  <option value="add_to_cart">В корзину</option>
                  <option value="open_category">К категории</option>
                  <option value="apply_promo">Промокод (пока не на витрине)</option>
                </select>
              </label>
              <div v-if="slide.actionType === 'add_to_cart'" class="sm:col-span-2">
                <label class="block text-sm">
                  <span class="text-gray-700">ID товара (UUID)</span>
                  <input
                    v-model="slide.payloadItemId"
                    type="text"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                    placeholder="uuid позиции меню"
                  >
                </label>
                <label class="mt-2 block text-sm">
                  <span class="text-gray-700">Кол-во</span>
                  <input v-model.number="slide.payloadQty" type="number" min="1" class="mt-1 w-32 rounded-lg border border-gray-300 px-3 py-2">
                </label>
              </div>
              <div v-else-if="slide.actionType === 'open_category'" class="sm:col-span-2">
                <label class="block text-sm">
                  <span class="text-gray-700">Категория (как на витрине)</span>
                  <select v-model="slide.payloadCategory" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                    <option value="">— выберите —</option>
                    <option v-for="cat in categoryNames" :key="cat" :value="cat">
                      {{ cat }}
                    </option>
                  </select>
                </label>
                <p class="mt-1 text-xs text-gray-500">
                  В payload уйдёт <code>category</code> = строка id секции (имя категории в меню).
                </p>
              </div>
              <div v-else-if="slide.actionType === 'apply_promo'" class="sm:col-span-2">
                <label class="block text-sm">
                  <span class="text-gray-700">Код промокода</span>
                  <input
                    v-model="slide.payloadCode"
                    type="text"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                </label>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

definePageMeta({ layout: 'dashboard' })

type SlideForm = {
  clientKey: string
  id?: string
  mediaUrl: string
  durationSeconds: number
  actionType: string
  payloadItemId: string
  payloadQty: number
  payloadCategory: string
  payloadCode: string
}

const route = useRoute()
const id = computed(() => route.params.id as string)

const pending = ref(true)
const loadError = ref('')
const saving = ref(false)
const targetingJson = ref('{}')
const targetingError = ref('')

const form = ref({
  title: '',
  previewUrl: '' as string | null,
  placement: 'top_bar' as 'top_bar' | 'catalog_grid',
  isActive: true,
  validFrom: '' as string,
  validUntil: '' as string,
  slides: [] as SlideForm[],
})

const categoryNames = ref<string[]>([])

let clientKeySeq = 0
function nextKey() {
  clientKeySeq += 1
  return `new-${clientKeySeq}-${Date.now()}`
}

function addSlide() {
  form.value.slides.push({
    clientKey: nextKey(),
    mediaUrl: '',
    durationSeconds: 5,
    actionType: 'none',
    payloadItemId: '',
    payloadQty: 1,
    payloadCategory: '',
    payloadCode: '',
  })
}

function removeSlide(idx: number) {
  form.value.slides.splice(idx, 1)
}

function slideToPayload(s: SlideForm): Record<string, unknown> {
  if (s.actionType === 'add_to_cart') {
    const out: Record<string, unknown> = {}
    if (s.payloadItemId.trim()) out.item_id = s.payloadItemId.trim()
    if (s.payloadQty > 0) out.qty = s.payloadQty
    return out
  }
  if (s.actionType === 'open_category' && s.payloadCategory.trim()) {
    return { category: s.payloadCategory.trim() }
  }
  if (s.actionType === 'apply_promo' && s.payloadCode.trim()) {
    return { code: s.payloadCode.trim() }
  }
  return {}
}

function buildSlidesForSave(): Array<Record<string, unknown>> {
  return form.value.slides.map((s, idx) => {
    const base: Record<string, unknown> = {
      sortOrder: idx,
      mediaUrl: s.mediaUrl,
      durationSeconds: s.durationSeconds || 5,
      actionType: s.actionType,
      actionPayload: slideToPayload(s),
    }
    if (s.id) base.id = s.id
    return base
  })
}

async function uploadFile(file: File, kind: 'preview' | 'slide'): Promise<string> {
  const reader = new FileReader()
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const r = reader.result as string
      resolve(r.split(',')[1] || '')
    }
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
  const res = await fetch('/api/dashboard/stories/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      dataBase64: base64,
      kind,
    }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.statusMessage || 'Upload failed')
  return data.url as string
}

async function onPreviewFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    form.value.previewUrl = await uploadFile(file, 'preview')
  } catch (err: unknown) {
    alert(err instanceof Error ? err.message : 'Ошибка загрузки')
  }
  input.value = ''
}

async function onSlideFile(e: Event, idx: number) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    form.value.slides[idx].mediaUrl = await uploadFile(file, 'slide')
  } catch (err: unknown) {
    alert(err instanceof Error ? err.message : 'Ошибка загрузки')
  }
  input.value = ''
}

async function loadCategories() {
  try {
    const res = await fetch('/api/dashboard/menu/categories')
    const data = await res.json()
    if (data.ok && Array.isArray(data.items)) {
      categoryNames.value = data.items.map((c: { name: string }) => c.name).filter(Boolean)
    }
  } catch {
    categoryNames.value = []
  }
}

function hydrateSlide(raw: Record<string, unknown>, clientKey: string): SlideForm {
  const ap = (raw.actionPayload && typeof raw.actionPayload === 'object'
    ? raw.actionPayload
    : {}) as Record<string, unknown>
  const actionType = typeof raw.actionType === 'string' ? raw.actionType : 'none'
  let payloadItemId = ''
  let payloadQty = 1
  let payloadCategory = ''
  let payloadCode = ''
  if (actionType === 'add_to_cart') {
    payloadItemId =
      typeof ap.item_id === 'string'
        ? ap.item_id
        : typeof ap.product_id === 'string'
          ? ap.product_id
          : ''
    payloadQty = typeof ap.qty === 'number' && ap.qty > 0 ? ap.qty : 1
  } else if (actionType === 'open_category') {
    payloadCategory = typeof ap.category === 'string' ? ap.category : ''
  } else if (actionType === 'apply_promo') {
    payloadCode = typeof ap.code === 'string' ? ap.code : ''
  }
  return {
    clientKey,
    id: typeof raw.id === 'string' ? raw.id : undefined,
    mediaUrl: typeof raw.mediaUrl === 'string' ? raw.mediaUrl : '',
    durationSeconds:
      typeof raw.durationSeconds === 'number' ? raw.durationSeconds : 5,
    actionType,
    payloadItemId,
    payloadQty,
    payloadCategory,
    payloadCode,
  }
}

async function load() {
  pending.value = true
  loadError.value = ''
  try {
    const res = await fetch(`/api/dashboard/stories/campaigns/${id.value}`)
    const data = await res.json()
    if (!data.ok || !data.item) {
      loadError.value = data.statusMessage || 'Не найдено'
      return
    }
    const it = data.item
    form.value.title = it.title
    form.value.previewUrl = it.previewUrl
    form.value.placement = it.placement === 'catalog_grid' ? 'catalog_grid' : 'top_bar'
    form.value.isActive = !!it.isActive
    form.value.validFrom = it.validFrom ? isoToLocal(it.validFrom) : ''
    form.value.validUntil = it.validUntil ? isoToLocal(it.validUntil) : ''
    targetingJson.value = JSON.stringify(it.targeting ?? {}, null, 2)
    form.value.slides = (it.slides || []).map((s: Record<string, unknown>, i: number) =>
      hydrateSlide(s, `s-${i}-${String(s.id || '')}`),
    )
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : 'Ошибка'
  } finally {
    pending.value = false
  }
}

function isoToLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localToIsoOrNull(s: string): string | null {
  if (!s || !s.trim()) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

async function save() {
  targetingError.value = ''
  let targeting: Record<string, unknown> = {}
  try {
    targeting = JSON.parse(targetingJson.value || '{}') as Record<string, unknown>
    if (typeof targeting !== 'object' || targeting === null) throw new Error('Нужен объект JSON')
  } catch {
    targetingError.value = 'Некорректный JSON таргетинга'
    return
  }

  saving.value = true
  try {
    const body = {
      title: form.value.title,
      previewUrl: form.value.previewUrl,
      placement: form.value.placement,
      isActive: form.value.isActive,
      validFrom: localToIsoOrNull(form.value.validFrom),
      validUntil: localToIsoOrNull(form.value.validUntil),
      targeting,
      slides: buildSlidesForSave(),
    }
    const res = await fetch(`/api/dashboard/stories/campaigns/${id.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.ok) {
      await load()
      alert('Сохранено')
    } else {
      alert(data.statusMessage || 'Ошибка сохранения')
    }
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : 'Ошибка')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadCategories()
  await load()
})
</script>
