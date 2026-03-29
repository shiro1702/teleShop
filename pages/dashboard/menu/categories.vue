<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Категории меню</h1>
        <p class="mt-2 text-sm text-gray-600">Управление категориями и их порядком.</p>
      </div>
      <button
        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        @click="openCreateModal"
      >
        Создать категорию
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white">
      <div v-if="pending" class="p-4 text-sm text-gray-500">Загрузка...</div>
      <div v-else-if="error" class="p-4 text-sm text-red-500">{{ error }}</div>
      <div v-else-if="!categories.length" class="p-4 text-sm text-gray-500">Нет категорий. Создайте первую.</div>
      
      <ul v-else class="divide-y divide-gray-100">
        <li v-for="cat in categories" :key="cat.id" class="flex items-center justify-between p-4 hover:bg-gray-50">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-medium text-gray-900">{{ cat.name }}</span>
              <span v-if="!cat.isActive" class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Скрыта</span>
            </div>
            <p class="mt-1 text-xs text-gray-500">Товаров: {{ cat.productsCount }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="text-sm text-primary hover:underline" @click="openEditModal(cat)">Редактировать</button>
            <button class="text-sm text-red-600 hover:underline" @click="deleteCategory(cat)">Удалить</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold">{{ editingCategory ? 'Редактировать категорию' : 'Новая категория' }}</h2>
        
        <form @submit.prevent="saveCategory" class="mt-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Название</label>
            <input v-model="form.name" type="text" required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          
          <div class="flex items-center gap-2">
            <input v-model="form.isActive" type="checkbox" id="isActive" class="rounded border-gray-300 text-primary focus:ring-primary" />
            <label for="isActive" class="text-sm text-gray-700">Категория активна</label>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Порядок сортировки</label>
            <input v-model.number="form.sortOrder" type="number" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div class="border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-gray-900">Параметры для категории</h3>
            </div>
            <p class="text-xs text-gray-500 mb-2">Эти типы параметров будут применяться ко всем товарам в этой категории.</p>
            <div class="space-y-2 max-h-40 overflow-y-auto">
              <div v-for="kind in parameterKinds" :key="kind.id" class="flex items-center justify-between rounded-lg border border-gray-100 p-2">
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ kind.name }}</p>
                </div>
                <label class="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    :checked="form.parameterKindIds.includes(kind.id)"
                    @change="toggleParameterKind(kind.id)"
                    class="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                </label>
              </div>
              <div v-if="!parameterKinds.length" class="text-xs text-gray-500 italic">
                Нет доступных типов параметров.
              </div>
            </div>
          </div>

          <div class="border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-gray-900">Модификаторы для категории</h3>
            </div>
            <p class="text-xs text-gray-500 mb-2">Эти модификаторы будут применяться ко всем товарам в этой категории.</p>
            <div class="space-y-2 max-h-40 overflow-y-auto">
              <div v-for="group in modifierGroups" :key="group.id" class="flex items-center justify-between rounded-lg border border-gray-100 p-2">
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ group.name }}</p>
                </div>
                <label class="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    :checked="form.modifierGroupIds.includes(group.id)"
                    @change="toggleModifierGroup(group.id)"
                    class="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                </label>
              </div>
              <div v-if="!modifierGroups.length" class="text-xs text-gray-500 italic">
                Нет доступных модификаторов.
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Внешний ID (iiko)</label>
            <input v-model="form.externalId" type="text" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div class="flex justify-end gap-3 pt-4">
            <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100" @click="closeModal">Отмена</button>
            <button type="submit" class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90" :disabled="saving">
              {{ saving ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: 'dashboard' })

type Category = {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
  externalId: string | null
  productsCount: number
  modifierGroupIds?: string[]
  parameterKindIds?: string[]
}

type ModifierGroup = {
  id: string
  name: string
}

type ParameterKind = {
  id: string
  name: string
}

const categories = ref<Category[]>([])
const modifierGroups = ref<ModifierGroup[]>([])
const parameterKinds = ref<ParameterKind[]>([])
const pending = ref(true)
const error = ref('')

const isModalOpen = ref(false)
const editingCategory = ref<Category | null>(null)
const saving = ref(false)
const form = ref({
  name: '',
  isActive: true,
  sortOrder: 0,
  externalId: '',
  modifierGroupIds: [] as string[],
  parameterKindIds: [] as string[]
})

function toggleModifierGroup(id: string) {
  const idx = form.value.modifierGroupIds.indexOf(id)
  if (idx === -1) {
    form.value.modifierGroupIds.push(id)
  } else {
    form.value.modifierGroupIds.splice(idx, 1)
  }
}

function toggleParameterKind(id: string) {
  const idx = form.value.parameterKindIds.indexOf(id)
  if (idx === -1) {
    form.value.parameterKindIds.push(id)
  } else {
    form.value.parameterKindIds.splice(idx, 1)
  }
}

async function fetchCategories() {
  pending.value = true
  try {
    const [catsRes, modsRes, paramsRes] = await Promise.all([
      fetch('/api/dashboard/menu/categories'),
      fetch('/api/dashboard/menu/modifiers'),
      fetch('/api/dashboard/menu/parameters')
    ])
    
    const catsData = await catsRes.json()
    const modsData = await modsRes.json()
    const paramsData = await paramsRes.json()
    
    if (catsData.ok) {
      categories.value = catsData.items
    } else {
      error.value = catsData.statusMessage || 'Ошибка загрузки категорий'
    }
    
    if (modsData.ok) {
      modifierGroups.value = modsData.items.map((g: any) => ({
        id: g.id,
        name: g.name
      }))
    }

    if (paramsData.ok) {
      parameterKinds.value = paramsData.items.map((k: any) => ({
        id: k.id,
        name: k.name
      }))
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    pending.value = false
  }
}

onMounted(fetchCategories)

function openCreateModal() {
  editingCategory.value = null
  form.value = { name: '', isActive: true, sortOrder: 0, externalId: '', modifierGroupIds: [], parameterKindIds: [] }
  isModalOpen.value = true
}

function openEditModal(cat: Category) {
  editingCategory.value = cat
  form.value = { 
    name: cat.name, 
    isActive: cat.isActive, 
    sortOrder: cat.sortOrder, 
    externalId: cat.externalId || '',
    modifierGroupIds: cat.modifierGroupIds || [],
    parameterKindIds: cat.parameterKindIds || []
  }
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
}

async function saveCategory() {
  saving.value = true
  try {
    const isEdit = !!editingCategory.value
    const url = isEdit 
      ? `/api/dashboard/menu/categories/${editingCategory.value!.id}`
      : '/api/dashboard/menu/categories'
    
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    
    const data = await res.json()
    if (data.ok) {
      await fetchCategories()
      closeModal()
    } else {
      alert(data.statusMessage || 'Ошибка сохранения')
    }
  } catch (e: any) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}

async function deleteCategory(cat: Category) {
  if (cat.productsCount > 0) {
    alert('Нельзя удалить категорию с товарами.')
    return
  }
  if (!confirm(`Удалить категорию "${cat.name}"?`)) return
  
  try {
    const res = await fetch(`/api/dashboard/menu/categories/${cat.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) {
      await fetchCategories()
    } else {
      alert(data.statusMessage || 'Ошибка удаления')
    }
  } catch (e: any) {
    alert(e.message)
  }
}
</script>
