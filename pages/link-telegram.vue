<template>
  <div class="link-telegram-page">
    <h1>Вход через Telegram</h1>

    <p v-if="!token">Некорректная ссылка: отсутствует токен.</p>

    <div v-else>
      <p v-if="statusLine" class="status">{{ statusLine }}</p>
      <button
        v-if="telegramStartLink"
        type="button"
        class="btn btn-secondary"
        :disabled="isSuccess"
        @click="openTelegramBot"
      >
        Открыть Telegram и подтвердить вход
      </button>

      <button
        type="button"
        class="btn btn-primary"
        :disabled="isLoading || isSuccess || !token"
        @click="linkTelegram"
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
import { useRoute, useRouter, useRuntimeConfig, useSupabaseClient } from '#imports'

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const config = useRuntimeConfig()

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
const telegramBotName = computed(() => {
  const raw = (config.public.telegramBotName as string | undefined) || ''
  return raw.trim().replace(/^@/, '')
})
const telegramStartLink = computed(() => {
  if (!token.value || !telegramBotName.value) return ''
  return `https://t.me/${telegramBotName.value}?start=${encodeURIComponent(`link_${token.value}`)}`
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

function openTelegramBot(): void {
  if (!telegramStartLink.value || typeof window === 'undefined') return
  window.location.href = telegramStartLink.value
}

function resolveTenantCartTarget(): string {
  const fallbackFull = shopId.value ? `/${shopId.value}/checkout?step=1` : '/checkout?step=1'
  const raw = redirectPath.value || fallbackFull
  if (!raw.startsWith('/')) return fallbackFull

  const [pathPart, queryPart = ''] = raw.split('?')
  const query = new URLSearchParams(queryPart)

  let pathOnly = pathPart
  if (pathOnly.endsWith('/cart')) {
    pathOnly = pathOnly.replace(/\/cart$/, '/checkout')
  }
  if (!pathOnly.endsWith('/checkout')) {
    return fallbackFull
  }

  if (!query.get('shop_id') && shopId.value) {
    query.set('shop_id', shopId.value)
  }
  if (!query.has('step')) {
    query.set('step', '1')
  }

  const serialized = query.toString()
  return serialized ? `${pathOnly}?${serialized}` : `${pathOnly}?step=1`
}

async function resolveCanonicalCartTarget(): Promise<string> {
  if (!shopId.value) return resolveTenantCartTarget()
  try {
    const canonical = await $fetch<{ ok: boolean; checkoutPath?: string }>(
      '/api/tenant/resolve-canonical',
      {
        query: { shop_id: shopId.value },
      },
    )
    if (
      canonical?.ok
      && typeof canonical.checkoutPath === 'string'
      && canonical.checkoutPath.startsWith('/')
    ) {
      return `${canonical.checkoutPath}?step=1`
    }
  } catch {
    // fall back to local target resolution
  }
  return resolveTenantCartTarget()
}

/** После входа: для корзины — канонический путь; иначе — redirect из query + shop_id. */
async function resolveAfterLogin() {
  const raw = redirectPath.value || ''
  if (raw.includes('/cart')) {
    return resolveCanonicalCartTarget()
  }
  const fallbackPath = shopId.value ? `/${shopId.value}/checkout?step=1` : '/checkout?step=1'
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
    const st = await $fetch<{ ok: boolean; state: string }>('/api/auth/telegram-link-status', {
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
        ? 'Откройте бота во второй вкладке и подтвердите вход. Эта страница обновится автоматически.'
        : 'Ожидаем подтверждение в Telegram…'
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('Не дождались подтверждения в Telegram. Попробуйте снова.')
}

const linkTelegram = async () => {
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
    }>('/api/auth/exchange-telegram-session', {
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
    await linkTelegram()
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
.link-telegram-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 0.4rem;
  border: none;
  cursor: pointer;
  width: 100%;
  margin-top: 0.6rem;
}

.btn-secondary {
  background: #eef2ff;
  color: #1f2937;
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
