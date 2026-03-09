import { defineStore } from 'pinia'
import type { Product, ProductCategory } from '~/data/products'
import { MOCK_PRODUCTS } from '~/data/products'

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
  }),
  getters: {
    total: (state) =>
      state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    count: (state) =>
      state.items.reduce((sum, item) => sum + item.quantity, 0),
    quantityById: (state) => (productId: string) =>
      state.items.find((i) => i.id === productId)?.quantity ?? 0,
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
    },
    removeItem(id: string) {
      this.items = this.items.filter((i) => i.id !== id)
      persistCart(this.items)
    },
    updateQuantity(id: string, quantity: number) {
      const item = this.items.find((i) => i.id === id)
      if (item) {
        if (quantity <= 0) this.removeItem(id)
        else {
          item.quantity = quantity
          persistCart(this.items)
        }
      }
    },
    clear() {
      this.items = []
      persistCart(this.items)
    },
    openCartModal() {
      this.isCartModalOpen = true
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
  },
})
