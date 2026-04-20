<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Позиции меню</h1>
        <p class="mt-2 text-sm text-gray-600">Управление товарами, ценами и доступностью.</p>
      </div>
      <button
        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        @click="openCreateModal"
      >
        Создать позицию
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white">
      <div v-if="pending" class="p-4 text-sm text-gray-500">Загрузка...</div>
      <div v-else-if="error" class="p-4 text-sm text-red-500">{{ error }}</div>
      <div v-else-if="!items.length" class="p-4 text-sm text-gray-500">Нет товаров. Создайте первый.</div>
      
      <div v-else class="space-y-2 p-2">
        <div v-for="group in groupedItems" :key="group.categoryId || group.categoryName" class="rounded-lg border border-gray-100">
          <div class="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            {{ group.categoryName }}
          </div>
          <div class="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <article v-for="item in group.items" :key="item.id" class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div class="mb-3 flex items-start gap-3">
                <div class="h-14 w-14 overflow-hidden rounded bg-gray-100">
                  <img v-if="item.image" :src="item.image" class="h-full w-full object-cover" />
                </div>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium text-gray-900">{{ item.name }}</span>
                    <span v-if="!item.isActive" class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Скрыт</span>
                    <span v-if="(item.deliveryRestrictedOverride ?? item.categoryDeliveryRestricted) === true" class="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Без доставки</span>
                  </div>
                  <p class="mt-1 text-xs text-gray-500">
                    <span v-if="item.parameterKinds && item.parameterKinds.length > 0 || item.categoryParameterKindIds && item.categoryParameterKindIds.length > 0">от </span>{{ item.price }} ₽
                  </p>
                </div>
              </div>
              <div class="flex items-center justify-end gap-3">
                <button class="text-sm text-primary hover:underline" @click="openEditModal(item)">Редактировать</button>
                <button class="text-sm text-red-600 hover:underline" @click="deleteItem(item)">Удалить</button>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="closeModal">
      <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold">{{ editingItem ? 'Редактировать позицию' : 'Новая позиция' }}</h2>
        
        <form @submit.prevent="saveItem" class="mt-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Название</label>
            <input v-model="form.name" type="text" required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Цена (₽)</label>
              <input v-model.number="form.price" type="number" min="0" required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Категория</label>
              <select v-model="form.categoryId" required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="" disabled>Выберите категорию</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Описание</label>
            <textarea v-model="form.description" rows="2" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"></textarea>
          </div>

          <div class="border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-gray-900">Параметры (варианты с разной ценой)</h3>
            </div>
            
            <div v-if="allParameterKinds.length === 0" class="text-xs text-gray-500 italic mb-4">
              Нет доступных параметров.
            </div>

            <div v-for="kind in allParameterKinds" :key="kind.id" class="mb-4 rounded-lg border border-gray-200 p-3 bg-gray-50">
              <div class="flex items-center justify-between gap-3 mb-3">
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-900">
                    {{ kind.name }}
                    <span v-if="kind.source !== 'product'" class="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                      из категории
                    </span>
                  </p>
                </div>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" :checked="isParameterKindEnabled(kind.id, kind.source)" @change="toggleParameterKind(kind.id, kind.source)" class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  {{ kind.source === 'product' ? 'Подключить' : 'Включено для товара' }}
                </label>
              </div>

              <div v-if="isParameterKindEnabled(kind.id, kind.source)" class="space-y-2">
                <div v-for="opt in kind.parameter_options" :key="opt.id" class="flex items-center gap-2 bg-white p-2 rounded border border-gray-100">
                  <div class="flex-1 grid grid-cols-[1fr_auto] gap-2 items-center">
                     <span class="text-sm text-gray-700">{{ opt.name }}</span>
                     <input v-model.number="getOptionOverride(opt.id).price" type="number" min="0" placeholder="Цена (₽)" class="block w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" @input="syncBasePrice" />
                  </div>
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-1 text-xs text-gray-600" title="Включена">
                      <input type="checkbox" v-model="getOptionOverride(opt.id).isActive" class="h-3 w-3 text-primary focus:ring-primary" @change="syncBasePrice" />
                      Вкл.
                    </label>
                    <label class="flex items-center gap-1 text-xs text-gray-600" title="По умолчанию">
                      <input type="radio" :name="`default_opt_${kind.id}`" :checked="getOptionOverride(opt.id).isDefault" @change="setDefaultOption(kind.id, opt.id)" class="h-3 w-3 text-primary focus:ring-primary" />
                      Деф.
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-gray-900">Модификаторы</h3>
            </div>
            <div class="space-y-2">
              <div v-for="group in allModifierGroups" :key="group.id" class="rounded-lg border border-gray-100 p-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-gray-900">
                      {{ group.name }}
                      <span v-if="group.source !== 'product'" class="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                        из категории
                      </span>
                    </p>
                    <p class="text-xs text-gray-500">{{ group.selectionType }} • Опций: {{ group.optionsCount }}</p>
                  </div>
                  <label class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      :checked="isGroupEnabled(group.id, group.source)"
                      @change="toggleGroup(group.id, group.source)"
                      class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span class="text-sm text-gray-700">
                      {{ group.source === 'product' ? 'Подключить' : 'Включено для товара' }}
                    </span>
                  </label>
                </div>

                <div v-if="group.source !== 'product' && isGroupEnabled(group.id, group.source) && group.options.length" class="mt-3 rounded-lg bg-gray-50 p-3">
                  <p class="mb-2 text-xs font-medium text-gray-600">Доступные опции для этого товара</p>
                  <div class="grid gap-2 sm:grid-cols-2">
                    <label v-for="option in group.options" :key="option.id" class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        :checked="isOptionEnabled(group.id, option.id)"
                        @change="toggleOption(group.id, option.id)"
                        class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span class="text-sm text-gray-700">{{ option.name }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="rounded-lg border border-dashed border-gray-300 p-3">
                <p class="mb-2 text-xs font-medium text-gray-600">Добавить модификаторы только для этого товара</p>
                <div class="grid gap-2 sm:grid-cols-2">
                  <label
                    v-for="group in modifierGroups.filter((g) => !categoryModifierGroupIds.includes(g.id) && !form.modifierGroupIds.includes(g.id))"
                    :key="`new-${group.id}`"
                    class="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1.5"
                  >
                    <input
                      type="checkbox"
                      :checked="false"
                      @change="toggleGroup(group.id, 'product')"
                      class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span class="text-sm text-gray-700">{{ group.name }}</span>
                  </label>
                </div>
              </div>

              <div v-if="!modifierGroups.length" class="text-xs text-gray-500 italic">
                Нет доступных модификаторов. Создайте их в разделе "Модификаторы".
              </div>
            </div>
          </div>

          <div class="border-t border-gray-200 pt-4">
            <label class="block text-sm font-medium text-gray-700">Изображение</label>
            <div class="mt-1 flex items-center gap-4">
              <div v-if="form.image" class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <img :src="form.image" class="h-full w-full object-cover" />
              </div>
              <div class="flex-1">
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp"
                  class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary-100"
                  @change="handleImageUpload"
                  :disabled="uploadingImage"
                />
                <p class="mt-1 text-xs text-gray-500">PNG, JPG, WEBP до 2MB</p>
              </div>
            </div>
            <p v-if="uploadError" class="mt-1 text-xs text-red-500">{{ uploadError }}</p>
          </div>
          
          <div class="flex items-center gap-2">
            <input v-model="form.isActive" type="checkbox" id="isActive" class="rounded border-gray-300 text-primary focus:ring-primary" />
            <label for="isActive" class="text-sm text-gray-700">Позиция активна (глобально)</label>
          </div>

          <div class="space-y-2 rounded-lg border border-gray-200 p-3">
            <p class="text-sm font-medium text-gray-900">Ограничение на доставку</p>
            <select v-model="form.deliveryRestrictedOverride" class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option :value="null">Наследовать от категории</option>
              <option :value="true">Только в&nbsp;ресторане/самовывоз/QR</option>
              <option :value="false">Разрешить доставку (снять ограничение категории)</option>
            </select>
          </div>

          <div class="border-t border-gray-200 pt-4">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-900">Окна доступности товара</h3>
              <button type="button" class="text-sm text-primary hover:underline" @click="addWindow">Добавить окно</button>
            </div>
            <div v-if="!form.availabilityWindows.length" class="text-xs text-gray-500">Если не задано, будет использоваться расписание категории.</div>
            <div v-for="(w, idx) in form.availabilityWindows" :key="idx" class="mb-2 rounded-lg border border-gray-200 p-2">
              <div class="mb-2 grid grid-cols-2 gap-2">
                <input v-model="w.start" type="time" class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                <input v-model="w.end" type="time" class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="d in dayOptions"
                  :key="d.value"
                  type="button"
                  class="rounded border px-2 py-1 text-xs"
                  :class="w.days.includes(d.value) ? 'border-primary bg-primary text-white' : 'border-gray-300 text-gray-700'"
                  @click="toggleWindowDay(idx, d.value)"
                >
                  {{ d.label }}
                </button>
              </div>
              <button type="button" class="mt-2 text-xs text-red-600 hover:underline" @click="removeWindow(idx)">Удалить окно</button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Внешний ID (iiko)</label>
            <input v-model="form.externalId" type="text" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div class="flex justify-end gap-3 pt-4">
            <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100" @click="closeModal">Отмена</button>
            <button type="submit" class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50" :disabled="saving || uploadingImage">
              {{ saving ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

definePageMeta({ layout: 'dashboard' })

type ParameterOption = {
  id: string
  name: string
}

type ParameterKind = {
  id: string
  code: string
  name: string
  parameter_options?: ParameterOption[]
}

type ProductParameterKind = {
  parameterKindId: string
  isRequired: boolean
}

type ProductParameterOptionOverride = {
  price?: number
  isDisabled: boolean
  isDefault: boolean
  isActive?: boolean
}

type Item = {
  id: string
  name: string
  price: number
  image: string
  description: string
  categoryId: string
  categoryName: string
  isActive: boolean
  sortOrder: number
  externalId: string | null
  deliveryRestrictedOverride: boolean | null
  categoryDeliveryRestricted?: boolean
  availabilityWindows?: Array<{ days: number[]; start: string; end: string }>
  categoryAvailabilityWindows?: Array<{ days: number[]; start: string; end: string }>
  modifierGroupIds?: string[]
  categoryModifierGroupIds?: string[]
  modifierOverrides?: Record<string, { isDisabled: boolean; disabledOptionIds: string[] }>
  parameterKinds?: ProductParameterKind[]
  categoryParameterKindIds?: string[]
  parameterOptionOverrides?: Record<string, ProductParameterOptionOverride>
}

type Category = {
  id: string
  name: string
  deliveryRestricted?: boolean
  availabilityWindows?: Array<{ days: number[]; start: string; end: string }>
  modifierGroupIds?: string[]
  parameterKindIds?: string[]
}

type ModifierGroup = {
  id: string
  name: string
  selectionType: string
  optionsCount: number
  options: Array<{ id: string; name: string }>
}

const items = ref<Item[]>([])
const categories = ref<Category[]>([])
const modifierGroups = ref<ModifierGroup[]>([])
const parameterKinds = ref<ParameterKind[]>([])
const pending = ref(true)
const error = ref('')

const isModalOpen = ref(false)
const editingItem = ref<Item | null>(null)
const saving = ref(false)
const uploadingImage = ref(false)
const uploadError = ref('')

const form = ref({
  name: '',
  price: 0,
  image: '',
  description: '',
  categoryId: '',
  isActive: true,
  sortOrder: 0,
  externalId: '',
  deliveryRestrictedOverride: null as boolean | null,
  availabilityWindows: [] as Array<{ days: number[]; start: string; end: string }>,
  modifierGroupIds: [] as string[],
  categoryModifierGroupIds: [] as string[],
  modifierOverrides: {} as Record<string, { isDisabled: boolean; disabledOptionIds: string[] }>,
  parameterKinds: [] as ProductParameterKind[],
  parameterOptionOverrides: {} as Record<string, ProductParameterOptionOverride>
})
const dayOptions = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' }
]

const groupedItems = computed(() => {
  const groups = new Map<string, { categoryId: string | null; categoryName: string; items: Item[] }>()
  for (const item of items.value) {
    const categoryId = item.categoryId || null
    const categoryName = item.categoryName || 'Без категории'
    const key = categoryId || `none:${categoryName}`

    if (!groups.has(key)) {
      groups.set(key, { categoryId, categoryName, items: [] })
    }
    groups.get(key)!.items.push(item)
  }
  return Array.from(groups.values())
})

const categoryModifierGroupIds = computed(() => {
  const category = categories.value.find((cat) => cat.id === form.value.categoryId)
  return category?.modifierGroupIds || []
})

const allModifierGroups = computed(() => {
  const categorySet = new Set(categoryModifierGroupIds.value)
  const directSet = new Set(form.value.modifierGroupIds)
  const result: Array<ModifierGroup & { source: 'category' | 'product' | 'both' }> = []

  for (const group of modifierGroups.value) {
    const fromCategory = categorySet.has(group.id)
    const fromProduct = directSet.has(group.id)
    if (!fromCategory && !fromProduct) continue

    let source: 'category' | 'product' | 'both' = 'product'
    if (fromCategory && fromProduct) source = 'both'
    else if (fromCategory) source = 'category'

    result.push({ ...group, source })
  }

  return result
})

function ensureOverride(groupId: string) {
  if (!form.value.modifierOverrides[groupId]) {
    form.value.modifierOverrides[groupId] = { isDisabled: false, disabledOptionIds: [] }
  }
  return form.value.modifierOverrides[groupId]
}

const categoryParameterKindIds = computed(() => {
  const category = categories.value.find((cat) => cat.id === form.value.categoryId)
  return category?.parameterKindIds || []
})

const allParameterKinds = computed(() => {
  const categorySet = new Set(categoryParameterKindIds.value)
  const directSet = new Set(form.value.parameterKinds.map(pk => pk.parameterKindId))
  const result: Array<ParameterKind & { source: 'category' | 'product' | 'both' }> = []

  for (const kind of parameterKinds.value) {
    const fromCategory = categorySet.has(kind.id)
    const fromProduct = directSet.has(kind.id)
    if (!fromCategory && !fromProduct) continue

    let source: 'category' | 'product' | 'both' = 'product'
    if (fromCategory && fromProduct) source = 'both'
    else if (fromCategory) source = 'category'

    result.push({ ...kind, source })
  }

  return result
})

function getOptionOverride(optionId: string) {
  if (!form.value.parameterOptionOverrides[optionId]) {
    form.value.parameterOptionOverrides[optionId] = { price: undefined, isDisabled: false, isDefault: false, isActive: true }
  }
  return form.value.parameterOptionOverrides[optionId]
}

function isParameterKindEnabled(kindId: string, source: 'category' | 'product' | 'both') {
  if (source === 'product') return form.value.parameterKinds.some(pk => pk.parameterKindId === kindId)
  // For category inherited, it's always enabled unless we add logic to disable entire kinds
  return true
}

function toggleParameterKind(kindId: string, source: 'category' | 'product' | 'both') {
  if (source === 'product') {
    const idx = form.value.parameterKinds.findIndex(pk => pk.parameterKindId === kindId)
    if (idx === -1) form.value.parameterKinds.push({ parameterKindId: kindId, isRequired: true })
    else form.value.parameterKinds.splice(idx, 1)
    return
  }
  // If we want to allow disabling category inherited kinds, we need a new override structure for that
}

function setDefaultOption(kindId: string, optionId: string) {
  const kind = parameterKinds.value.find(k => k.id === kindId)
  if (!kind || !kind.parameter_options) return

  kind.parameter_options.forEach(opt => {
    const override = getOptionOverride(opt.id)
    override.isDefault = opt.id === optionId
  })
}

function syncBasePrice() {
  let minPrice: number | null = null
  
  for (const kind of allParameterKinds.value) {
    if (!isParameterKindEnabled(kind.id, kind.source)) continue
    
    if (kind.parameter_options) {
      for (const opt of kind.parameter_options) {
        const override = getOptionOverride(opt.id)
        if (override.isActive !== false && override.price !== undefined && override.price !== null) {
          if (minPrice === null || override.price < minPrice) {
            minPrice = override.price
          }
        }
      }
    }
  }

  if (minPrice !== null) {
    form.value.price = minPrice
  }
}

function isGroupEnabled(groupId: string, source: 'category' | 'product' | 'both') {
  if (source === 'product') return form.value.modifierGroupIds.includes(groupId)
  const override = ensureOverride(groupId)
  return !override.isDisabled
}

function toggleGroup(groupId: string, source: 'category' | 'product' | 'both') {
  if (source === 'product') {
    const idx = form.value.modifierGroupIds.indexOf(groupId)
    if (idx === -1) form.value.modifierGroupIds.push(groupId)
    else form.value.modifierGroupIds.splice(idx, 1)
    return
  }

  const override = ensureOverride(groupId)
  override.isDisabled = !override.isDisabled
}

function isOptionEnabled(groupId: string, optionId: string) {
  const override = ensureOverride(groupId)
  return !override.disabledOptionIds.includes(optionId)
}

function toggleOption(groupId: string, optionId: string) {
  const override = ensureOverride(groupId)
  const idx = override.disabledOptionIds.indexOf(optionId)
  if (idx === -1) override.disabledOptionIds.push(optionId)
  else override.disabledOptionIds.splice(idx, 1)
}

async function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  
  const file = input.files[0]
  uploadError.value = ''
  
  // Validate size
  if (file.size > 2 * 1024 * 1024) {
    uploadError.value = 'Файл слишком большой (максимум 2MB)'
    input.value = ''
    return
  }
  
  // Validate type
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    uploadError.value = 'Неподдерживаемый формат (разрешены PNG, JPG, WEBP)'
    input.value = ''
    return
  }

  uploadingImage.value = true
  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      
      const res = await fetch('/api/dashboard/menu/items/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          dataBase64: base64
        })
      })
      
      const data = await res.json()
      if (data.ok) {
        form.value.image = data.url
      } else {
        uploadError.value = data.statusMessage || 'Ошибка загрузки'
      }
      uploadingImage.value = false
    }
    reader.readAsDataURL(file)
  } catch (err: any) {
    uploadError.value = err.message || 'Ошибка загрузки'
    uploadingImage.value = false
  }
}

async function fetchData() {
  pending.value = true
  try {
    const [itemsRes, catsRes, modsRes, paramsRes] = await Promise.all([
      fetch('/api/dashboard/menu/items'),
      fetch('/api/dashboard/menu/categories'),
      fetch('/api/dashboard/menu/modifiers'),
      fetch('/api/dashboard/menu/parameters')
    ])
    
    const itemsData = await itemsRes.json()
    const catsData = await catsRes.json()
    const modsData = await modsRes.json()
    const paramsData = await paramsRes.json()
    
    if (itemsData.ok) items.value = itemsData.items
    if (catsData.ok) categories.value = catsData.items
    if (paramsData.ok) parameterKinds.value = paramsData.items
    if (modsData.ok) {
      modifierGroups.value = modsData.items.map((g: any) => ({
        id: g.id,
        name: g.name,
        selectionType: g.selectionType,
        optionsCount: g.options?.length || 0,
        options: Array.isArray(g.options) ? g.options.map((opt: any) => ({ id: opt.id, name: opt.name })) : []
      }))
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    pending.value = false
  }
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isModalOpen.value) {
    closeModal()
  }
}

onMounted(() => {
  fetchData()
  window.addEventListener('keydown', onWindowKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown)
})

function openCreateModal() {
  editingItem.value = null
  uploadError.value = ''
  form.value = { 
    name: '', price: 0, image: '', description: '', 
    categoryId: categories.value[0]?.id || '', 
    isActive: true, sortOrder: 0, externalId: '',
    deliveryRestrictedOverride: null,
    availabilityWindows: [],
    modifierGroupIds: [],
    categoryModifierGroupIds: [],
    modifierOverrides: {},
    parameterKinds: [],
    parameterOptionOverrides: {}
  }
  isModalOpen.value = true
}

function openEditModal(item: Item) {
  editingItem.value = item
  uploadError.value = ''
  form.value = { 
    name: item.name, 
    price: item.price, 
    image: item.image || '', 
    description: item.description || '', 
    categoryId: item.categoryId || '', 
    isActive: item.isActive, 
    sortOrder: item.sortOrder, 
    externalId: item.externalId || '',
    deliveryRestrictedOverride: item.deliveryRestrictedOverride ?? null,
    availabilityWindows: JSON.parse(JSON.stringify(item.availabilityWindows || [])),
    modifierGroupIds: item.modifierGroupIds || [],
    categoryModifierGroupIds: item.categoryModifierGroupIds || [],
    modifierOverrides: item.modifierOverrides || {},
    parameterKinds: JSON.parse(JSON.stringify(item.parameterKinds || [])),
    parameterOptionOverrides: JSON.parse(JSON.stringify(item.parameterOptionOverrides || {}))
  }
  isModalOpen.value = true
}

function addWindow() {
  form.value.availabilityWindows.push({ days: [1, 2, 3, 4, 5], start: '08:00', end: '12:00' })
}

function removeWindow(idx: number) {
  form.value.availabilityWindows.splice(idx, 1)
}

function toggleWindowDay(windowIdx: number, day: number) {
  const row = form.value.availabilityWindows[windowIdx]
  if (!row) return
  if (row.days.includes(day)) row.days = row.days.filter((x: number) => x !== day)
  else row.days = [...row.days, day].sort((a, b) => a - b)
}

function closeModal() {
  isModalOpen.value = false
}

async function saveItem() {
  saving.value = true
  try {
    const isEdit = !!editingItem.value
    const url = isEdit 
      ? `/api/dashboard/menu/items/${editingItem.value!.id}`
      : '/api/dashboard/menu/items'
    
    // Convert parameterOptionOverrides object to array for API
    const payload = {
      ...form.value,
      parameterOptionOverrides: (Object.entries(form.value.parameterOptionOverrides) as Array<[string, ProductParameterOptionOverride]>).map(([optionId, override]) => ({
        optionId,
        price: override.price,
        isDisabled: !!override.isDisabled,
        isDefault: !!override.isDefault,
        isActive: override.isActive !== false
      }))
    }

    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    const data = await res.json()
    if (data.ok) {
      await fetchData()
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

async function deleteItem(item: Item) {
  if (!confirm(`Удалить позицию "${item.name}"?`)) return
  
  try {
    const res = await fetch(`/api/dashboard/menu/items/${item.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) {
      await fetchData()
    } else {
      alert(data.statusMessage || 'Ошибка удаления')
    }
  } catch (e: any) {
    alert(e.message)
  }
}
</script>
