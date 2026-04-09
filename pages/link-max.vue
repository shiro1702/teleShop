<template>
  <div class="link-max-page">
    <h1>Привязка MAX</h1>

    <p v-if="!token">Некорректная ссылка: отсутствует токен.</p>

    <div v-else>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="isLoading || isSuccess || !token"
        @click="linkMax"
      >
        <span v-if="isLoading">Привязка...</span>
        <span v-else-if="isSuccess">Успешно привязано</span>
        <span v-else>Привязать MAX</span>
      </button>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="isSuccess" class="success">MAX-аккаунт успешно привязан к вашему профилю.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, useSupabaseClient } from '#imports'

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()

const token = computed(() => {
  const t = route.query.token
  return typeof t === 'string' ? t : undefined
})
const redirectPath = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' ? r : undefined
})
const shopId = computed(() => {
  const s = route.query.shop_id
  return typeof s === 'string' && s.trim() ? s.trim() : undefined
})

const isLoading = ref(false)
const isSuccess = ref(false)
const errorMessage = ref<string | null>(null)
const cartStore = useCartStore()

function resolveTenantCartTarget() {
  const fallbackPath = shopId.value ? `/${shopId.value}/cart` : '/cart'
  const raw = redirectPath.value || fallbackPath
  if (!raw.startsWith('/')) return fallbackPath

  const [pathPart, queryPart = ''] = raw.split('?')
  const query = new URLSearchParams(queryPart)
  const safePath = pathPart.endsWith('/cart')
    ? pathPart
    : pathPart.endsWith('/checkout')
      ? pathPart.replace(/\/checkout$/, '/cart')
      : fallbackPath
  if (!query.get('shop_id') && shopId.value) {
    query.set('shop_id', shopId.value)
  }
  const serialized = query.toString()
  return serialized ? `${safePath}?${serialized}` : safePath
}

async function resolveCanonicalCartTarget() {
  if (!shopId.value) return resolveTenantCartTarget()
  try {
    const canonical = await $fetch<{ ok: boolean; cartPath?: string }>('/api/tenant/resolve-canonical', {
      query: { shop_id: shopId.value },
    })
    if (canonical?.ok && typeof canonical.cartPath === 'string' && canonical.cartPath.startsWith('/')) {
      return canonical.cartPath
    }
  } catch {
    // fall back to local target resolution
  }
  return resolveTenantCartTarget()
}

onMounted(async () => {
  if (!token.value) {
    errorMessage.value = 'Некорректная или устаревшая ссылка.'
    return
  }
  if (!isSuccess.value && !isLoading.value) {
    await linkMax()
  }
})

const linkMax = async () => {
  if (!token.value) {
    errorMessage.value = 'Токен отсутствует.'
    return
  }
  isLoading.value = true
  errorMessage.value = null
  try {
    const res = await $fetch<{
      success: boolean
      access_token: string
      refresh_token: string
      bridge_payload?: {
        scopeKey?: string
        items?: unknown[]
      } | null
    }>('/api/auth/exchange-max-session', {
      method: 'POST',
      body: { token: token.value },
    })
    if (!res?.success) throw new Error('Не удалось создать MAX сессию.')

    const { error: setError } = await supabase.auth.setSession({
      access_token: res.access_token,
      refresh_token: res.refresh_token,
    })
    if (setError) throw new Error('Не удалось установить сессию Supabase на клиенте.')

    if (res.bridge_payload) {
      const fallbackScopeKey = shopId.value || null
      cartStore.mergeBridgePayload(res.bridge_payload as any, fallbackScopeKey)
    }

    isSuccess.value = true
    await router.replace(await resolveCanonicalCartTarget())
  } catch (err: any) {
    errorMessage.value =
      err?.data?.statusMessage ||
      err?.statusMessage ||
      err?.message ||
      'Не удалось привязать MAX.'
    isSuccess.value = false
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.link-max-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}
.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 0.4rem;
  border: none;
  cursor: pointer;
}
.btn-primary {
  background: #E25E2D;
  color: #ffffff;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error {
  margin-top: 1rem;
  color: #dc2626;
}
.success {
  margin-top: 1rem;
  color: #16a34a;
}
</style>
