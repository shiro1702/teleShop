import { defineStore } from 'pinia'
import type { Product } from '~/data/products'
import { MOCK_PRODUCTS } from '~/data/products'
import type { DeliveryZoneProperties } from '~/utils/deliveryZones'

const CART_STORAGE_KEY = 'teleshop-cart'

function buildCartStorageKey(scopeKey: string | null): string {
  const scope = typeof scopeKey === 'string' ? scopeKey.trim() : ''
  return scope ? `${CART_STORAGE_KEY}:${scope}` : CART_STORAGE_KEY
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
    productsByCategory(): { category: string; label: string; products: Product[] }[] {
      // Group products dynamically based on their category string
      const map = new Map<string, Product[]>()
      this.products.forEach(p => {
        const cat = p.category || 'Без категории'
        if (!map.has(cat)) map.set(cat, [])
        map.get(cat)!.push(p)
      })
      
      return Array.from(map.entries()).map(([category, products]) => ({
        category,
        label: category, // Use the category name directly as the label
        products
      }))
    },
  },
  actions: {
    setScope(nextScopeKey: string | null) {
      const normalized = typeof nextScopeKey === 'string' && nextScopeKey.trim()
        ? nextScopeKey.trim()
        : null

      if (this.scopeKey === normalized) return

      this.scopeKey = normalized
      this.items = getStoredCartItems(this.scopeKey)
      this.deliveryZone = null
      this.deliveryError = null
      this.deliveryCost = this.items.length ? 200 : 0
      // Каталог товаров должен загружаться заново для нового ресторана
      this.products = []
    },
    setProducts(products: Product[]) {
      this.products = Array.isArray(products) ? products : []
    },
    addItem(product: Product, quantity = 1, modifiers: SelectedModifier[] = [], parameters: SelectedParameter[] = []) {
      const cartItemId = generateCartItemId(product.id, modifiers, parameters)
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
      this.items = this.items.filter((i) => i.cartItemId !== cartItemId)
      persistCart(this.scopeKey, this.items)
      if (this.deliveryZone) {
        this.setDeliveryZone(this.deliveryZone)
      }
    },
    updateQuantity(cartItemId: string, quantity: number) {
      const item = this.items.find((i) => i.cartItemId === cartItemId)
      if (item) {
        if (quantity <= 0) this.removeItem(cartItemId)
        else {
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
      this.items = []
      persistCart(this.scopeKey, this.items)
      this.deliveryZone = null
      this.deliveryError = null
      this.deliveryCost = 0
    },
    /** Восстановить корзину из localStorage (вызывать на клиенте после гидрации) */
    hydrateFromStorage(scopeKey: string | null = null) {
      if (typeof localStorage === 'undefined') return
      this.scopeKey = typeof scopeKey === 'string' && scopeKey.trim() ? scopeKey.trim() : null
      this.items = getStoredCartItems(this.scopeKey)
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
  },
})
