<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Сториз</h1>
        <p class="mt-2 text-sm text-gray-600">
          Кампании для витрины: кружочки над каталогом и баннеры в сетке товаров.
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        :disabled="creating"
        @click="createDraft"
      >
        {{ creating ? 'Создание…' : 'Новая кампания' }}
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white">
      <div v-if="pending" class="p-4 text-sm text-gray-500">Загрузка…</div>
      <div v-else-if="error" class="p-4 text-sm text-red-500">{{ error }}</div>
      <div v-else-if="!items.length" class="p-4 text-sm text-gray-500">Нет кампаний.</div>
      <ul v-else class="divide-y divide-gray-100">
        <li
          v-for="c in items"
          :key="c.id"
          class="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-gray-50"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div
              class="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-50"
            >
              <img
                v-if="c.previewUrl"
                :src="c.previewUrl"
                alt=""
                class="h-full w-full object-cover"
              >
            </div>
            <div class="min-w-0">
              <p class="font-medium text-gray-900">{{ c.title }}</p>
              <p class="mt-0.5 text-xs text-gray-500">
                {{ c.placement === 'top_bar' ? 'Верхняя полоса' : 'Сетка каталога' }}
                · слайдов: {{ c.slides?.length ?? 0 }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <NuxtLink
              :to="`/dashboard/stories/campaigns/${c.id}`"
              class="text-sm text-primary hover:underline"
            >
              Редактировать
            </NuxtLink>
            <button
              type="button"
              class="text-sm text-red-600 hover:underline"
              @click="remove(c)"
            >
              Удалить
            </button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

definePageMeta({ layout: 'dashboard' })

type Item = {
  id: string
  title: string
  previewUrl: string | null
  placement: string
  slides: unknown[]
}

const router = useRouter()
const items = ref<Item[]>([])
const pending = ref(true)
const error = ref('')
const creating = ref(false)

async function fetchList() {
  pending.value = true
  error.value = ''
  try {
    const res = await fetch('/api/dashboard/stories/campaigns')
    const data = await res.json()
    if (data.ok) items.value = data.items ?? []
    else error.value = data.statusMessage || 'Ошибка загрузки'
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Ошибка'
  } finally {
    pending.value = false
  }
}

async function createDraft() {
  creating.value = true
  try {
    const res = await fetch('/api/dashboard/stories/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Новая кампания',
        placement: 'top_bar',
        isActive: false,
        slides: [],
      }),
    })
    const data = await res.json()
    if (data.ok && data.id) {
      await router.push(`/dashboard/stories/campaigns/${data.id}`)
    } else {
      alert(data.statusMessage || 'Не удалось создать')
    }
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : 'Ошибка')
  } finally {
    creating.value = false
  }
}

async function remove(c: Item) {
  if (!confirm(`Удалить кампанию «${c.title}»?`)) return
  try {
    const res = await fetch(`/api/dashboard/stories/campaigns/${c.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) await fetchList()
    else alert(data.statusMessage || 'Ошибка удаления')
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : 'Ошибка')
  }
}

onMounted(fetchList)
</script>
