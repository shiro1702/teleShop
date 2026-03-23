export default defineNuxtPlugin(() => {
  const cart = useCartStore()
  // Скоуп корзины выбирается на страницах из tenant context (shop/slug).
  cart.hydrateFromStorage(null)
})
