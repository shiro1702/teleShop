<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Меню филиала</h1>
        <p class="mt-2 text-sm text-gray-600">Управление стоп-листами и локальными ценами.</p>
      </div>
      <button
        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        :disabled="saving || !hasChanges"
        @click="saveOverrides"
      >
        {{ saving ? 'Сохранение...' : 'Сохранить изменения' }}
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white">
      <div v-if="pending" class="p-4 text-sm text-gray-500">Загрузка...</div>
      <div v-else-if="error" class="p-4 text-sm text-red-500">{{ error }}</div>
      <div v-else-if="!items.length" class="p-4 text-sm text-gray-500">В глобальном меню нет активных товаров.</div>
      
      <div v-else class="divide-y divide-gray-100">
        <div v-for="group in groupedItems" :key="group.category" class="p-4">
          <h2 class="mb-3 text-sm font-semibold text-gray-900">{{ group.category }}</h2>
          <div class="space-y-3">
            <div v-for="item in group.items" :key="item.id" class="flex items-center justify-between rounded-lg border border-gray-100 p-3" :class="{'bg-red-50/50': item.isInStopList, 'bg-gray-50/50': item.isHidden}">
              <div class="flex-1">
                <p class="font-medium text-gray-900" :class="{'line-through text-gray-500': item.isInStopList || item.isHidden}">
                  {{ item.name }}
                </p>
                <p class="text-xs text-gray-500">Базовая цена: {{ item.basePrice }} ₽</p>
              </div>
              
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2">
                  <span class="text-xs text-gray-600">Своя цена:</span>
                  <input 
                    v-model.number="item.priceOverride" 
                    type="number" 
                    min="0" 
                    placeholder="Базовая" 
                    class="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    @input="markChanged"
                  />
                </label>
                
                <label class="flex items-center gap-2">
                  <input 
                    v-model="item.isInStopList" 
                    type="checkbox" 
                    class="rounded border-gray-300 text-red-600 focus:ring-red-600"
                    @change="markChanged"
                  />
                  <span class="text-xs text-gray-700">В стоп-листе</span>
                </label>

                <label class="flex items-center gap-2">
                  <input 
                    v-model="item.isHidden" 
                    type="checkbox" 
                    class="rounded border-gray-300 text-gray-600 focus:ring-gray-600"
                    @change="markChanged"
                  />
                  <span class="text-xs text-gray-700">Скрыть</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const restaurantId = route.params.id as string

type Item = {
  id: string
  name: string
  basePrice: number
  categoryId: string
  categoryName: string
  sortOrder: number
  priceOverride: number | null
  isHidden: boolean
  isInStopList: boolean
}

const items = ref<Item[]>([])
const pending = ref(true)
const error = ref('')
const saving = ref(false)
const hasChanges = ref(false)

async function fetchMenu() {
  pending.value = true
  try {
    const res = await fetch(`/api/dashboard/branches/${restaurantId}/menu`)
    const data = await res.json()
    if (data.ok) {
      items.value = data.items
      hasChanges.value = false
    } else {
      error.value = data.statusMessage || 'Ошибка загрузки'
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    pending.value = false
  }
}

onMounted(fetchMenu)

const groupedItems = computed(() => {
  const map = new Map<string, Item[]>()
  items.value.forEach(item => {
    const cat = item.categoryName || 'Без категории'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  })
  return Array.from(map.entries()).map(([category, catItems]) => ({
    category,
    items: catItems
  }))
})

function markChanged() {
  hasChanges.value = true
}

async function saveOverrides() {
  saving.value = true
  try {
    const overrides = items.value.map(item => ({
      productId: item.id,
      priceOverride: item.priceOverride === '' ? null : item.priceOverride,
      isHidden: item.isHidden,
      isInStopList: item.isInStopList
    }))

    const res = await fetch(`/api/dashboard/branches/${restaurantId}/menu`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides })
    })

    const data = await res.json()
    if (data.ok) {
      hasChanges.value = false
      alert('Изменения сохранены')
    } else {
      alert(data.statusMessage || 'Ошибка сохранения')
    }
  } catch (e: any) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}
</script>
