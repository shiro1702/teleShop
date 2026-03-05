import { defineStore } from 'pinia'

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as { id: string; name: string; price: number; quantity: number }[],
  }),
  getters: {
    total: (state) =>
      state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    count: (state) =>
      state.items.reduce((sum, item) => sum + item.quantity, 0),
  },
  actions: {
    addItem(item: { id: string; name: string; price: number }, quantity = 1) {
      const existing = this.items.find((i) => i.id === item.id)
      if (existing) {
        existing.quantity += quantity
      } else {
        this.items.push({ ...item, quantity })
      }
    },
    removeItem(id: string) {
      this.items = this.items.filter((i) => i.id !== id)
    },
    clear() {
      this.items = []
    },
  },
})
