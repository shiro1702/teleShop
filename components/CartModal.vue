<template>
  <Teleport to="body">
    <Transition name="cart">
      <div
        v-if="cartStore.isCartModalOpen"
        class="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        <!-- Оверлей -->
        <div
          class="absolute inset-0 bg-black/50"
          @click="cartStore.closeCartModal()"
        />
        <!-- Боттомшит (моб) / модалка (десктоп) -->
        <div
          class="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl bg-gray-50 shadow-xl pb-[env(safe-area-inset-bottom)] sm:max-h-[90vh] sm:rounded-2xl sm:pb-0"
          @click.stop
        >
          <!-- Ручка боттомшита только на мобильных -->
          <div class="flex shrink-0 justify-center pt-2 sm:hidden">
            <span class="h-1 w-12 rounded-full bg-gray-300" aria-hidden="true" />
          </div>
          <div class="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <h2 id="cart-title" class="text-lg font-bold text-gray-900 sm:text-xl">
              Корзина
            </h2>
            <button
              type="button"
              class="-mr-2 rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Закрыть"
              @click="cartStore.closeCartModal()"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Прокручиваемый список (без итого) -->
          <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            <div v-if="cartStore.items.length === 0" class="py-12 text-center">
              <p class="text-gray-500">Корзина пуста</p>
              <button
                type="button"
                class="mt-4 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8]"
                @click="cartStore.closeCartModal()"
              >
                Перейти к товарам
              </button>
            </div>
            <ul v-else class="space-y-4">
              <CartItem
                v-for="item in cartStore.items"
                :key="item.id"
                :item="item"
              />
            </ul>
          </div>
          <!-- Итого, очистить и оформить заказ закреплено снизу -->
          <div
            v-if="cartStore.items.length > 0"
            class="shrink-0 space-y-3 border-t border-gray-200 bg-white p-4 sm:px-6 sm:py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4"
          >
            <div class="flex justify-end">
              <button
                type="button"
                class="text-sm text-gray-500 transition hover:text-red-600"
                @click="cartStore.clear(); cartStore.closeCartModal()"
              >
                Очистить корзину
              </button>
            </div>
            <div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-gray-900">Итого:</span>
                <span class="text-xl font-bold text-[#2563eb]">
                  {{ formatPrice(cartStore.total) }}
                </span>
              </div>
              <button
                type="button"
                class="mt-1 w-full rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:bg-[#1e40af]"
                @click="handleCheckout"
              >
                Оформить заказ
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const cartStore = useCartStore()

function handleCheckout() {
  // TODO: интеграция с серверным роутом /api/order и Telegram WebApp
  // пока просто закрываем корзину после нажатия
  cartStore.closeCartModal()
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}
</script>

<style scoped>
.cart-enter-active,
.cart-leave-active {
  transition: opacity 0.25s ease;
}
.cart-enter-active .relative,
.cart-leave-active .relative {
  transition: transform 0.25s ease;
}
.cart-enter-from,
.cart-leave-to {
  opacity: 0;
}
/* Мобильный боттомшит: выезжает снизу */
.cart-enter-from .relative,
.cart-leave-to .relative {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .cart-enter-from .relative,
  .cart-leave-to .relative {
    transform: scale(0.95);
  }
}
</style>
