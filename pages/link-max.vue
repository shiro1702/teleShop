<template>
  <div class="link-max-page">
    <h1>Вход через MAX</h1>

    <p v-if="!token">Некорректная ссылка: отсутствует токен.</p>

    <div v-else>
      <p v-if="statusLine" class="status">{{ statusLine }}</p>

      <button
        type="button"
        class="btn btn-primary"
        :disabled="isLoading || isSuccess || !token"
        @click="linkMax"
      >
        <span v-if="isLoading">Завершение входа…</span>
        <span v-else-if="isSuccess">Готово</span>
        <span v-else>Повторить попытку</span>
      </button>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="isSuccess" class="success">Вход выполнен. Перенаправляем…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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
const statusLine = ref<string | null>(null)
const cartStore = useCartStore()

let pollAborted = false

onBeforeUnmount(() => {
  pollAborted = true
})

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

async function resolveAfterLogin() {
  const raw = redirectPath.value || ''
  if (raw.includes('/cart')) {
    return resolveCanonicalCartTarget()
  }
  const fallbackPath = shopId.value ? `/${shopId.value}/cart` : '/cart'
  const pathToUse = raw.startsWith('/') ? raw : fallbackPath
  const [pathPart, queryPart = ''] = pathToUse.split('?')
  const query = new URLSearchParams(queryPart)
  if (!query.get('shop_id') && shopId.value) {
    query.set('shop_id', shopId.value)
  }
  const serialized = query.toString()
  return serialized ? `${pathPart}?${serialized}` : pathPart
}

async function pollUntilReady(): Promise<void> {
  const maxAttempts = 150
  for (let i = 0; i < maxAttempts; i++) {
    if (pollAborted) throw new Error('Отменено')
    const st = await $fetch<{ ok: boolean; state: string }>('/api/auth/max-link-status', {
      query: { token: token.value },
    })
    if (st.state === 'ready') return
    if (st.state === 'expired') {
      throw new Error('Срок ссылки истёк. Запросите вход на сайте снова.')
    }
    if (st.state === 'invalid') {
      throw new Error('Ссылка недействительна. Запросите вход на сайте снова.')
    }
    statusLine.value =
      i === 0
        ? 'Откройте бота MAX во второй вкладке и подтвердите вход. Эта страница обновится автоматически.'
        : 'Ожидаем подтверждение в MAX…'
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('Не дождались подтверждения в MAX. Попробуйте снова.')
}

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
      expires_in: number
      bridge_payload?: {
        scopeKey?: string
        items?: unknown[]
      } | null
    }>('/api/auth/exchange-max-session', {
      method: 'POST',
      body: { token: token.value },
    })

    if (res?.success) {
      const { access_token, refresh_token } = res
      const { error: setError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })

      if (setError) {
        throw new Error('Не удалось установить сессию Supabase на клиенте.')
      }

      if (res.bridge_payload) {
        const fallbackScopeKey = shopId.value || null
        cartStore.mergeBridgePayload(res.bridge_payload as any, fallbackScopeKey)
      }

      isSuccess.value = true
      await router.replace(await resolveAfterLogin())
    } else {
      throw new Error('Не удалось создать сессию Supabase.')
    }
  } catch (err: any) {
    const message =
      err?.data?.statusMessage ||
      err?.statusMessage ||
      err?.message ||
      'Не удалось завершить вход.'
    errorMessage.value = message
    isSuccess.value = false
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  if (!token.value) {
    errorMessage.value = 'Некорректная или устаревшая ссылка.'
    return
  }

  isLoading.value = true
  errorMessage.value = null
  statusLine.value = 'Проверяем статус входа…'

  try {
    await pollUntilReady()
    statusLine.value = 'Подтверждение получено. Завершаем вход…'
    await linkMax()
  } catch (err: any) {
    const message =
      err?.data?.statusMessage ||
      err?.statusMessage ||
      err?.message ||
      'Не удалось завершить вход.'
    errorMessage.value = message
  } finally {
    if (!isSuccess.value) {
      isLoading.value = false
    }
  }
})
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
  background: #e25e2d;
  color: #ffffff;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  margin-bottom: 1rem;
  font-size: 0.95rem;
  line-height: 1.45;
  color: #4b5563;
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
