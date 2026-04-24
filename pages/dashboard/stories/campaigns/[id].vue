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
        <h2 class="text-lg font-medium text-gray-900">Предпросмотр</h2>
        <p class="mt-1 text-sm text-gray-500">
          Как будет выглядеть кружок в ленте и экран сторис для гостя.
        </p>
        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p class="text-sm font-medium text-gray-800">
              {{ form.placement === 'catalog_grid' ? 'Превью в сетке каталога' : 'Превью в ленте сторис' }}
            </p>
            <div
              v-if="form.placement === 'top_bar'"
              class="relative mt-4 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6"
            >
              <button
                type="button"
                class="absolute left-1 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white/90 text-gray-700 shadow-sm backdrop-blur md:inline-flex"
                style="border-color: rgb(245, 194, 222);"
                aria-label="Прокрутить сторисы влево"
              >
                ←
              </button>

              <div class="flex gap-3 overflow-x-auto [scrollbar-width:none]">
                <button
                  type="button"
                  class="group relative h-[176px] w-[128px] shrink-0 overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:h-[240px] sm:w-[200px]"
                  style="border-color: rgb(245, 194, 222); background-color: rgb(20, 22, 43);"
                >
                  <img
                    v-if="previewCardImageUrl"
                    :src="previewCardImageUrl"
                    :alt="previewStoryTitle"
                    class="h-full w-full object-cover"
                  >
                  <div
                    v-else
                    class="flex h-full w-full items-end bg-gradient-to-br from-gray-700 to-gray-900 px-3 pb-4 text-left sm:px-4 sm:pb-5"
                  >
                    <p class="line-clamp-3 text-sm font-semibold leading-tight text-white sm:text-base">
                      {{ previewStoryTitle }}
                    </p>
                  </div>
                  <div
                    class="pointer-events-none absolute inset-0 rounded-2xl border-0 transition group-hover:border-2"
                    style="border-color: rgb(220, 50, 146);"
                  />
                </button>
              </div>

              <button
                type="button"
                class="absolute right-1 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white/90 text-gray-700 shadow-sm backdrop-blur md:inline-flex"
                style="border-color: rgb(245, 194, 222);"
                aria-label="Прокрутить сторисы вправо"
              >
                →
              </button>
            </div>

            <ul
              v-else
              class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
            >
              <li v-for="i in 2" :key="`product-pre-${i}`" class="flex">
                <article class="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-[#14162b] shadow-sm">
                  <div class="aspect-square w-full bg-gray-800" />
                  <div class="p-4">
                    <div class="h-4 w-2/3 rounded bg-gray-600/60" />
                    <div class="mt-2 h-3 w-full rounded bg-gray-600/40" />
                    <div class="mt-3 h-9 w-full rounded-lg bg-pink-200/80" />
                  </div>
                </article>
              </li>

              <li class="flex">
                <article
                  class="flex h-full min-h-[280px] w-full cursor-pointer flex-col overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[320px]"
                  role="button"
                  style="border-color: rgb(245, 194, 222); background-color: rgb(20, 22, 43);"
                >
                  <div class="relative flex min-h-0 flex-1 flex-col">
                    <img
                      v-if="previewCardImageUrl"
                      :src="previewCardImageUrl"
                      :alt="previewStoryTitle"
                      class="absolute inset-0 h-full w-full object-cover"
                    >
                    <div
                      v-else
                      class="absolute inset-0 flex items-center justify-center px-4 text-center text-white"
                      style="background: linear-gradient(145deg, #334155 0%, rgba(15,23,42,0.88) 85%);"
                    >
                      <span class="text-sm font-semibold">{{ previewStoryTitle }}</span>
                    </div>
                    <div class="relative mt-auto bg-gradient-to-t from-black/70 to-transparent p-4 pt-16">
                      <p class="text-sm font-semibold text-white drop-shadow">{{ previewStoryTitle }}</p>
                      <p class="mt-1 text-xs text-white/90">Сториз</p>
                    </div>
                  </div>
                </article>
              </li>

              <li class="flex">
                <article class="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-[#14162b] shadow-sm">
                  <div class="aspect-square w-full bg-gray-800" />
                  <div class="p-4">
                    <div class="h-4 w-2/3 rounded bg-gray-600/60" />
                    <div class="mt-2 h-3 w-full rounded bg-gray-600/40" />
                    <div class="mt-3 h-9 w-full rounded-lg bg-pink-200/80" />
                  </div>
                </article>
              </li>
            </ul>
          </div>

          <div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium text-gray-800">Сторис на витрине</p>
              <div v-if="form.slides.length > 1" class="flex max-w-[55%] items-center gap-1 overflow-x-auto">
                <button
                  v-for="(_, idx) in form.slides"
                  :key="`preview-slide-${idx}`"
                  type="button"
                  class="shrink-0 rounded-full border px-2 py-1 text-xs transition-colors"
                  :class="idx === previewSlideIndex ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 text-gray-600 hover:bg-white'"
                  @click="previewSlideIndex = idx"
                >
                  {{ idx + 1 }}
                </button>
              </div>
            </div>

            <div class="mt-4 rounded-2xl bg-black/75 p-3 sm:p-4">
              <div class="relative mx-auto h-full w-full max-w-[400px]">
                <button
                  type="button"
                  class="absolute -right-2 -top-2 z-20 rounded-full bg-black/55 p-2 text-white shadow-sm sm:-right-12 sm:top-0"
                  aria-label="Закрыть"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div class="relative aspect-[9/16] w-full overflow-hidden rounded-3xl bg-black">
                <template v-if="previewSlide">
                  <img
                    v-if="previewIsImage"
                    :src="previewSlide.mediaUrl"
                    alt="Story slide preview"
                    class="h-full w-full object-cover"
                  >
                  <video
                    v-else-if="previewIsVideo"
                    :src="previewSlide.mediaUrl"
                    class="h-full w-full object-cover"
                    muted
                    loop
                    autoplay
                    playsinline
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-end bg-gradient-to-br from-gray-700 to-gray-900 p-4 text-white"
                  >
                    <div class="space-y-2">
                      <p class="text-lg font-semibold">{{ previewSlide.payloadTitle || form.title || 'Сторис' }}</p>
                      <p class="text-xs text-white/80">{{ previewSlide.payloadText || 'Здесь будет ваш текст слайда.' }}</p>
                    </div>
                  </div>

                  <div class="absolute inset-x-3 top-3 flex gap-1">
                    <div
                      v-for="(_, idx) in form.slides.length || 1"
                      :key="`progress-${idx}`"
                      class="h-1 flex-1 rounded-full"
                      :class="idx <= previewSlideIndex ? 'bg-white' : 'bg-white/35'"
                    />
                  </div>

                  <div
                    v-if="previewSlide.actionType !== 'none'"
                    class="absolute inset-x-3 bottom-3 rounded-xl bg-white px-3 py-2 text-center text-sm font-semibold text-gray-900"
                  >
                    {{ previewActionLabel }}
                  </div>
                </template>
                <div v-else class="flex h-full items-center justify-center px-4 text-center text-sm text-white/75">
                  Добавьте хотя бы один слайд, чтобы увидеть предпросмотр сторис.
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

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
                <span class="text-gray-700">Заголовок fallback-слайда</span>
                <input
                  v-model="slide.payloadTitle"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Заголовок для режима без картинки"
                >
              </label>
              <label class="block text-sm sm:col-span-2">
                <span class="text-gray-700">Текст fallback-слайда</span>
                <textarea
                  v-model="slide.payloadText"
                  rows="2"
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Короткий текст, который покажется на сторис без медиа"
                />
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
                <select
                  v-model="slide.actionType"
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  @change="onSlideActionTypeChange(slide.actionType)"
                >
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
                  <select
                    v-model="slide.payloadCategory"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    @focus="ensureCategoriesLoaded"
                  >
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
import { computed, onMounted, ref, watch } from 'vue'
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
  payloadTitle: string
  payloadText: string
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
const previewSlideIndex = ref(0)
const categoriesLoaded = ref(false)
const categoriesLoading = ref(false)

const previewSlide = computed(() => {
  if (!form.value.slides.length) return null
  const safeIndex = Math.min(previewSlideIndex.value, form.value.slides.length - 1)
  return form.value.slides[safeIndex] ?? null
})

const previewActionLabel = computed(() => {
  const type = previewSlide.value?.actionType
  if (type === 'add_to_cart') return 'В корзину'
  if (type === 'open_category') return 'К категории'
  if (type === 'apply_promo') return 'Применить промокод'
  return 'Подробнее'
})

const previewIsImage = computed(() => isImageUrl(previewSlide.value?.mediaUrl || ''))
const previewIsVideo = computed(() => isVideoUrl(previewSlide.value?.mediaUrl || ''))
const previewCardImageUrl = computed(() => {
  if (form.value.previewUrl) return form.value.previewUrl
  if (previewSlide.value && isImageUrl(previewSlide.value.mediaUrl)) return previewSlide.value.mediaUrl
  return ''
})
const previewStoryTitle = computed(() => form.value.title?.trim() || 'Название кампании')

let clientKeySeq = 0
function nextKey() {
  clientKeySeq += 1
  return `new-${clientKeySeq}-${Date.now()}`
}

function isImageUrl(url: string): boolean {
  return !!url && /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)
}

function isVideoUrl(url: string): boolean {
  return !!url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
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
    payloadTitle: '',
    payloadText: '',
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
    if (s.payloadTitle.trim()) out.title = s.payloadTitle.trim()
    if (s.payloadText.trim()) out.text = s.payloadText.trim()
    return out
  }
  if (s.actionType === 'open_category' && s.payloadCategory.trim()) {
    return {
      category: s.payloadCategory.trim(),
      ...(s.payloadTitle.trim() ? { title: s.payloadTitle.trim() } : {}),
      ...(s.payloadText.trim() ? { text: s.payloadText.trim() } : {}),
    }
  }
  if (s.actionType === 'apply_promo' && s.payloadCode.trim()) {
    return {
      code: s.payloadCode.trim(),
      ...(s.payloadTitle.trim() ? { title: s.payloadTitle.trim() } : {}),
      ...(s.payloadText.trim() ? { text: s.payloadText.trim() } : {}),
    }
  }
  return {
    ...(s.payloadTitle.trim() ? { title: s.payloadTitle.trim() } : {}),
    ...(s.payloadText.trim() ? { text: s.payloadText.trim() } : {}),
  }
}

function buildSlidesForSave(): Array<Record<string, unknown>> {
  return form.value.slides.map((s: SlideForm, idx: number) => {
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

async function ensureCategoriesLoaded() {
  if (categoriesLoaded.value || categoriesLoading.value) return
  categoriesLoading.value = true
  try {
    await loadCategories()
    categoriesLoaded.value = true
  } finally {
    categoriesLoading.value = false
  }
}

function onSlideActionTypeChange(actionType: string) {
  if (actionType === 'open_category') {
    void ensureCategoriesLoaded()
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
  const payloadTitle = typeof ap.title === 'string' ? ap.title : ''
  const payloadText = typeof ap.text === 'string' ? ap.text : ''
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
    payloadTitle,
    payloadText,
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
  await load()
})

watch(
  () => form.value.slides.length,
  (length: number) => {
    if (!length) {
      previewSlideIndex.value = 0
      return
    }
    if (previewSlideIndex.value > length - 1) {
      previewSlideIndex.value = length - 1
    }
  },
)

watch(
  () => form.value.slides.some((slide: SlideForm) => slide.actionType === 'open_category'),
  (hasOpenCategoryAction: boolean) => {
    if (hasOpenCategoryAction) {
      void ensureCategoriesLoaded()
    }
  },
  { immediate: true },
)
</script>
