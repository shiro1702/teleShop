import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCartStore } from '~/stores/cart'
import { resolveCartScopeKey } from '~/utils/cartScope'

export default defineNuxtPlugin(() => {
  const cart = useCartStore()
  const route = useRoute()

  const applyScope = () => {
    const scope = resolveCartScopeKey(route)
    cart.setScope(scope)
  }

  applyScope()
  watch(
    () => route.fullPath,
    () => applyScope(),
  )
})
