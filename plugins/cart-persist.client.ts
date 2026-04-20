import { nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  cartLocalStorageKey,
  CART_LOCAL_STORAGE_PREFIX,
  listCartLocalStorageKeys,
  useCartStore,
} from '~/stores/cart'
import {
  readShopIdFromQuery,
  resolveCartScopeKey,
  shopIdLikeForCartScope,
} from '~/utils/cartScope'

export default defineNuxtPlugin((nuxtApp) => {
  const cart = useCartStore()
  const route = useRoute()

  const applyScope = () => {
    const scope = resolveCartScopeKey(route, shopIdLikeForCartScope(route))
    cart.setScope(scope)
    cart.adoptLegacyShopIdScopeIfEmpty(readShopIdFromQuery(route))
  }

  applyScope()
  watch(
    () => route.fullPath,
    () => applyScope(),
  )
  watch(
    () => route.params,
    () => applyScope(),
    { deep: true },
  )
  nuxtApp.hook('page:finish', () => {
    nextTick(() => applyScope())
  })

  if (import.meta.dev) {
    ;(globalThis as Record<string, unknown>).__teleshopCartStorage = () => ({
      prefix: CART_LOCAL_STORAGE_PREFIX,
      scopeKey: cart.scopeKey,
      currentLocalStorageKey: cartLocalStorageKey(cart.scopeKey),
      allCartKeysInLocalStorage: listCartLocalStorageKeys(),
      hint:
        `Ключ = ${CART_LOCAL_STORAGE_PREFIX} или ${CART_LOCAL_STORAGE_PREFIX}:<scope>; scope — resolveCartScopeKey() в utils/cartScope.ts`,
    })
  }
})
