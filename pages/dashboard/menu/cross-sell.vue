<template>
  <section class="space-y-4">
    <div class="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg"
        :class="toast.kind === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'"
        role="status"
      >
        <span class="min-w-0 flex-1 break-words">{{ toast.message }}</span>
        <button
          type="button"
          class="shrink-0 rounded px-1 leading-none text-gray-500 hover:bg-black/5 hover:text-gray-800"
          aria-label="Закрыть"
          @click="dismissToast(toast.id)"
        >
          ×
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Апсейл и кросс-сейл</h1>
        <p class="mt-2 text-sm text-gray-600">
          Настройка рекомендаций в корзине: товарные связи, категорийные связи и fallback категории.
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
        :disabled="loading || saving"
        @click="saveRules"
      >
        {{ saving ? 'Сохраняем...' : 'Сохранить правила' }}
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
      Для one-click апсейла не рекомендуйте сложные SKU с обязательными модификаторами: они будут отфильтрованы на сервере.
    </div>

    <div v-if="loading" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
      Загружаем правила апсейла...
    </div>

    <template v-else>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-gray-900">Связи товар → товар</h2>
          <button
            type="button"
            class="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
            @click="addProductLink"
          >
            Добавить связь
          </button>
        </div>

        <div v-if="!productLinksDraft.length" class="text-sm text-gray-500">
          Нет связей. Добавьте первую товарную рекомендацию.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="(row, index) in productLinksDraft"
            :key="`pl-${index}`"
            class="grid gap-2 rounded-lg border border-gray-100 p-2 md:grid-cols-[minmax(300px,1fr),minmax(300px,1fr),100px,100px]"
          >
            <select
              v-model="row.sourceProductId"
              class="rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Источник</option>
              <option v-for="item in products" :key="`src-${item.id}`" :value="item.id">
                {{ item.name }}
              </option>
            </select>
            <select
              v-model="row.targetProductId"
              class="rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Рекомендация</option>
              <option v-for="item in products" :key="`target-${item.id}`" :value="item.id">
                {{ item.name }}
              </option>
            </select>
            <input
              v-model.number="row.sortOrder"
              type="number"
              class="rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Порядок"
            >
            <button
              type="button"
              class="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              @click="removeProductLink(index)"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-gray-900">Связи категория → категория</h2>
          <button
            type="button"
            class="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
            @click="addCategoryLink"
          >
            Добавить связь
          </button>
        </div>

        <div v-if="!categoryLinksDraft.length" class="text-sm text-gray-500">
          Нет связей. Добавьте первую категорийную рекомендацию.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="(row, index) in categoryLinksDraft"
            :key="`cl-${index}`"
            class="grid gap-2 rounded-lg border border-gray-100 p-2 md:grid-cols-[minmax(300px,1fr),minmax(300px,1fr),100px,100px]"
          >
            <select
              v-model="row.sourceCategoryId"
              class="rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Источник</option>
              <option v-for="item in categories" :key="`src-cat-${item.id}`" :value="item.id">
                {{ item.name }}
              </option>
            </select>
            <select
              v-model="row.targetCategoryId"
              class="rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Рекомендация</option>
              <option v-for="item in categories" :key="`target-cat-${item.id}`" :value="item.id">
                {{ item.name }}
              </option>
            </select>
            <input
              v-model.number="row.sortOrder"
              type="number"
              class="rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Порядок"
            >
            <button
              type="button"
              class="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              @click="removeCategoryLink(index)"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-gray-900">Глобальные fallback категории</h2>
          <button
            type="button"
            class="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
            @click="addGlobalCategory"
          >
            Добавить категорию
          </button>
        </div>

        <div v-if="!globalCategoriesDraft.length" class="text-sm text-gray-500">
          Нет fallback категорий.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="(row, index) in globalCategoriesDraft"
            :key="`gc-${index}`"
            class="grid gap-2 rounded-lg border border-gray-100 p-2 md:grid-cols-[1fr,120px,auto]"
          >
            <select
              v-model="row.targetCategoryId"
              class="rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Категория</option>
              <option v-for="item in categories" :key="`global-cat-${item.id}`" :value="item.id">
                {{ item.name }}
              </option>
            </select>
            <input
              v-model.number="row.sortOrder"
              type="number"
              class="rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Порядок"
            >
            <button
              type="button"
              class="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              @click="removeGlobalCategory(index)"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">

definePageMeta({ layout: 'dashboard' })

type Product = {
  id: string
  name: string
}

type Category = {
  id: string
  name: string
}

type ProductLinkDraft = {
  sourceProductId: string
  targetProductId: string
  sortOrder: number
}

type CategoryLinkDraft = {
  sourceCategoryId: string
  targetCategoryId: string
  sortOrder: number
}

type GlobalCategoryDraft = {
  targetCategoryId: string
  sortOrder: number
}

const loading = ref(true)
const saving = ref(false)
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const productLinksDraft = ref<ProductLinkDraft[]>([])
const categoryLinksDraft = ref<CategoryLinkDraft[]>([])
const globalCategoriesDraft = ref<GlobalCategoryDraft[]>([])
const toasts = ref<Array<{ id: number; kind: 'success' | 'error'; message: string }>>([])
let toastSeq = 0

function dismissToast(id: number) {
  toasts.value = toasts.value.filter((item: { id: number }) => item.id !== id)
}

function pushToast(kind: 'success' | 'error', message: string, durationMs?: number) {
  const id = ++toastSeq
  toasts.value.push({ id, kind, message })
  setTimeout(() => dismissToast(id), durationMs ?? (kind === 'error' ? 12000 : 5000))
}

function addProductLink() {
  productLinksDraft.value.push({ sourceProductId: '', targetProductId: '', sortOrder: 0 })
}

function removeProductLink(index: number) {
  productLinksDraft.value.splice(index, 1)
}

function addCategoryLink() {
  categoryLinksDraft.value.push({ sourceCategoryId: '', targetCategoryId: '', sortOrder: 0 })
}

function removeCategoryLink(index: number) {
  categoryLinksDraft.value.splice(index, 1)
}

function addGlobalCategory() {
  globalCategoriesDraft.value.push({ targetCategoryId: '', sortOrder: 0 })
}

function removeGlobalCategory(index: number) {
  globalCategoriesDraft.value.splice(index, 1)
}

async function loadData() {
  loading.value = true
  try {
    const [rulesRes, productsRes, categoriesRes] = await Promise.all([
      $fetch<{
        ok: boolean
        productLinks: Array<{ sourceProductId: string; targetProductId: string; sortOrder: number }>
        categoryLinks: Array<{ sourceCategoryId: string; targetCategoryId: string; sortOrder: number }>
        globalCategories: Array<{ targetCategoryId: string; sortOrder: number }>
      }>('/api/dashboard/menu/cross-sell'),
      $fetch<{ ok: boolean; items: Array<{ id: string; name: string }> }>('/api/dashboard/menu/items'),
      $fetch<{ ok: boolean; items: Array<{ id: string; name: string }> }>('/api/dashboard/menu/categories'),
    ])

    products.value = (productsRes.items ?? []).map((item: { id: string; name: string }) => ({ id: item.id, name: item.name }))
    categories.value = (categoriesRes.items ?? []).map((item: { id: string; name: string }) => ({ id: item.id, name: item.name }))
    productLinksDraft.value = (rulesRes.productLinks ?? []).map((row) => ({
      sourceProductId: row.sourceProductId,
      targetProductId: row.targetProductId,
      sortOrder: Number.isFinite(row.sortOrder) ? row.sortOrder : 0,
    }))
    categoryLinksDraft.value = (rulesRes.categoryLinks ?? []).map((row) => ({
      sourceCategoryId: row.sourceCategoryId,
      targetCategoryId: row.targetCategoryId,
      sortOrder: Number.isFinite(row.sortOrder) ? row.sortOrder : 0,
    }))
    globalCategoriesDraft.value = (rulesRes.globalCategories ?? []).map((row) => ({
      targetCategoryId: row.targetCategoryId,
      sortOrder: Number.isFinite(row.sortOrder) ? row.sortOrder : 0,
    }))
  } catch (error: any) {
    const message = error?.data?.statusMessage || error?.message || 'Не удалось загрузить настройки апсейла'
    pushToast('error', message, 14000)
  } finally {
    loading.value = false
  }
}

function normalizePayload() {
  return {
    productLinks: productLinksDraft.value
      .filter((row: ProductLinkDraft) => row.sourceProductId && row.targetProductId)
      .map((row: ProductLinkDraft) => ({
        sourceProductId: row.sourceProductId,
        targetProductId: row.targetProductId,
        sortOrder: Number.isFinite(row.sortOrder) ? Math.floor(row.sortOrder) : 0,
      })),
    categoryLinks: categoryLinksDraft.value
      .filter((row: CategoryLinkDraft) => row.sourceCategoryId && row.targetCategoryId)
      .map((row: CategoryLinkDraft) => ({
        sourceCategoryId: row.sourceCategoryId,
        targetCategoryId: row.targetCategoryId,
        sortOrder: Number.isFinite(row.sortOrder) ? Math.floor(row.sortOrder) : 0,
      })),
    globalCategories: globalCategoriesDraft.value
      .filter((row: GlobalCategoryDraft) => row.targetCategoryId)
      .map((row: GlobalCategoryDraft) => ({
        targetCategoryId: row.targetCategoryId,
        sortOrder: Number.isFinite(row.sortOrder) ? Math.floor(row.sortOrder) : 0,
      })),
  }
}

async function saveRules() {
  saving.value = true
  try {
    await $fetch('/api/dashboard/menu/cross-sell', {
      method: 'PUT',
      body: normalizePayload(),
    })
    pushToast('success', 'Правила апсейла сохранены')
    await loadData()
  } catch (error: any) {
    const message = error?.data?.statusMessage || error?.message || 'Не удалось сохранить правила апсейла'
    pushToast('error', message, 14000)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadData()
})
</script>
