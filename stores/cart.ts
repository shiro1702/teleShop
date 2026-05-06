import { defineStore } from 'pinia'
import type { Product } from '~/data/products'
import { MOCK_PRODUCTS } from '~/data/products'
import type { DeliveryZoneProperties } from '~/utils/deliveryZones'

/** Префикс ключей корзины в localStorage: `teleshop-cart` или `teleshop-cart:<scope>`. */
export const CART_LOCAL_STORAGE_PREFIX = 'teleshop-cart'

export function cartLocalStorageKey(scopeKey: string | null | undefined): string {
  const scope = typeof scopeKey === 'string' ? scopeKey.trim() : ''
  return scope ? `${CART_LOCAL_STORAGE_PREFIX}:${scope}` : CART_LOCAL_STORAGE_PREFIX
}

/** Все ключи в localStorage, относящиеся к корзине (отладка). */
export function listCartLocalStorageKeys(): string[] {
  if (typeof localStorage === 'undefined') return []
  const keys: string[] = []
  const p = CART_LOCAL_STORAGE_PREFIX
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    if (k === p || k.startsWith(`${p}:`)) keys.push(k)
  }
  return keys.sort()
}

function buildCartStorageKey(scopeKey: string | null): string {
  return cartLocalStorageKey(scopeKey)
}

export interface SelectedParameter {
  parameterKindId: string
  productParameterId: string
  optionId: string
  optionName: string
  price: number
  weightG?: number | null
  volumeMl?: number | null
  pieces?: number | null
}

export interface SelectedModifier {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  pricingType?: 'delta' | 'multiplier'
  priceDelta: number
  priceMultiplier?: number | null
}

export interface CartItem extends Product {
  cartItemId: string // Unique ID for the cart item (product.id + parameters hash + modifiers hash)
  quantity: number
  selectedModifiers: SelectedModifier[]
  selectedParameters?: SelectedParameter[]
  unitPrice: number // Base price (or parameter price) + modifiers
}

export interface BridgeCartPayload {
  scopeKey?: string | null
  items?: CartItem[]
}

export interface PendingRemovalMeta {
  startedAt: number
  expiresAt: number
  durationMs: number
}

const pendingRemovalTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingCartClearTimers = new Map<string, ReturnType<typeof setTimeout>>()

export interface CatalogBlock {
  blockId: string
  /** Подзаголовок внутри группы; null — без отдельного заголовка (одиночная категория) */
  heading: string | null
  products: Product[]
}

export interface CatalogSection {
  sectionId: string
  navLabel: string
  title: string
  blocks: CatalogBlock[]
}

function soloSectionId(categoryId: string | null, catName: string): string {
  if (categoryId) return `cat-${categoryId}`
  let h = 0
  for (let i = 0; i < catName.length; i++) h = (Math.imul(31, h) + catName.charCodeAt(i)) | 0
  return `cat-${Math.abs(h).toString(36)}`
}

function getStoredCartItems(scopeKey: string | null): CartItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(buildCartStorageKey(scopeKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is CartItem =>
        x &&
        typeof x === 'object' &&
        typeof x.id === 'string' &&
        typeof x.quantity === 'number' &&
        typeof x.price === 'number' &&
        typeof x.name === 'string' &&
        typeof x.image === 'string' &&
        typeof x.category === 'string' &&
        x.quantity > 0
    )
  } catch {
    return []
  }
}

function persistCart(scopeKey: string | null, items: CartItem[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(buildCartStorageKey(scopeKey), JSON.stringify(items))
  } catch {
    // ignore quota / private mode
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function looksLikeShopUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

function normalizeBridgeItem(input: unknown): CartItem | null {
  if (!input || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  const name = typeof row.name === 'string' ? row.name : ''
  const image = typeof row.image === 'string' ? row.image : ''
  const category = typeof row.category === 'string' ? row.category : ''
  const price = isFiniteNumber(row.price) ? row.price : null
  const quantity = isFiniteNumber(row.quantity) ? Math.floor(row.quantity) : null
  const unitPrice = isFiniteNumber(row.unitPrice) ? row.unitPrice : null
  const cartItemId = typeof row.cartItemId === 'string' ? row.cartItemId : ''

  if (!id || !name || !image || !category || price === null || !quantity || quantity <= 0 || unitPrice === null || !cartItemId) {
    return null
  }

  const selectedModifiers = Array.isArray(row.selectedModifiers) ? row.selectedModifiers as SelectedModifier[] : []
  const selectedParameters = Array.isArray(row.selectedParameters) ? row.selectedParameters as SelectedParameter[] : []

  return {
    id,
    name,
    image,
    category,
    price,
    quantity,
    unitPrice,
    cartItemId,
    selectedModifiers,
    selectedParameters,
    description: typeof row.description === 'string' ? row.description : undefined,
  } as CartItem
}

function generateCartItemId(productId: string, modifiers: SelectedModifier[], parameters?: SelectedParameter[]): string {
  let paramHash = ''
  if (parameters && parameters.length > 0) {
    const sortedParams = [...parameters].sort((a, b) => a.parameterKindId.localeCompare(b.parameterKindId))
    paramHash = sortedParams.map(p => `${p.parameterKindId}:${p.optionId}`).join('|')
  }

  let modHash = ''
  if (modifiers && modifiers.length > 0) {
    const sortedMods = [...modifiers].sort((a, b) => {
      if (a.groupId !== b.groupId) return a.groupId.localeCompare(b.groupId)
      return a.optionId.localeCompare(b.optionId)
    })
    modHash = sortedMods.map(m => `${m.groupId}:${m.optionId}`).join('|')
  }
  
  return `${productId}::P[${paramHash}]::M[${modHash}]`
}

function calculateUnitPrice(basePrice: number, modifiers: SelectedModifier[], parameters?: SelectedParameter[]): number {
  const actualBasePrice = parameters && parameters.length > 0 ? parameters[0].price : basePrice

  const multiplier = modifiers
    .filter((mod) => mod.pricingType === 'multiplier')
    .reduce((acc, mod) => acc * (mod.priceMultiplier ?? 1), 1)

  const delta = modifiers
    .filter((mod) => mod.pricingType !== 'multiplier')
    .reduce((sum, mod) => sum + (mod.priceDelta || 0), 0)

  return Math.round(actualBasePrice * multiplier + delta)
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    products: [] as Product[],
    items: [] as CartItem[],
    scopeKey: null as string | null,
    deliveryZone: null as DeliveryZoneProperties | null,
    // Базовая стоимость доставки по городу до уточнения зоны
    deliveryCost: 200,
    deliveryError: null as string | null,
    pendingRemovals: {} as Record<string, PendingRemovalMeta>,
    pendingCartClear: null as PendingRemovalMeta | null,
  }),
  getters: {
    total: (state) =>
      state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    count: (state) =>
      state.items.reduce((sum, item) => sum + item.quantity, 0),
    quantityByProductId: (state) => (productId: string) =>
      state.items.filter((i) => i.id === productId).reduce((sum, item) => sum + item.quantity, 0),
    hasDeliveryZone: (state) => !!state.deliveryZone,
    grandTotal(): number {
      return this.total + this.deliveryCost
    },
    canCheckout(): boolean {
      if (!this.items.length) return false
      if (this.deliveryError) return false
      if (!this.deliveryZone) return false
      const zoneMin = this.deliveryZone.minOrderAmount
      return this.total >= zoneMin
    },
    deliverySummary: (state) => {
      if (!state.deliveryZone) {
        return {
          hasZone: false,
          message: state.deliveryError ?? 'Укажите адрес доставки, чтобы рассчитать доставку',
          cost: 0,
          minOrderAmount: null,
          freeDeliveryThreshold: null,
          zoneName: null,
        }
      }

      const z = state.deliveryZone
      const total = state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
      const isFree = total >= z.freeDeliveryThreshold
      const cost = isFree ? 0 : z.deliveryCost

      return {
        hasZone: true,
        message: isFree
          ? 'Доставка бесплатна для вашей зоны'
          : `Доставка: ${cost.toFixed(0)} ₽. Бесплатно от ${z.freeDeliveryThreshold} ₽`,
        cost,
        minOrderAmount: z.minOrderAmount,
        freeDeliveryThreshold: z.freeDeliveryThreshold,
        zoneName: z.name,
      }
    },
    /**
     * Секции витрины: один «чип» навигации на группу или на отдельную категорию;
     * внутри группы — блоки по исходным категориям (подзаголовки).
     */
    catalogSections(): CatalogSection[] {
      const products = this.products
      if (!products.length) return []

      type Bucket = {
        catName: string
        catSort: number
        categoryId: string | null
        menuGroup: Product['menuGroup']
        products: Product[]
      }

      const buckets = new Map<string, Bucket>()
      for (const p of products) {
        const catName = p.category || 'Без категории'
        const key = p.categoryId ? `id:${p.categoryId}` : `n:${catName}`
        let b = buckets.get(key)
        if (!b) {
          b = {
            catName,
            catSort: p.categorySortOrder ?? 0,
            categoryId: p.categoryId ?? null,
            menuGroup: p.menuGroup ?? null,
            products: [],
          }
          buckets.set(key, b)
        }
        b.products.push(p)
      }

      type GroupAgg = {
        id: string
        name: string
        sortOrder: number
        cats: Bucket[]
      }
      const groupMap = new Map<string, GroupAgg>()
      const solo: Bucket[] = []

      for (const b of buckets.values()) {
        const mg = b.menuGroup
        if (mg?.id) {
          let g = groupMap.get(mg.id)
          if (!g) {
            g = { id: mg.id, name: mg.name, sortOrder: mg.sortOrder ?? 0, cats: [] }
            groupMap.set(mg.id, g)
          }
          g.cats.push(b)
        } else {
          solo.push(b)
        }
      }

      type Root =
        | { kind: 'group'; sort: number; tie: string; g: GroupAgg }
        | { kind: 'solo'; sort: number; tie: string; b: Bucket }

      const roots: Root[] = []
      for (const g of groupMap.values()) {
        roots.push({ kind: 'group', sort: g.sortOrder, tie: g.name, g })
      }
      for (const b of solo) {
        roots.push({ kind: 'solo', sort: b.catSort, tie: b.catName, b })
      }
      roots.sort((a, b) => a.sort - b.sort || a.tie.localeCompare(b.tie, 'ru'))

      const out: CatalogSection[] = []
      for (const r of roots) {
        if (r.kind === 'solo') {
          const b = r.b
          const sid = soloSectionId(b.categoryId, b.catName)
          out.push({
            sectionId: sid,
            navLabel: b.catName,
            title: b.catName,
            blocks: [{ blockId: sid, heading: null, products: b.products }],
          })
        } else {
          const g = r.g
          g.cats.sort((a, b) => a.catSort - b.catSort || a.catName.localeCompare(b.catName, 'ru'))
          const blocks: CatalogBlock[] = g.cats.map((c) => {
            const bid = soloSectionId(c.categoryId, c.catName)
            return {
              blockId: bid,
              heading: c.catName,
              products: c.products,
            }
          })
          out.push({
            sectionId: `mg-${g.id}`,
            navLabel: g.name,
            title: g.name,
            blocks,
          })
        }
      }
      return out
    },
    pendingRemovalById: (state) => (cartItemId: string) => state.pendingRemovals[cartItemId] ?? null,
    pendingCartClearMeta: (state) => state.pendingCartClear,
  },
  actions: {
    timerKey(cartItemId: string) {
      return `${this.scopeKey ?? 'global'}::${cartItemId}`
    },
    clearPendingRemovalTimer(cartItemId: string) {
      const key = this.timerKey(cartItemId)
      const timer = pendingRemovalTimers.get(key)
      if (timer) {
        clearTimeout(timer)
        pendingRemovalTimers.delete(key)
      }
    },
    clearPendingCartClearTimer() {
      const key = this.scopeKey ?? 'global'
      const timer = pendingCartClearTimers.get(key)
      if (timer) {
        clearTimeout(timer)
        pendingCartClearTimers.delete(key)
      }
    },
    clearPendingCartClear() {
      this.clearPendingCartClearTimer()
      this.pendingCartClear = null
    },
    clearPendingRemoval(cartItemId: string) {
      this.clearPendingRemovalTimer(cartItemId)
      if (this.pendingRemovals[cartItemId]) {
        const next = { ...this.pendingRemovals }
        delete next[cartItemId]
        this.pendingRemovals = next
      }
    },
    scheduleItemRemoval(cartItemId: string, durationMs = 5000) {
      const item = this.items.find((i) => i.cartItemId === cartItemId)
      if (!item) return
      this.clearPendingRemovalTimer(cartItemId)
      const now = Date.now()
      const expiresAt = now + durationMs
      this.pendingRemovals = {
        ...this.pendingRemovals,
        [cartItemId]: {
          startedAt: now,
          expiresAt,
          durationMs,
        },
      }
      const key = this.timerKey(cartItemId)
      const timeout = setTimeout(() => {
        this.removeItemNow(cartItemId)
      }, durationMs)
      pendingRemovalTimers.set(key, timeout)
    },
    cancelPendingRemoval(cartItemId: string) {
      this.clearPendingRemoval(cartItemId)
    },
    flushPendingRemovals() {
      const ids = Object.keys(this.pendingRemovals)
      if (!ids.length) return
      ids.forEach((id) => this.removeItemNow(id))
    },
    removeItemNow(cartItemId: string) {
      this.clearPendingCartClear()
      this.clearPendingRemoval(cartItemId)
      this.items = this.items.filter((i) => i.cartItemId !== cartItemId)
      persistCart(this.scopeKey, this.items)
      if (this.deliveryZone) {
        this.setDeliveryZone(this.deliveryZone)
      }
    },
    scheduleCartClear(durationMs = 5000) {
      if (!this.items.length) {
        this.clearPendingCartClear()
        return
      }
      this.clearPendingCartClearTimer()
      const now = Date.now()
      this.pendingCartClear = {
        startedAt: now,
        expiresAt: now + durationMs,
        durationMs,
      }
      const key = this.scopeKey ?? 'global'
      const timeout = setTimeout(() => {
        this.clear()
      }, durationMs)
      pendingCartClearTimers.set(key, timeout)
    },
    cancelPendingCartClear() {
      this.clearPendingCartClear()
    },
    setScope(nextScopeKey: string | null) {
      const normalized = typeof nextScopeKey === 'string' && nextScopeKey.trim()
        ? nextScopeKey.trim()
        : null

      if (this.scopeKey !== normalized) {
        this.flushPendingRemovals()
        this.clearPendingCartClear()
        this.scopeKey = normalized
        this.items = getStoredCartItems(this.scopeKey)
        this.deliveryZone = null
        this.deliveryError = null
        this.deliveryCost = this.items.length ? 200 : 0
        this.pendingRemovals = {}
        this.pendingCartClear = null
        // Каталог товаров должен загружаться заново для нового ресторана
        this.products = []
        return
      }

      // Тот же scope: раньше здесь был return и не вызывался getStoredCartItems —
      // после гидрации Pinia scope уже верный, а items пустые, хотя данные есть в localStorage.
      this.items = getStoredCartItems(this.scopeKey)
      this.deliveryCost = this.items.length ? 200 : 0
      if (this.deliveryZone) {
        this.setDeliveryZone(this.deliveryZone)
      }
    },
    /**
     * Раньше ключом при ?shop_id=uuid был UUID; теперь приоритет у city/tenant в пути.
     * Если для нового ключа пусто, а в legacy UUID-ключе есть позиции — переносим в текущий scope.
     */
    adoptLegacyShopIdScopeIfEmpty(legacyShopIdFromQuery: string | null | undefined) {
      if (typeof localStorage === 'undefined') return
      const legacy =
        typeof legacyShopIdFromQuery === 'string' ? legacyShopIdFromQuery.trim() : ''
      if (!legacy || !looksLikeShopUuid(legacy)) return
      const current = this.scopeKey
      if (!current || legacy === current) return
      if (looksLikeShopUuid(current)) return
      if (this.items.length > 0) return
      const fromLegacy = getStoredCartItems(legacy)
      if (!fromLegacy.length) return
      this.items = [...fromLegacy]
      persistCart(this.scopeKey, this.items)
      this.deliveryCost = this.items.length ? 200 : 0
      if (this.deliveryZone) {
        this.setDeliveryZone(this.deliveryZone)
      }
    },
    setProducts(products: Product[]) {
      this.products = Array.isArray(products) ? products : []
    },
    addItem(product: Product, quantity = 1, modifiers: SelectedModifier[] = [], parameters: SelectedParameter[] = []) {
      this.clearPendingCartClear()
      const cartItemId = generateCartItemId(product.id, modifiers, parameters)
      this.clearPendingRemoval(cartItemId)
      const existing = this.items.find((i) => i.cartItemId === cartItemId)
      
      if (existing) {
        existing.quantity += quantity
      } else {
        const unitPrice = calculateUnitPrice(product.price, modifiers, parameters)
        this.items.push({ 
          ...product, 
          cartItemId,
          quantity,
          selectedModifiers: modifiers,
          selectedParameters: parameters,
          unitPrice
        })
      }
      persistCart(this.scopeKey, this.items)
      // При изменении корзины пересчитаем стоимость доставки для текущей зоны
      if (this.deliveryZone) {
        this.setDeliveryZone(this.deliveryZone)
      }
    },
    removeItem(cartItemId: string) {
      this.removeItemNow(cartItemId)
    },
    updateQuantity(cartItemId: string, quantity: number) {
      const item = this.items.find((i) => i.cartItemId === cartItemId)
      if (item) {
        this.clearPendingCartClear()
        if (quantity <= 0) this.removeItem(cartItemId)
        else {
          this.clearPendingRemoval(cartItemId)
          item.quantity = quantity
          persistCart(this.scopeKey, this.items)
          if (this.deliveryZone) {
            this.setDeliveryZone(this.deliveryZone)
          }
        }
      }
    },
    decrementByProductId(productId: string) {
      const item = this.items.find((i) => i.id === productId)
      if (!item) return
      this.updateQuantity(item.cartItemId, item.quantity - 1)
    },
    clear() {
      this.clearPendingCartClear()
      this.flushPendingRemovals()
      this.items = []
      this.pendingRemovals = {}
      persistCart(this.scopeKey, this.items)
      this.deliveryZone = null
      this.deliveryError = null
      this.deliveryCost = 0
    },
    /** Восстановить корзину из localStorage (вызывать на клиенте после гидрации) */
    hydrateFromStorage(scopeKey: string | null = null) {
      if (typeof localStorage === 'undefined') return
      this.scopeKey = typeof scopeKey === 'string' && scopeKey.trim() ? scopeKey.trim() : null
      this.clearPendingCartClear()
      this.flushPendingRemovals()
      this.items = getStoredCartItems(this.scopeKey)
      this.pendingRemovals = {}
      this.pendingCartClear = null
      this.deliveryZone = null
      this.deliveryError = null
      this.deliveryCost = this.items.length ? 200 : 0
      // Fallback для локальной разработки без tenant-базы.
      if (!this.products.length) this.products = MOCK_PRODUCTS
    },
    setDeliveryZone(zone: DeliveryZoneProperties | null) {
      this.deliveryZone = zone
      this.deliveryError = null

      if (!zone) {
        // Если зона не определена, используем базовый тариф для города,
        // но только когда в корзине есть товары
        this.deliveryCost = this.items.length ? 200 : 0
        this.deliveryError = 'Мы пока не доставляем по этому адресу'
        return
      }

      if (this.total >= zone.freeDeliveryThreshold) {
        this.deliveryCost = 0
      } else {
        this.deliveryCost = zone.deliveryCost
      }
    },
    setDeliveryError(message: string | null) {
      this.deliveryError = message
    },
    mergeBridgePayload(payload: BridgeCartPayload | null | undefined, fallbackScopeKey: string | null = null) {
      const scopedFromPayload = typeof payload?.scopeKey === 'string' && payload.scopeKey.trim()
        ? payload.scopeKey.trim()
        : null
      const targetScope = scopedFromPayload || (typeof fallbackScopeKey === 'string' && fallbackScopeKey.trim() ? fallbackScopeKey.trim() : null)
      if (!targetScope) return

      const bridgeItemsRaw = Array.isArray(payload?.items) ? payload?.items : []
      const bridgeItems = bridgeItemsRaw
        .map((row) => normalizeBridgeItem(row))
        .filter((row): row is CartItem => row !== null)
      if (!bridgeItems.length) return

      const currentItems = getStoredCartItems(targetScope)
      const merged = [...currentItems]
      const byCartItemId = new Map<string, CartItem>()
      for (const item of merged) byCartItemId.set(item.cartItemId, item)

      for (const item of bridgeItems) {
        const existing = byCartItemId.get(item.cartItemId)
        if (existing) {
          existing.quantity += item.quantity
        } else {
          const next = { ...item }
          merged.push(next)
          byCartItemId.set(next.cartItemId, next)
        }
      }

      persistCart(targetScope, merged)
      if (this.scopeKey === targetScope) {
        this.items = merged
        if (this.deliveryZone) {
          this.setDeliveryZone(this.deliveryZone)
        }
      }
    },
    replaceItemConfig(
      oldCartItemId: string,
      product: Product,
      quantity: number,
      modifiers: SelectedModifier[] = [],
      parameters: SelectedParameter[] = [],
    ) {
      const qty = Math.max(1, Math.floor(quantity || 1))
      this.removeItemNow(oldCartItemId)
      this.addItem(product, qty, modifiers, parameters)
    },
  },
})
