<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <NuxtLink to="/dashboard/menu" class="text-sm text-primary hover:underline">&larr; Назад в меню</NuxtLink>
        <h1 class="mt-2 text-2xl font-semibold">Типы параметров</h1>
        <p class="mt-2 text-sm text-gray-600">Справочник типов параметров (например, "Размер", "Объём"). Сами варианты и цены задаются в карточке товара.</p>
      </div>
      <button
        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        @click="openCreateModal"
      >
        Добавить тип
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white">
      <div v-if="pending" class="p-4 text-sm text-gray-500">Загрузка...</div>
      <div v-else-if="error" class="p-4 text-sm text-red-500">{{ error }}</div>
      <div v-else-if="!items.length" class="p-4 text-sm text-gray-500">Нет типов параметров. Создайте первый.</div>
      
      <ul v-else class="divide-y divide-gray-100">
        <li v-for="item in items" :key="item.id" class="flex items-center justify-between p-4 hover:bg-gray-50">
          <div>
            <p class="font-medium text-gray-900">{{ item.name }}</p>
            <p class="text-xs text-gray-500">Код: {{ item.code }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="text-sm text-primary hover:underline" @click="openEditModal(item)">Редактировать</button>
            <button class="text-sm text-red-600 hover:underline" @click="deleteItem(item)">Удалить</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="closeModal">
      <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold">{{ editingItem ? 'Редактировать тип' : 'Новый тип параметра' }}</h2>
        
        <form @submit.prevent="saveItem" class="mt-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Название (для витрины)</label>
            <input v-model="form.name" type="text" required placeholder="Например: Размер пиццы" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Код (системный)</label>
            <input v-model="form.code" type="text" required placeholder="Например: diameter_cm" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Сортировка</label>
            <input v-model.number="form.sort_order" type="number" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div class="border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-gray-900">Опции параметра</h3>
              <button type="button" class="text-sm text-primary hover:underline" @click="addOption">
                + Добавить опцию
              </button>
            </div>
            
            <div v-if="form.options.length === 0" class="text-xs text-gray-500 italic mb-4">
              Добавьте опции (например: 25 см, 30 см, 35 см). Цены для них будут задаваться в карточке товара.
            </div>

            <div class="space-y-2">
              <div v-for="(opt, idx) in form.options" :key="idx" class="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                <div class="flex-1 grid grid-cols-2 gap-2">
                  <input v-model="opt.name" type="text" placeholder="Название (30 см)" required class="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  <div class="flex items-center gap-2">
                    <label class="flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" v-model="opt.is_active" class="h-3 w-3 text-primary focus:ring-primary" />
                      Активен
                    </label>
                  </div>
                </div>
                <button type="button" class="text-gray-400 hover:text-red-600" @click="removeOption(idx)">
                  &times;
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100" @click="closeModal">Отмена</button>
            <button type="submit" class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90" :disabled="isSaving">
              {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })

type ParameterOption = {
  id?: string
  name: string
  weight_g?: number | null
  volume_ml?: number | null
  pieces?: number | null
  is_active: boolean
  sort_order: number
  external_id?: string | null
}

type ParameterKind = {
  id: string
  code: string
  name: string
  sort_order: number
  parameter_options?: ParameterOption[]
}

const { data, pending, error, refresh } = useFetch<{ ok: boolean; items: ParameterKind[] }>('/api/dashboard/menu/parameters')
const items = computed(() => data.value?.items || [])

const isModalOpen = ref(false)
const isSaving = ref(false)
const editingItem = ref<ParameterKind | null>(null)

const form = ref({
  name: '',
  code: '',
  sort_order: 0,
  options: [] as ParameterOption[]
})

function openCreateModal() {
  editingItem.value = null
  form.value = { name: '', code: '', sort_order: 0, options: [] }
  isModalOpen.value = true
}

function openEditModal(item: ParameterKind) {
  editingItem.value = item
  form.value = { 
    name: item.name, 
    code: item.code, 
    sort_order: item.sort_order,
    options: JSON.parse(JSON.stringify(item.parameter_options || []))
  }
  isModalOpen.value = true
}

function addOption() {
  form.value.options.push({
    name: '',
    is_active: true,
    sort_order: form.value.options.length
  })
}

function removeOption(idx: number) {
  form.value.options.splice(idx, 1)
}

function closeModal() {
  isModalOpen.value = false
}

async function saveItem() {
  if (isSaving.value) return
  isSaving.value = true
  try {
    if (editingItem.value) {
      await $fetch(`/api/dashboard/menu/parameters/${editingItem.value.id}`, {
        method: 'PUT',
        body: form.value
      })
    } else {
      await $fetch('/api/dashboard/menu/parameters', {
        method: 'POST',
        body: form.value
      })
    }
    await refresh()
    closeModal()
  } catch (err) {
    alert('Ошибка при сохранении')
    console.error(err)
  } finally {
    isSaving.value = false
  }
}

async function deleteItem(item: ParameterKind) {
  if (!confirm(`Удалить тип параметра "${item.name}"?`)) return
  try {
    await $fetch(`/api/dashboard/menu/parameters/${item.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err) {
    alert('Ошибка при удалении')
    console.error(err)
  }
}
</script>
