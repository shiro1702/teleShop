<template>
  <div class="min-h-screen" :style="pageStyle">
    <StoriesTopBar
      v-if="storiesLoading || storiesTopBar.length"
      :campaigns="storiesTopBar"
      :loading="storiesLoading"
      @open="openTopBarStoryCampaign"
      :style="topBarStyle"
    />
    <div class="w-full sticky top-16 z-40 backdrop-blur" :style="topBarStyle">
      <div class="flex items-center gap-3 mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <nav class="-mx-4 flex flex-1 items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <a
            v-for="section in cartStore.productsByCategory"
            :key="section.category"
            :href="`#${section.category}`"
          class="shrink-0 rounded-full px-4 py-2 text-sm font-medium transition hover:border-primary hover:bg-primary-50"
          :style="chipStyle"
          >
            {{ section.label }}
          </a>
        </nav>

        <div
          v-if="isRestaurantModesLoaded && showFulfillmentSelector"
          class="hidden max-w-[min(100%,22rem)] shrink-0 items-center gap-0.5 rounded-xl border border-gray-200 bg-white p-1 sm:flex"
          :style="{ borderColor: theme.primary_100 || '#e5e7eb' }"
        >
          <button
            v-if="hasDeliveryOption"
            type="button"
            class="min-w-0 flex-1 rounded-lg px-2 py-1 text-xs font-medium transition sm:px-3 sm:text-sm"
            :class="selectedFulfillmentType === 'delivery'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'"
            @click="setFulfillmentType('delivery')"
          >
            Доставка
          </button>
          <button
            v-if="hasPickupOption"
            type="button"
            class="min-w-0 flex-1 rounded-lg px-2 py-1 text-xs font-medium transition sm:px-3 sm:text-sm"
            :class="selectedFulfillmentType === 'pickup'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'"
            @click="setFulfillmentType('pickup')"
          >
            Самовывоз
          </button>
          <button
            v-if="hasQrMenuOption"
            type="button"
            class="min-w-0 flex-1 rounded-lg px-2 py-1 text-xs font-medium transition sm:px-3 sm:text-sm"
            :class="selectedFulfillmentType === 'qr-menu'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'"
            @click="setFulfillmentType('qr-menu')"
          >
            В&nbsp;ресторане
          </button>
        </div>

        <button
          type="button"
          class="hidden shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 sm:flex"
          @click="goToCheckout"
        >
          <span>Корзина</span>
          <template v-if="cartStore.count > 0">
            <span class="">
              {{ cartStore.count }} шт.
            </span>
            <span class="font-semibold">
              {{ formatPrice(cartStore.total) }}
            </span>
          </template>
        </button>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-10">
      <section
        v-if="tenantDescription"
        class="mb-8 overflow-hidden rounded-3xl p-5 shadow-sm sm:p-6"
        :style="heroStyle"
      >
        <div class="flex items-start gap-4">
          <img
            :src="tenantLogoUrl"
            :alt="tenantName"
            class="h-16 w-auto shrink-0 rounded-2xl border border-white/80 bg-white object-cover shadow-sm"
          />
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {{ tenantName }}
            </p>
            <p class="mt-2 max-w-3xl text-sm leading-6 sm:text-base" :style="{ color: mutedTextColor }">
              {{ tenantDescription }}
            </p>
          </div>
        </div>
      </section>

      <section
        v-if="isCatalogLoading"
        class="mb-10"
      >
        <div class="mb-4 h-7 w-44 animate-pulse rounded-lg" :style="{ backgroundColor: theme.primary_100 || '#e5e7eb' }" />
        <ul class="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          <li
            v-for="idx in 8"
            :key="`card-skeleton-${idx}`"
            class="overflow-hidden rounded-xl border shadow-sm"
            :style="{ borderColor: theme.primary_100 || '#e5e7eb', backgroundColor: cardBgColor }"
          >
            <div class="aspect-square w-full animate-pulse" :style="{ backgroundColor: pageBgColor }" />
            <div class="space-y-3 p-4">
              <div class="h-5 w-4/5 animate-pulse rounded" :style="{ backgroundColor: pageBgColor }" />
              <div class="h-4 w-full animate-pulse rounded" :style="{ backgroundColor: pageBgColor }" />
              <div class="h-4 w-2/3 animate-pulse rounded" :style="{ backgroundColor: pageBgColor }" />
              <div class="h-11 w-full animate-pulse rounded-lg" :style="{ backgroundColor: pageBgColor }" />
            </div>
          </li>
        </ul>
      </section>
      <template v-else>
        <section
          v-for="section in cartStore.productsByCategory"
          :key="section.category"
          :id="section.category"
          class="mb-10 scroll-mt-28"
        >
          <h2 class="mb-4 text-lg font-semibold" :style="{ color: mainTextColor }">
            {{ section.label }}
          </h2>
          <ul
            class="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
          >
            <li v-for="product in section.products" :key="product.id" class="flex">
              <ProductCard :product="product" @open="openProduct(product)" />
            </li>
          </ul>
        </section>
      </template>
      <section
        v-for="section in sectionsWithStoryCells"
        :key="section.category"
        :id="section.category"
        class="mb-10 scroll-mt-28"
      >
        <h2 class="mb-4 text-lg font-semibold" :style="{ color: mainTextColor }">
          {{ section.label }}
        </h2>
        <ul
          class="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
        >
          <li
            v-for="(cell, cellIdx) in section.cells"
            :key="cell.type === 'product' ? cell.product.id : `story-${cell.campaign.id}-${cellIdx}`"
            class="flex"
          >
            <ProductCard
              v-if="cell.type === 'product'"
              :product="cell.product"
              @open="openProduct(cell.product)"
            />
            <StoryGridBanner
              v-else
              :campaign="cell.campaign"
              @open="openCatalogStoryCampaign"
            />
          </li>
        </ul>
      </section>
    </main>

    <!-- Модалка успеха заказа после возврата на меню -->
    <Teleport to="body">
      <Transition name="product">
        <div
          v-if="showOrderSuccess"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            class="w-full max-w-sm rounded-2xl p-6 shadow-xl"
            :style="modalCardStyle"
          >
            <h2 class="text-lg font-bold" :style="{ color: mainTextColor }">
              Заказ оформлен!
            </h2>
            <p
              v-if="lastOrderId"
              class="mt-2 text-sm"
              :style="{ color: mutedTextColor }"
            >
              Номер заказа:
                <span class="font-semibold" :style="{ color: mainTextColor }">
                #{{ lastOrderId }}
              </span>
            </p>
            <p class="mt-2 text-sm" :style="{ color: mutedTextColor }">
              Мы пришлём обновления по заказу в Telegram.
            </p>
            <button
              type="button"
            class="mt-4 w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700"
              @click="showOrderSuccess = false"
            >
              Понятно
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Нижняя панель корзины на мобильных -->
    <div
      class="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 border-t px-4 py-2 sm:hidden pb-10"
      :style="mobileBarStyle"
    >
      <div
        v-if="isRestaurantModesLoaded && showFulfillmentSelector"
        class="inline-flex w-full gap-0.5 rounded-xl border border-gray-200 bg-white p-1"
        :style="{ borderColor: theme.primary_100 || '#e5e7eb' }"
      >
        <button
          v-if="hasDeliveryOption"
          type="button"
          class="min-w-0 flex-1 rounded-lg px-2 py-2 text-[11px] font-medium leading-tight transition sm:text-xs"
          :class="selectedFulfillmentType === 'delivery'
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'"
          @click="setFulfillmentType('delivery')"
        >
          Доставка
        </button>
        <button
          v-if="hasPickupOption"
          type="button"
          class="min-w-0 flex-1 rounded-lg px-2 py-2 text-[11px] font-medium leading-tight transition sm:text-xs"
          :class="selectedFulfillmentType === 'pickup'
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'"
          @click="setFulfillmentType('pickup')"
        >
          Самовывоз
        </button>
        <button
          v-if="hasQrMenuOption"
          type="button"
          class="min-w-0 flex-1 rounded-lg px-2 py-2 text-[11px] font-medium leading-tight transition sm:text-xs"
          :class="selectedFulfillmentType === 'qr-menu'
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'"
          @click="setFulfillmentType('qr-menu')"
        >
          В&nbsp;ресторане
        </button>
      </div>

      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary shadow-md"
        @click="goToCheckout"
      >
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Корзина</span>
        </div>
        <div v-if="cartStore.count > 0" class="flex items-center gap-2">
          <span class="text-sm text-orange-100">
            {{ cartStore.count }} шт.
          </span>
          <span class="text-sm font-semibold">
            {{ formatPrice(cartStore.total) }}
          </span>
        </div>
      </button>
    </div>

    <!-- Модалка с информацией о товаре и модификаторами -->
    <Teleport to="body">
      <Transition name="product">
        <div
          v-if="selectedProduct"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            class="absolute inset-0"
            @click="closeProduct"
          />
          <div
            class="relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-t-2xl shadow-xl sm:rounded-2xl flex flex-col"
            :style="modalCardStyle"
          >
            <button
              type="button"
              class="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
              aria-label="Закрыть"
              @click="closeProduct"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div class="h-48 w-full shrink-0 overflow-hidden sm:h-56" :style="{ backgroundColor: cardBgColor }">
              <img
                :src="selectedProduct.image"
                :alt="selectedProduct.name"
                class="h-full w-full object-cover"
              />
            </div>
            
            <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div>
                <h2 class="text-lg font-semibold sm:text-xl" :style="{ color: mainTextColor }">
                  {{ selectedProduct.name }}
                </h2>
                <p
                  v-if="selectedProduct.description"
                  class="mt-1 text-sm"
                  :style="{ color: mutedTextColor }"
                >
                  {{ selectedProduct.description }}
                </p>
              </div>

              <!-- Параметры -->
              <div v-if="selectedProduct.parameters && selectedProduct.parameters.length > 0" class="space-y-4 pt-2">
                <div v-for="group in selectedProduct.parameters" :key="group.id" class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h3 class="font-medium text-sm" :style="{ color: mainTextColor }">{{ group.name }}</h3>
                    <span v-if="group.isRequired" class="text-[10px] uppercase tracking-wider text-red-500 font-semibold bg-red-50 px-2 py-0.5 rounded">Обязательно</span>
                  </div>
                  
                  <div class="flex flex-wrap gap-2 w-full">
                    <label 
                      v-for="opt in group.options" 
                      :key="opt.id"
                      class="relative flex-1 min-w-[80px] flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors text-center"
                      :style="{ 
                        borderColor: isParameterSelected(group.id, opt.id) ? 'var(--color-primary)' : theme.primary_100 || '#e5e7eb',
                        backgroundColor: isParameterSelected(group.id, opt.id) ? 'var(--color-primary)' : 'transparent',
                        color: isParameterSelected(group.id, opt.id) ? '#ffffff' : mainTextColor
                      }"
                    >
                      <input 
                        type="radio"
                        :name="`param-${group.id}`"
                        :checked="isParameterSelected(group.id, opt.id)"
                        @change="toggleParameter(group.id, opt.id)"
                        class="sr-only"
                      />
                      <div class="flex flex-col items-center">
                        <span class="text-sm font-medium">{{ opt.name }}</span>
                        <span class="text-xs opacity-80">{{ formatPrice(opt.price || 0) }}</span>
                      </div>

                      <!-- Badge для количества в корзине -->
                      <span 
                        v-if="getParameterQuantityInCart(opt.id) > 0" 
                        class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary shadow-sm"
                      >
                        {{ getParameterQuantityInCart(opt.id) }}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Модификаторы -->
              <div v-if="selectedProduct.modifiers && selectedProduct.modifiers.length > 0" class="space-y-4 pt-2">
                <div v-for="group in selectedProduct.modifiers" :key="group.id" class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h3 class="font-medium text-sm" :style="{ color: mainTextColor }">{{ group.name }}</h3>
                    <span v-if="group.isRequired" class="text-[10px] uppercase tracking-wider text-red-500 font-semibold bg-red-50 px-2 py-0.5 rounded">Обязательно</span>
                  </div>
                  
                  <div class="flex flex-wrap gap-2 w-full">
                    <label 
                      v-for="opt in group.options" 
                      :key="opt.id"
                      class="relative flex-1 min-w-[80px] flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors text-center"
                      :style="{ 
                        borderColor: isOptionSelected(group.id, opt.id) ? 'var(--color-primary)' : theme.primary_100 || '#e5e7eb',
                        backgroundColor: isOptionSelected(group.id, opt.id) ? 'var(--color-primary)' : 'transparent',
                        color: isOptionSelected(group.id, opt.id) ? '#ffffff' : mainTextColor
                      }"
                    >
                      <input 
                        :type="group.selectionType === 'multi' ? 'checkbox' : 'radio'"
                        :name="`group-${group.id}`"
                        :checked="isOptionSelected(group.id, opt.id)"
                        @change="toggleOption(group, opt)"
                        class="sr-only"
                      />
                      <span class="text-sm font-medium">{{ opt.name }}</span>
                      
                      <!-- Badge для количества в корзине -->
                      <span 
                        v-if="getOptionQuantityInCart(opt.id) > 0" 
                        class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary shadow-sm"
                      >
                        {{ getOptionQuantityInCart(opt.id) }}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="shrink-0 border-t p-4 sm:p-5 bg-white"
              :style="{ borderColor: theme.primary_100 || '#e5e7eb', backgroundColor: cardBgColor }"
            >
              <p
                v-if="orderingDisabled"
                class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900"
              >
                Способ получения не настроен для филиала. Добавление в корзину доступно; оформление проверьте на шаге заказа.
              </p>
              <button
                type="button"
                class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                :disabled="!isModifiersValid"
                @click="addSelectedToCart"
              >
                <span>{{ isModifiersValid ? 'Добавить в корзину' : 'Выберите опции' }}</span>
                <span v-if="isModifiersValid" class="font-bold">{{ formatPrice(selectedProductPrice) }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <StoryViewer
      v-model="viewerOpen"
      :campaign="viewerCampaign"
      :campaigns="storyViewerNavigableCampaigns"
      :auto-advance-campaigns="viewerAutoAdvanceCampaigns"
      :shop-id="tenantKey"
      @campaign-change="viewerCampaign = $event"
      @action="onStoryAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { $fetch } from 'ofetch'
import type { Product, ModifierGroup, ModifierOption, ProductParameterGroup, ProductParameterOption } from '../data/products'
import type { SelectedModifier, SelectedParameter } from '../stores/cart'
import { useTenant } from '../composables/useTenant'
import { useMessengerStorage } from '../composables/useMessengerStorage'
import { useCartStore } from '../stores/cart'
import { readShopIdFromQuery, resolveCartScopeKey } from '../utils/cartScope'
import StoriesTopBar from '../components/stories/StoriesTopBar.vue'
import StoryGridBanner from '../components/stories/StoryGridBanner.vue'
import StoryViewer from '../components/stories/StoryViewer.vue'
import { useStories } from '../composables/useStories'
import type { StoryCampaignDto, StorySlideDto } from '../types/stories'
import { buildDefaultCartSelections, findProductById } from '../utils/storyCart'

const cartStore = useCartStore()
const { canUseMessengerStorage, setItem } = useMessengerStorage()
const router = useRouter()
const route = useRoute()
const { tenant, tenantKey, tenantPath } = useTenant()
const viewerOpen = ref(false)
const viewerCampaign = ref<StoryCampaignDto | null>(null)
const viewerAutoAdvanceCampaigns = ref(false)
const {
  loading: storiesLoading,
  topBar: storiesTopBar,
  catalogGrid: storiesCatalogGrid,
} = useStories(tenantKey)

/** Порядок: сначала лента сверху, затем уникальные из каталога — для свайпа между группами в просмотрщике */
const storyViewerNavigableCampaigns = computed(() => {
  const seen = new Set<string>()
  const out: StoryCampaignDto[] = []
  for (const c of storiesTopBar.value) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      out.push(c)
    }
  }
  for (const c of storiesCatalogGrid.value) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      out.push(c)
    }
  }
  return out
})

const sectionsWithStoryCells = computed(() => {
  const storyCampaigns = storiesCatalogGrid.value
  let globalCount = 0
  let storyIdx = 0
  return cartStore.productsByCategory.map((section) => {
    const cells: Array<
      | { type: 'product'; product: Product }
      | { type: 'story'; campaign: StoryCampaignDto }
    > = []
    for (const product of section.products) {
      cells.push({ type: 'product', product })
      globalCount++
      if (globalCount % 6 === 0 && storyCampaigns.length) {
        const camp = storyCampaigns[storyIdx % storyCampaigns.length]
        storyIdx++
        cells.push({ type: 'story', campaign: camp })
      }
    }
    return { ...section, cells }
  })
})

function openTopBarStoryCampaign(c: StoryCampaignDto) {
  viewerAutoAdvanceCampaigns.value = true
  viewerCampaign.value = c
  viewerOpen.value = true
}

function openCatalogStoryCampaign(c: StoryCampaignDto) {
  viewerAutoAdvanceCampaigns.value = false
  viewerCampaign.value = c
  viewerOpen.value = true
}

function onStoryAction(payload: { slide: StorySlideDto; actionType: string }) {
  const { slide, actionType } = payload
  const raw = slide.actionPayload || {}
  if (actionType === 'add_to_cart') {
    const itemId =
      typeof raw.item_id === 'string'
        ? raw.item_id
        : typeof raw.product_id === 'string'
          ? raw.product_id
          : ''
    const qty = typeof raw.qty === 'number' && raw.qty > 0 ? Math.floor(raw.qty) : 1
    const product = findProductById(cartStore.products, itemId)
    if (!product) {
      if (typeof window !== 'undefined') window.alert('Товар не найден в меню')
      return
    }
    const { modifiers, parameters } = buildDefaultCartSelections(product)
    cartStore.addItem(product, qty, modifiers, parameters)
    viewerOpen.value = false
    return
  }
  if (actionType === 'open_category') {
    const cat =
      typeof raw.category === 'string'
        ? raw.category
        : typeof raw.category_name === 'string'
          ? raw.category_name
          : ''
    if (cat && typeof document !== 'undefined') {
      const el = document.getElementById(cat)
      el?.scrollIntoView({ behavior: 'smooth' })
    }
    viewerOpen.value = false
    return
  }
  if (actionType === 'apply_promo') {
    if (typeof window !== 'undefined') window.alert('Промокоды пока недоступны')
  }
}

const selectedProduct = ref<Product | null>(null)
const showOrderSuccess = ref(false)
const lastOrderId = ref<string | null>(null)
const isCatalogLoading = ref(false)
const tenantName = computed(() => tenant.value.shopName || 'Наш магазин')
const tenantLogoUrl = computed(() => tenant.value.logoLargeUrl || tenant.value.logoUrl || '/logo.webp')
const tenantDescription = computed(() => tenant.value.description || '')
const theme = computed(() => tenant.value.theme || {})

// State for modifiers and parameters
const activeModifiers = ref<Record<string, Set<string>>>({})
const activeParameters = ref<Record<string, string>>({})

const pageBgColor = computed(() => theme.value.surface_background || 'var(--color-surface-bg)')
const cardBgColor = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const mainTextColor = computed(() => theme.value.text_primary || 'var(--color-text-primary)')
const mutedTextColor = computed(() => theme.value.text_muted || 'var(--color-text-muted)')

const pageStyle = computed(() => ({
  backgroundColor: pageBgColor.value,
  color: mainTextColor.value,
}))

const topBarStyle = computed(() => ({
  backgroundColor: cardBgColor.value,
  borderBottom: `1px solid ${theme.value.primary_100 || '#e5e7eb'}`,
}))

const chipStyle = computed(() => ({
  border: `1px solid ${theme.value.primary_100 || '#e5e7eb'}`,
  backgroundColor: cardBgColor.value,
  color: mutedTextColor.value,
}))

const heroStyle = computed(() => ({
  border: `1px solid ${theme.value.primary_100 || '#e5e7eb'}`,
  backgroundColor: cardBgColor.value,
}))

const modalCardStyle = computed(() => ({
  backgroundColor: cardBgColor.value,
  color: mainTextColor.value,
}))

const mobileBarStyle = computed(() => ({
  borderColor: theme.value.primary_100 || '#e5e7eb',
  backgroundColor: cardBgColor.value,
}))

type FulfillmentType = 'delivery' | 'pickup' | 'qr-menu'
type RestaurantOps = {
  id: string
  supports_delivery: boolean
  supports_pickup: boolean
  supports_qr_menu?: boolean
  /** Витрина: org dine-in + филиал «в зале» (в т.ч. режим только просмотра меню). */
  supports_in_restaurant?: boolean
}

const CHECKOUT_STORAGE_KEY = 'teleshop_checkout_state'
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000
const CATALOG_CACHE_KEY_PREFIX = 'teleshop-catalog'

type CatalogCacheEntry = {
  ts: number
  items: Product[]
}

function buildCheckoutStorageKey(scopeKey: string | null | undefined) {
  const scope = typeof scopeKey === 'string' ? scopeKey.trim() : ''
  return scope ? `${CHECKOUT_STORAGE_KEY}:${scope}` : CHECKOUT_STORAGE_KEY
}

const checkoutStorageKey = computed(() => buildCheckoutStorageKey(tenantKey.value))

const restaurantOps = ref<RestaurantOps[]>([])
const isRestaurantModesLoaded = ref(false)
const selectedFulfillmentType = ref<FulfillmentType>('delivery')

function restaurantHasInHallMode(r: RestaurantOps) {
  return r.supports_qr_menu === true || r.supports_in_restaurant === true
}

const derivedAllowedFulfillmentTypes = computed<FulfillmentType[]>(() => {
  const ops = restaurantOps.value
  if (!ops.length) return []

  if (ops.length === 1) {
    const out: FulfillmentType[] = []
    if (ops[0].supports_delivery) out.push('delivery')
    if (ops[0].supports_pickup) out.push('pickup')
    if (restaurantHasInHallMode(ops[0])) out.push('qr-menu')
    return out
  }

  const out: FulfillmentType[] = []
  if (ops.some((r) => r.supports_delivery)) out.push('delivery')
  if (ops.some((r) => r.supports_pickup)) out.push('pickup')
  if (ops.some((r) => restaurantHasInHallMode(r))) out.push('qr-menu')
  return out
})

/**
 * Скрываем корзину только если филиалы уже загружены, список не пустой,
 * и ни один канал (доставка / самовывоз / в зале) недоступен.
 * При пустом ответе API не блокируем UI (избегаем «пропавшей» корзины).
 */
const orderingDisabled = computed(
  () =>
    isRestaurantModesLoaded.value
    && restaurantOps.value.length > 0
    && derivedAllowedFulfillmentTypes.value.length === 0,
)

const catalogFulfillmentType = computed<FulfillmentType>(() =>
  orderingDisabled.value ? 'delivery' : selectedFulfillmentType.value,
)

const hasDeliveryOption = computed(() => derivedAllowedFulfillmentTypes.value.includes('delivery'))
const hasPickupOption = computed(() => derivedAllowedFulfillmentTypes.value.includes('pickup'))
const hasQrMenuOption = computed(() => derivedAllowedFulfillmentTypes.value.includes('qr-menu'))
const showFulfillmentSelector = computed(() => derivedAllowedFulfillmentTypes.value.length > 1)

const selectedRestaurantIdForCheckout = computed(() => {
  return restaurantOps.value.length === 1 ? restaurantOps.value[0].id : null
})

function readCheckoutStateLocal(): any | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(checkoutStorageKey.value)
    if (!raw) return null
    return JSON.parse(raw) as any
  } catch {
    return null
  }
}

function getCurrentRestaurantIdFromQuery(): string | null {
  return readFirstQueryString('branch_id') ?? readFirstQueryString('restaurant_id')
}

function buildCatalogCacheKey(shopId: string | null, restaurantId: string | null, fulfillmentType: FulfillmentType) {
  const shopPart = shopId && shopId.trim() ? shopId.trim() : 'default'
  const restaurantPart = restaurantId && restaurantId.trim() ? restaurantId.trim() : 'default'
  return `${CATALOG_CACHE_KEY_PREFIX}:${shopPart}:${restaurantPart}:${fulfillmentType}`
}

function readCatalogCache(cacheKey: string): Product[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CatalogCacheEntry
    if (!parsed || typeof parsed.ts !== 'number' || !Array.isArray(parsed.items)) return null
    if (Date.now() - parsed.ts > CATALOG_CACHE_TTL_MS) return null
    return parsed.items
  } catch {
    return null
  }
}

function writeCatalogCache(cacheKey: string, items: Product[]) {
  if (typeof window === 'undefined') return
  try {
    const payload: CatalogCacheEntry = {
      ts: Date.now(),
      items,
    }
    localStorage.setItem(cacheKey, JSON.stringify(payload))
  } catch {
    // ignore quota/private mode
  }
}

function persistCheckoutStateLocal(data: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(checkoutStorageKey.value, data)
  } catch {
    // ignore
  }
}

async function persistCheckoutStateCloud(data: string) {
  persistCheckoutStateLocal(data)
  if (canUseMessengerStorage()) {
    await setItem(checkoutStorageKey.value, data)
  }
}

function persistFulfillmentTypeToCheckout(next: FulfillmentType) {
  const existing = readCheckoutStateLocal() ?? {}
  const nextState: Record<string, any> = {
    ...existing,
    fulfillmentType: next,
  }

  if (typeof selectedRestaurantIdForCheckout.value === 'string' && selectedRestaurantIdForCheckout.value) {
    nextState.selectedRestaurantId = selectedRestaurantIdForCheckout.value
  }

  const payload = JSON.stringify(nextState)
  void persistCheckoutStateCloud(payload)
}

function setFulfillmentType(next: FulfillmentType) {
  if (!derivedAllowedFulfillmentTypes.value.includes(next)) return
  selectedFulfillmentType.value = next
  persistFulfillmentTypeToCheckout(next)
  void loadCatalog()
}

function readFirstQueryString(key: string): string | null {
  const v = route.query[key]
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (Array.isArray(v)) {
    const found = v.find((x): x is string => typeof x === 'string' && !!x.trim())
    if (found) return found.trim()
  }
  return null
}

async function loadRestaurantModes() {
  isRestaurantModesLoaded.value = false
  restaurantOps.value = []

  try {
    const shopId = tenantKey.value
    const branchIdFromQuery = readFirstQueryString('branch_id') ?? readFirstQueryString('restaurant_id')

    const res = await $fetch<{ ok: boolean; items: RestaurantOps[] }>('/api/restaurants', {
      query: shopId ? { shop_id: shopId } : undefined,
      headers: shopId ? { 'x-shop-id': shopId } : undefined,
    })

    if (res?.ok && Array.isArray(res.items)) {
      restaurantOps.value = branchIdFromQuery
        ? res.items.filter((r) => r.id === branchIdFromQuery)
        : res.items
    }
  } catch {
    // fallback: allow both modes
    restaurantOps.value = []
  } finally {
    isRestaurantModesLoaded.value = true
    const allowed = derivedAllowedFulfillmentTypes.value
    if (!allowed.length) {
      selectedFulfillmentType.value = 'delivery'
      persistFulfillmentTypeToCheckout('delivery')
      void loadCatalog()
      return
    }
    if (!allowed.includes(selectedFulfillmentType.value)) {
      selectedFulfillmentType.value = allowed.includes('delivery') ? 'delivery' : allowed[0]
    }
    persistFulfillmentTypeToCheckout(selectedFulfillmentType.value)
    void loadCatalog()
  }
}

// Initialize from stored state (before restaurants are loaded).
const saved = readCheckoutStateLocal()
if (
  saved?.fulfillmentType === 'delivery'
  || saved?.fulfillmentType === 'pickup'
  || saved?.fulfillmentType === 'qr-menu'
) {
  selectedFulfillmentType.value = saved.fulfillmentType
}

function applyCartScope() {
  const scope = resolveCartScopeKey(route, tenantKey.value)
  cartStore.setScope(scope)
  cartStore.adoptLegacyShopIdScopeIfEmpty(readShopIdFromQuery(route))
}

function openProduct(product: Product) {
  if (product.availability?.isOrderable === false) return
  selectedProduct.value = product
  const nextMods: Record<string, Set<string>> = {}
  const nextParams: Record<string, string> = {}

  // Pre-select defaults for modifiers
  if (product.modifiers) {
    product.modifiers.forEach((group) => {
      const s = new Set<string>()
      group.options.forEach((opt) => {
        if (opt.isDefault) s.add(opt.id)
      })
      nextMods[group.id] = s
    })
  }

  // Pre-select defaults for parameters
  if (product.parameters) {
    product.parameters.forEach((group) => {
      const defaultOpt = group.options.find(opt => opt.isDefault) || group.options[0]
      if (defaultOpt) {
        nextParams[group.id] = defaultOpt.id
      }
    })
  }

  activeModifiers.value = nextMods
  activeParameters.value = nextParams
}

function closeProduct() {
  selectedProduct.value = null
  activeModifiers.value = {}
  activeParameters.value = {}
}

function isParameterSelected(groupId: string, optionId: string) {
  return activeParameters.value[groupId] === optionId
}

function toggleParameter(groupId: string, optionId: string) {
  activeParameters.value = {
    ...activeParameters.value,
    [groupId]: optionId
  }
}

function getParameterQuantityInCart(optionId: string) {
  if (!selectedProduct.value) return 0
  let count = 0
  for (const item of cartStore.items) {
    if ((item as any).id === selectedProduct.value.id) {
      if (item.selectedParameters?.some(p => p.optionId === optionId)) {
        count += item.quantity
      }
    }
  }
  return count
}

function isOptionSelected(groupId: string, optionId: string) {
  return activeModifiers.value[groupId]?.has(optionId) || false
}

function getOptionQuantityInCart(optionId: string) {
  if (!selectedProduct.value) return 0
  let count = 0
  for (const item of cartStore.items) {
    if ((item as any).id === selectedProduct.value.id) {
      if (item.selectedModifiers?.some(m => m.optionId === optionId)) {
        count += item.quantity
      }
    }
  }
  return count
}

function toggleOption(group: ModifierGroup, option: ModifierOption) {
  const prev = activeModifiers.value[group.id] ?? new Set<string>()
  // Новый Set на каждое изменение — так Vue гарантированно перерисует выбор (Set мутации не всегда реактивны).
  let next = new Set(prev)

  if (group.selectionType === 'single' || group.selectionType === 'boolean') {
    next = new Set([option.id])
  } else {
    // Multi
    if (next.has(option.id)) {
      next.delete(option.id)
    } else {
      const max = group.maxSelect
      if (typeof max === 'number' && max > 0 && next.size >= max) {
        // Лимит: снимаем последний по порядку выбора (Set сохраняет порядок вставки)
        const order = Array.from(next)
        const lastId = order[order.length - 1]
        if (lastId) next.delete(lastId)
      }
      next.add(option.id)
    }
  }

  activeModifiers.value = {
    ...activeModifiers.value,
    [group.id]: next,
  }
}

const isModifiersValid = computed(() => {
  if (!selectedProduct.value) return true
  
  if (selectedProduct.value.parameters) {
    for (const group of selectedProduct.value.parameters) {
      if (group.isRequired && !activeParameters.value[group.id]) return false
    }
  }

  if (selectedProduct.value.modifiers) {
    for (const group of selectedProduct.value.modifiers) {
      const selectedCount = activeModifiers.value[group.id]?.size || 0
      if (group.isRequired && selectedCount === 0) return false
      if (group.minSelect > 0 && selectedCount < group.minSelect) return false
    }
  }
  
  return true
})

const selectedProductPrice = computed(() => {
  if (!selectedProduct.value) return 0
  
  let basePrice = selectedProduct.value.price
  
  if (selectedProduct.value.parameters) {
    for (const group of selectedProduct.value.parameters) {
      const selectedId = activeParameters.value[group.id]
      if (selectedId) {
        const opt = group.options.find(o => o.id === selectedId)
        if (opt && opt.price !== undefined) {
          basePrice = opt.price
          break // Only one parameter group affects base price
        }
      }
    }
  }

  let multiplier = 1
  let delta = 0
  
  if (selectedProduct.value.modifiers) {
    selectedProduct.value.modifiers.forEach(group => {
      const selectedIds = activeModifiers.value[group.id]
      if (selectedIds) {
        group.options.forEach(opt => {
          if (selectedIds.has(opt.id)) {
            if (opt.pricingType === 'multiplier') {
              multiplier *= (opt.priceMultiplier ?? 1)
            } else {
              delta += (opt.priceDelta || 0)
            }
          }
        })
      }
    })
  }
  
  return Math.round(basePrice * multiplier + delta)
})

function addSelectedToCart() {
  if (!selectedProduct.value || !isModifiersValid.value) return
  
  const modifiers: SelectedModifier[] = []
  const parameters: SelectedParameter[] = []

  if (selectedProduct.value.parameters) {
    selectedProduct.value.parameters.forEach(group => {
      const selectedId = activeParameters.value[group.id]
      if (selectedId) {
        const opt = group.options.find(o => o.id === selectedId)
        if (opt) {
          parameters.push({
            parameterKindId: group.parameterKindId,
            productParameterId: group.id,
            optionId: opt.id,
            optionName: opt.name,
            price: opt.price || 0,
            weightG: opt.weightG,
            volumeMl: opt.volumeMl,
            pieces: opt.pieces
          })
        }
      }
    })
  }
  
  if (selectedProduct.value.modifiers) {
    selectedProduct.value.modifiers.forEach(group => {
      const selectedIds = activeModifiers.value[group.id]
      if (selectedIds) {
        group.options.forEach(opt => {
          if (selectedIds.has(opt.id)) {
            modifiers.push({
              groupId: group.id,
              groupName: group.name,
              optionId: opt.id,
              optionName: opt.name,
              pricingType: opt.pricingType || 'delta',
              priceDelta: opt.priceDelta,
              priceMultiplier: opt.priceMultiplier ?? null
            })
          }
        })
      }
    })
  }
  
  cartStore.addItem(selectedProduct.value, 1, modifiers, parameters)
  closeProduct()
}

function goToCheckout() {
  persistFulfillmentTypeToCheckout(selectedFulfillmentType.value)

  const readFirstQueryString = (key: string): string | null => {
    const v = route.query[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (Array.isArray(v)) {
      const found = v.find((x): x is string => typeof x === 'string' && !!x.trim())
      if (found) return found.trim()
    }
    return null
  }

  // QR-ссылка должна “довозиться” до корзины, чтобы не заставлять пользователя
  // вручную выбирать филиал/ресторан.
  const branchId = readFirstQueryString('branch_id') ?? readFirstQueryString('restaurant_id')
  void router.push({
    path: tenantPath('/checkout'),
    query: branchId ? { branch_id: branchId, step: '1' } : { step: '1' },
  })
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}

onMounted(() => {
  applyCartScope()
  void loadCatalog()
  void loadRestaurantModes()
  const orderId = route.query.orderId
  if (typeof orderId === 'string' && orderId) {
    lastOrderId.value = orderId
    showOrderSuccess.value = true
    router.replace({ path: route.path, query: { ...route.query, orderId: undefined } })
  }
})

watch(tenantKey, () => {
  applyCartScope()
  void loadCatalog()
  void loadRestaurantModes()
})

watch(
  () => [route.query.branch_id, route.query.restaurant_id] as const,
  () => {
    applyCartScope()
    void loadCatalog()
    void loadRestaurantModes()
  },
)

watch(
  () => [route.query.story_campaign_id, storiesTopBar.value, storiesCatalogGrid.value] as const,
  () => {
    const raw = route.query.story_campaign_id
    const id = typeof raw === 'string' ? raw.trim() : ''
    if (!id) return
    const all = [...storiesTopBar.value, ...storiesCatalogGrid.value]
    const found = all.find((c) => c.id === id)
    if (found) {
      viewerAutoAdvanceCampaigns.value = false
      viewerCampaign.value = found
      viewerOpen.value = true
      const nextQuery = { ...route.query } as Record<string, string | string[] | undefined>
      delete nextQuery.story_campaign_id
      void router.replace({ path: route.path, query: nextQuery })
    }
  },
  { immediate: true },
)

async function loadCatalog() {
  if (isCatalogLoading.value) return
  const restaurantId = getCurrentRestaurantIdFromQuery()
  const cacheKey = buildCatalogCacheKey(tenantKey.value || null, restaurantId, catalogFulfillmentType.value)
  const cachedItems = readCatalogCache(cacheKey)
  if (cachedItems && cachedItems.length) {
    cartStore.setProducts(cachedItems)
    return
  }

  isCatalogLoading.value = true
  try {
    const query: Record<string, string> = {}
    if (tenantKey.value) query.shop_id = tenantKey.value
    if (restaurantId) query.restaurant_id = restaurantId

    const headers: Record<string, string> = {}
    if (tenantKey.value) headers['x-shop-id'] = tenantKey.value
    if (restaurantId) headers['x-restaurant-id'] = restaurantId
    headers['x-fulfillment-type'] = catalogFulfillmentType.value

    const res = await $fetch<{ ok: boolean; items: Product[] }>('/api/products', {
      query: {
        ...(Object.keys(query).length ? query : {}),
        fulfillment_type: catalogFulfillmentType.value,
      },
      headers: Object.keys(headers).length ? headers : undefined,
    })
    if (res?.ok && Array.isArray(res.items)) {
      cartStore.setProducts(res.items)
      writeCatalogCache(cacheKey, res.items)
    }
  } catch {
    // fallback remains in store (MOCK_PRODUCTS) for local/dev compatibility
    cartStore.hydrateFromStorage()
  } finally {
    isCatalogLoading.value = false
  }
}

watch(catalogFulfillmentType, () => {
  void loadCatalog()
})

</script>

<style scoped>
.product-enter-active,
.product-leave-active {
  transition: opacity 0.25s ease;
}
.product-enter-active .max-w-md,
.product-leave-active .max-w-md {
  transition: transform 0.25s ease;
}
.product-enter-from,
.product-leave-to {
  opacity: 0;
}
/* Мобильная модалка: выезжает снизу; на больших экранах лёгкий scale аналогичен корзине */
.product-enter-from .max-w-md,
.product-leave-to .max-w-md {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .product-enter-from .max-w-md,
  .product-leave-to .max-w-md {
    transform: scale(0.95);
  }
}
</style>
