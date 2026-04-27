<template>
  <section class="space-y-4">
    <div class="flex items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Модерация UGC по городу</h1>
        <p class="mt-1 text-sm text-gray-600">Единая очередь фестивальных сторис и видеоотзывов с фильтрацией по городам.</p>
      </div>
      <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" @click="loadQueue">Обновить</button>
    </div>

    <div class="grid gap-2 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4">
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Статус</span>
        <select v-model="statusFilter" class="w-full rounded-lg border border-gray-300 px-3 py-2">
          <option value="pending">Pending</option>
          <option value="all">Все</option>
          <option value="approved_menu">Approved menu</option>
          <option value="approved_feed">Approved feed</option>
          <option value="approved_menu_and_feed">Approved both</option>
          <option value="rejected">Rejected</option>
          <option value="forwarded_to_corner">Forwarded</option>
          <option value="shadow_banned">Shadow banned</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Город</span>
        <select v-model="cityFilter" class="w-full rounded-lg border border-gray-300 px-3 py-2">
          <option value="">Все</option>
          <option v-for="c in cityOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Фестиваль</span>
        <select v-model="festivalFilter" class="w-full rounded-lg border border-gray-300 px-3 py-2">
          <option value="">Все</option>
          <option v-for="f in festivalOptions" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Формат</span>
        <select v-model="kindFilter" class="w-full rounded-lg border border-gray-300 px-3 py-2">
          <option value="all">Все</option>
          <option value="story">Story</option>
          <option value="video_review">Video review</option>
        </select>
      </label>
    </div>

    <div class="fixed right-4 top-4 z-[100] space-y-2">
      <div v-for="toast in toasts" :key="toast.id" class="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg" :class="toast.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'">
        <p class="max-w-xs">{{ toast.message }}</p>
        <button class="ml-1 text-xs" @click="dismissToast(toast.id)">x</button>
      </div>
    </div>

    <div v-if="pending" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Загрузка очереди...</div>
    <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{ errorMessage }}</div>
    <div v-else class="space-y-3">
      <div v-if="!items.length" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Пусто по выбранным фильтрам.</div>
      <article v-for="item in items" :key="item.id" class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-gray-900">{{ item.cityName }} • {{ item.restaurantName }}</p>
            <p class="text-xs text-gray-500">{{ item.festivalName }} • {{ item.kind }} • {{ item.createdAt }}</p>
            <p class="mt-1 text-xs text-gray-600">status: {{ item.status }} | rating: {{ item.rating ?? '—' }} | category: {{ item.category ?? '—' }}</p>
          </div>
          <span class="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">{{ item.id.slice(0, 8) }}</span>
        </div>
        <div class="mt-3">
          <video v-if="isVideo(item.mediaUrl)" :src="item.mediaUrl" controls class="max-h-56 w-full rounded-lg border border-gray-200 bg-black" />
          <img v-else :src="item.mediaUrl" alt="ugc preview" class="max-h-56 rounded-lg border border-gray-200 object-contain" />
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" @click="moderate(item.id, 'approve_menu')">В меню</button>
          <button class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" @click="moderate(item.id, 'approve_feed')">В ленту</button>
          <button class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" @click="moderate(item.id, 'approve_menu_and_feed')">Меню + лента</button>
          <button class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" @click="moderate(item.id, 'forward_to_corner')">Менеджеру</button>
          <button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50" @click="moderate(item.id, 'reject')">Отклонить</button>
          <button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50" @click="moderate(item.id, 'shadow_ban')">Теневой бан</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

definePageMeta({ layout: 'dashboard' })

type Item = {
  id: string
  cityName: string
  restaurantName: string
  festivalName: string
  kind: 'story' | 'video_review'
  status: string
  rating: number | null
  category: string | null
  mediaUrl: string
  createdAt: string
}

const pending = ref(false)
const errorMessage = ref('')
const items = ref<Item[]>([])
const cityOptions = ref<Array<{ id: string; name: string }>>([])
const festivalOptions = ref<Array<{ id: string; name: string; slug: string }>>([])
const statusFilter = ref('pending')
const cityFilter = ref('')
const festivalFilter = ref('')
const kindFilter = ref<'all' | 'story' | 'video_review'>('all')
const toasts = ref<Array<{ id: string; type: 'ok' | 'error'; message: string }>>([])

function pushToast(type: 'ok' | 'error', message: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  toasts.value.push({ id, type, message })
  setTimeout(() => dismissToast(id), type === 'error' ? 12000 : 5000)
}

function dismissToast(id: string) {
  toasts.value = toasts.value.filter((x: { id: string }) => x.id !== id)
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url)
}

async function loadQueue() {
  pending.value = true
  errorMessage.value = ''
  try {
    const query = new URLSearchParams()
    query.set('status', statusFilter.value)
    if (cityFilter.value) query.set('city_id', cityFilter.value)
    if (festivalFilter.value) query.set('festival_id', festivalFilter.value)
    if (kindFilter.value) query.set('kind', kindFilter.value)
    const response = await fetch(`/api/dashboard/moderation/city-ugc?${query.toString()}`)
    const payload = await response.json().catch(() => ({} as any))
    if (!response.ok) {
      throw new Error(payload?.statusMessage || 'Не удалось загрузить очередь модерации')
    }
    items.value = Array.isArray(payload.items) ? payload.items : []
    cityOptions.value = Array.isArray(payload?.filters?.cities) ? payload.filters.cities : []
    festivalOptions.value = Array.isArray(payload?.filters?.festivals) ? payload.filters.festivals : []
  } catch (err: any) {
    errorMessage.value = err?.message || 'Ошибка загрузки'
  } finally {
    pending.value = false
  }
}

async function moderate(submissionId: string, action: string) {
  const response = await fetch('/api/dashboard/moderation/city-ugc/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId, action }),
  })
  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok) {
    pushToast('error', payload?.statusMessage || 'Не удалось применить действие')
    return
  }
  pushToast('ok', 'Действие применено')
  await loadQueue()
}

watch([statusFilter, cityFilter, festivalFilter, kindFilter], () => {
  void loadQueue()
})

onMounted(async () => {
  await loadQueue()
})
</script>
