<template>
  <section class="mx-auto max-w-2xl">
    <nav class="mb-3 flex items-center gap-2 text-sm text-gray-500">
      <NuxtLink to="/dashboard" class="hover:text-gray-700">Дашборд</NuxtLink>
      <span>/</span>
      <NuxtLink to="/dashboard/branches" class="hover:text-gray-700">Филиалы</NuxtLink>
      <span>/</span>
      <span class="text-gray-700">Новый филиал</span>
    </nav>

    <div class="mb-3">
      <NuxtLink
        to="/dashboard/branches"
        class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        <span aria-hidden="true">←</span>
        Назад к списку филиалов
      </NuxtLink>
    </div>

    <h1 class="text-2xl font-semibold">Новый филиал</h1>
    <p class="mt-2 text-sm text-gray-600">Создайте филиал для текущей организации.</p>

    <form class="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5" @submit.prevent="submit">
      <label class="block space-y-1">
        <span class="text-sm font-medium text-gray-700">Название</span>
        <input
          v-model="name"
          type="text"
          required
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Филиал на Ленина"
        >
      </label>

      <label class="block space-y-1">
        <span class="text-sm font-medium text-gray-700">Адрес</span>
        <input
          v-model="address"
          type="text"
          required
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="ул. Ленина, 10"
        >
      </label>

      <div class="flex gap-5 text-sm text-gray-700">
        <label class="inline-flex items-center gap-2">
          <input v-model="supportsDelivery" type="checkbox" class="rounded border-gray-300">
          Доставка
        </label>
        <label class="inline-flex items-center gap-2">
          <input v-model="supportsPickup" type="checkbox" class="rounded border-gray-300">
          Самовывоз
        </label>
      </div>

      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
      <p v-if="successMessage" class="text-sm text-green-700">{{ successMessage }}</p>

      <button
        type="submit"
        class="rounded-lg bg-[#E25E2D] px-4 py-2 text-sm font-medium text-white hover:bg-[#C84E24] disabled:opacity-50"
        :disabled="loading"
      >
        {{ loading ? 'Создание…' : 'Создать филиал' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
declare const definePageMeta: (meta: Record<string, unknown>) => void

definePageMeta({ layout: 'dashboard' })

const name = ref('')
const address = ref('')
const supportsDelivery = ref(true)
const supportsPickup = ref(true)
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const router = useRouter()

async function submit() {
  loading.value = true
  errorMessage.value = null
  successMessage.value = null
  try {
    const existing = await fetch('/api/dashboard/restaurants')
    if (existing.ok) {
      const payload = await existing.json() as { ok: boolean; items?: Array<{ name: string; address: string }> }
      const duplicate = (payload.items || []).some((item) =>
        item.name.trim().toLowerCase() === name.value.trim().toLowerCase()
        && item.address.trim().toLowerCase() === address.value.trim().toLowerCase())
      if (duplicate) {
        throw new Error('Филиал с таким названием и адресом уже существует')
      }
    }

    const httpRes = await fetch('/api/dashboard/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value,
        address: address.value,
        supportsDelivery: supportsDelivery.value,
        supportsPickup: supportsPickup.value,
      }),
    })
    const res = await httpRes.json() as { ok: boolean; item?: { id: string; name: string } }
    if (!res?.ok) {
      throw new Error('Не удалось создать филиал')
    }
    successMessage.value = `Филиал "${res.item?.name || name.value}" создан`
    if (res.item?.id) {
      await router.push(`/dashboard/branches/${res.item.id}`)
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Ошибка создания филиала'
  } finally {
    loading.value = false
  }
}
</script>
