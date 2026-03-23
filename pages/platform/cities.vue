<template>
  <section class="space-y-4">
    <header>
      <h1 class="text-2xl font-semibold">Города платформы</h1>
      <p class="mt-2 text-sm text-gray-600">
        Read-only список городов и текущий статус активности.
      </p>
    </header>

    <div v-if="pending" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Загружаем список городов...
    </div>

    <div v-else-if="errorMessage" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <div v-else-if="!cities.length" class="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Города пока не заведены.
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Город</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Slug</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Статус</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="city in cities" :key="city.id">
            <td class="px-4 py-3 text-sm text-gray-900">{{ city.name }}</td>
            <td class="px-4 py-3 font-mono text-sm text-gray-600">{{ city.slug }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                :class="city.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
              >
                {{ city.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

declare const definePageMeta: (meta: Record<string, unknown>) => void

definePageMeta({ layout: 'dashboard' })

type PlatformCity = {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
}

const pending = ref(true)
const errorMessage = ref<string | null>(null)
const cities = ref<PlatformCity[]>([])

onMounted(async () => {
  pending.value = true
  errorMessage.value = null
  try {
    const res = await fetch('/api/platform-cities')
    if (!res.ok) {
      throw new Error('Не удалось загрузить список городов')
    }
    const json = await res.json() as { ok: boolean; items: PlatformCity[] }
    if (!json.ok) {
      throw new Error('Некорректный ответ API городов')
    }
    cities.value = Array.isArray(json.items) ? json.items : []
  } catch (err: any) {
    errorMessage.value = err?.message || 'Ошибка загрузки городов'
  } finally {
    pending.value = false
  }
})
</script>
