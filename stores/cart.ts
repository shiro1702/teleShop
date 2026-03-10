import { defineStore } from 'pinia'
import type { Product, ProductCategory } from '~/data/products'
import { MOCK_PRODUCTS } from '~/data/products'
import type { DeliveryZoneProperties } from '~/utils/deliveryZones'

const CART_STORAGE_KEY = 'teleshop-cart'

function getStoredCartItems(): CartItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
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

function persistCart(items: CartItem[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota / private mode
  }
}

export interface CartItem extends Product {
  quantity: number
}

const CATEGORY_ORDER: ProductCategory[] = ['main', 'закуски', 'супы', 'десерты']
const CATEGORY_LABELS: Record<ProductCategory, string> = {
  main: 'Основные блюда',
  закуски: 'Закуски',
  супы: 'Супы',
  десерты: 'Десерты',
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    products: MOCK_PRODUCTS,
    items: getStoredCartItems(),
    isCartModalOpen: false,
    deliveryZone: null as DeliveryZoneProperties | null,
    // Базовая стоимость доставки по городу до уточнения зоны
    deliveryCost: 200,
    deliveryError: null as string | null,
  }),
  getters: {
    total: (state) =>
      state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    count: (state) =>
      state.items.reduce((sum, item) => sum + item.quantity, 0),
    quantityById: (state) => (productId: string) =>
      state.items.find((i) => i.id === productId)?.quantity ?? 0,
    hasDeliveryZone: (state) => !!state.deliveryZone,
    grandTotal: (state) => state.total + state.deliveryCost,
    canCheckout: (state): boolean => {
      if (!state.items.length) return false
      if (state.deliveryError) return false
      if (!state.deliveryZone) return false
      const zoneMin = state.deliveryZone.minOrderAmount
      return state.total >= zoneMin
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
      const isFree = state.total >= z.freeDeliveryThreshold
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
    productsByCategory(): { category: ProductCategory; label: string; products: Product[] }[] {
      return CATEGORY_ORDER.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        products: this.products.filter((p) => p.category === category),
      })).filter((section) => section.products.length > 0)
    },
  },
  actions: {
    addItem(product: Product, quantity = 1) {
      const existing = this.items.find((i) => i.id === product.id)
      if (existing) {
        existing.quantity += quantity
      } else {
        this.items.push({ ...product, quantity })
      }
      persistCart(this.items)
      // При изменении корзины пересчитаем стоимость доставки для текущей зоны
      if (this.deliveryZone) {
        this.setDeliveryZone(this.deliveryZone)
      }
    },
    removeItem(id: string) {
      this.items = this.items.filter((i) => i.id !== id)
      persistCart(this.items)
      if (this.deliveryZone) {
        this.setDeliveryZone(this.deliveryZone)
      }
    },
    updateQuantity(id: string, quantity: number) {
      const item = this.items.find((i) => i.id === id)
      if (item) {
        if (quantity <= 0) this.removeItem(id)
        else {
          item.quantity = quantity
          persistCart(this.items)
          if (this.deliveryZone) {
            this.setDeliveryZone(this.deliveryZone)
          }
        }
      }
    },
    clear() {
      this.items = []
      persistCart(this.items)
      this.deliveryCost = 0
    },
    openCartModal() {
      this.isCartModalOpen = true
      // При первом открытии корзины, если зона ещё не выбрана,
      // считаем доставку по базовому тарифу
      if (!this.deliveryZone && this.items.length && !this.deliveryCost) {
        this.deliveryCost = 200
      }
    },
    closeCartModal() {
      this.isCartModalOpen = false
    },
    /** Восстановить корзину из localStorage (вызывать на клиенте после гидрации) */
    hydrateFromStorage() {
      if (typeof localStorage === 'undefined') return
      const stored = getStoredCartItems()
      if (stored.length > 0) this.items = stored
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
