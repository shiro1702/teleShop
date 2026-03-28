<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Модификаторы</h1>
        <p class="mt-2 text-sm text-gray-600">Группы опций: размер, соус, добавки и ограничения выбора.</p>
      </div>
      <button
        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        @click="openCreateModal"
      >
        Создать группу
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white">
      <div v-if="pending" class="p-4 text-sm text-gray-500">Загрузка...</div>
      <div v-else-if="error" class="p-4 text-sm text-red-500">{{ error }}</div>
      <div v-else-if="!groups.length" class="p-4 text-sm text-gray-500">Нет модификаторов. Создайте первую группу.</div>
      
      <ul v-else class="divide-y divide-gray-100">
        <li v-for="group in groups" :key="group.id" class="p-4 hover:bg-gray-50">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900">{{ group.name }}</span>
                <span class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{{ group.selectionType }}</span>
                <span v-if="group.isRequired" class="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Обязательно</span>
              </div>
              <p class="mt-1 text-xs text-gray-500">
                Опций: {{ group.options.length }} 
                <span v-if="group.selectionType === 'multi'">
                  (от {{ group.minSelect }} до {{ group.maxSelect || '∞' }})
                </span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button class="text-sm text-primary hover:underline" @click="openEditModal(group)">Редактировать</button>
              <button class="text-sm text-red-600 hover:underline" @click="deleteGroup(group)">Удалить</button>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <span v-for="opt in group.options" :key="opt.id" class="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
              {{ opt.name }} 
              <span v-if="opt.pricingType === 'multiplier'" class="text-blue-600">×{{ opt.priceMultiplier || 1 }}</span>
              <span v-else-if="opt.priceDelta > 0" class="text-green-600">+{{ opt.priceDelta }}₽</span>
              <span v-else-if="opt.priceDelta < 0" class="text-red-600">{{ opt.priceDelta }}₽</span>
            </span>
          </div>
        </li>
      </ul>
    </div>

    <!-- Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
        <h2 class="text-lg font-semibold shrink-0">{{ editingGroup ? 'Редактировать группу' : 'Новая группа' }}</h2>
        
        <form @submit.prevent="saveGroup" class="mt-4 flex-1 overflow-y-auto pr-2 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Название группы</label>
              <input v-model="form.name" type="text" required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Например: Размер пиццы" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Тип выбора</label>
              <select v-model="form.selectionType" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="single">Один вариант (Single)</option>
                <option value="multi">Несколько (Multi)</option>
                <option value="boolean">Да/Нет (Boolean)</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2">
              <input v-model="form.isRequired" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary" />
              <span class="text-sm text-gray-700">Обязательный выбор</span>
            </label>
            <label class="flex items-center gap-2">
              <input v-model="form.isActive" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary" />
              <span class="text-sm text-gray-700">Группа активна</span>
            </label>
          </div>

          <div v-if="form.selectionType === 'multi'" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Мин. выбор</label>
              <input v-model.number="form.minSelect" type="number" min="0" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Макс. выбор (пусто = без лимита)</label>
              <input v-model.number="form.maxSelect" type="number" min="1" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          <div class="border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-gray-900">Опции</h3>
              <button type="button" class="text-xs text-primary hover:underline" @click="addOption">Добавить опцию</button>
            </div>
            
            <div class="space-y-2">
              <div v-for="(opt, idx) in form.options" :key="idx" class="flex items-center gap-2">
                <input v-model="opt.name" type="text" placeholder="Название" required class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                <select v-model="opt.pricingType" class="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="delta">+/- сумма</option>
                  <option value="multiplier">Множитель</option>
                </select>
                <div class="relative w-28">
                  <input
                    v-if="opt.pricingType === 'delta'"
                    v-model.number="opt.priceDelta"
                    type="number"
                    placeholder="0"
                    class="w-full rounded-lg border border-gray-300 pl-3 pr-6 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span v-if="opt.pricingType === 'delta'" class="absolute right-2 top-1.5 text-gray-400 text-sm">₽</span>
                  <input
                    v-else
                    v-model.number="opt.priceMultiplier"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="1.00"
                    class="w-full rounded-lg border border-gray-300 pl-6 pr-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span v-if="opt.pricingType === 'multiplier'" class="absolute left-2 top-1.5 text-gray-400 text-sm">×</span>
                </div>
                <label class="flex items-center gap-1 cursor-pointer" title="Сделать по умолчанию">
                  <input type="checkbox" v-model="opt.isDefault" class="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" />
                  <span class="text-xs text-gray-500">По ум.</span>
                </label>
                <button type="button" class="text-red-500 hover:text-red-700 p-1" @click="removeOption(idx)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <div v-if="!form.options.length" class="text-xs text-gray-500 italic">
                Добавьте хотя бы одну опцию
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-4 shrink-0">
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

type Option = {
  id?: string
  name: string
  pricingType: 'delta' | 'multiplier'
  priceDelta: number
  priceMultiplier: number | null
  isDefault: boolean
  isActive: boolean
  sortOrder: number
  externalId: string | null
}

type Group = {
  id: string
  name: string
  selectionType: 'single' | 'multi' | 'boolean'
  isRequired: boolean
  minSelect: number
  maxSelect: number | null
  isActive: boolean
  sortOrder: number
  externalId: string | null
  options: Option[]
}

const groups = ref<Group[]>([])
const pending = ref(true)
const error = ref('')

const isModalOpen = ref(false)
const editingGroup = ref<Group | null>(null)
const saving = ref(false)
const form = ref({
  name: '',
  selectionType: 'single' as 'single' | 'multi' | 'boolean',
  isRequired: false,
  minSelect: 0,
  maxSelect: null as number | null,
  isActive: true,
  sortOrder: 0,
  externalId: '',
  options: [] as Option[]
})

async function fetchGroups() {
  pending.value = true
  try {
    const res = await fetch('/api/dashboard/menu/modifiers')
    const data = await res.json()
    if (data.ok) {
      groups.value = (data.items || []).map((group: Group) => ({
        ...group,
        options: (group.options || []).map((opt) => ({
          ...opt,
          pricingType: opt.pricingType || 'delta',
          priceMultiplier: opt.priceMultiplier ?? null,
          priceDelta: opt.priceDelta ?? 0
        }))
      }))
    } else {
      error.value = data.statusMessage || 'Ошибка загрузки'
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    pending.value = false
  }
}

onMounted(fetchGroups)

function openCreateModal() {
  editingGroup.value = null
  form.value = { 
    name: '', 
    selectionType: 'single', 
    isRequired: false, 
    minSelect: 0, 
    maxSelect: null, 
    isActive: true, 
    sortOrder: 0, 
    externalId: '',
    options: [] 
  }
  isModalOpen.value = true
}

function openEditModal(group: Group) {
  editingGroup.value = group
  form.value = { 
    name: group.name, 
    selectionType: group.selectionType, 
    isRequired: group.isRequired, 
    minSelect: group.minSelect, 
    maxSelect: group.maxSelect, 
    isActive: group.isActive, 
    sortOrder: group.sortOrder, 
    externalId: group.externalId || '',
    options: JSON.parse(JSON.stringify(group.options))
  }
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
}

function addOption() {
  form.value.options.push({
    name: '',
    pricingType: 'delta',
    priceDelta: 0,
    priceMultiplier: null,
    isDefault: false,
    isActive: true,
    sortOrder: form.value.options.length,
    externalId: null
  })
}

function removeOption(idx: number) {
  form.value.options.splice(idx, 1)
}

async function saveGroup() {
  saving.value = true
  try {
    const isEdit = !!editingGroup.value
    const url = isEdit 
      ? `/api/dashboard/menu/modifiers/${editingGroup.value!.id}`
      : '/api/dashboard/menu/modifiers'
    
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    
    const data = await res.json()
    if (data.ok) {
      await fetchGroups()
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

async function deleteGroup(group: Group) {
  if (!confirm(`Удалить группу модификаторов "${group.name}"?`)) return
  
  try {
    const res = await fetch(`/api/dashboard/menu/modifiers/${group.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) {
      await fetchGroups()
    } else {
      alert(data.statusMessage || 'Ошибка удаления')
    }
  } catch (e: any) {
    alert(e.message)
  }
}
</script>
