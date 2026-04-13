<template>
  <div class="min-h-screen" :style="pageStyle">
    <header class="border-b" :style="headerStyle">
      <div class="mx-auto grid max-w-6xl grid-cols-3 items-center gap-3 px-4 py-4 sm:px-6">
        <div class="flex w-24 items-center sm:w-32">
          <NuxtLink
            :to="tenantPath('/')"
            class="flex w-fit items-center gap-2 transition"
            :style="{ color: mutedTextColor }"
            aria-label="Назад к меню"
          >
            <span
              class="flex h-10 w-10 items-center justify-center rounded-lg"
              aria-hidden="true"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </span>
            <span class="hidden text-sm sm:inline">Меню</span>
          </NuxtLink>
        </div>

        <h1 class="text-center text-xl font-bold" :style="{ color: mainTextColor }">
          Бонусы
        </h1>
        <div />
      </div>
    </header>

    <main class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div v-if="!canViewBonuses" class="rounded-2xl border p-6" :style="cardStyle">
        <p class="text-sm" :style="{ color: mutedTextColor }">
          Откройте мини-приложение из бота или войдите на сайте, чтобы видеть баланс бонусов в этом ресторане.
        </p>
      </div>

      <template v-else>
        <div class="rounded-2xl border p-6 sm:p-8" :style="cardStyle">
          <p v-if="tenantLoading" class="text-sm" :style="{ color: mutedTextColor }">
            Загрузка…
          </p>
          <template v-else-if="shopId">
            <p class="text-sm" :style="{ color: mutedTextColor }">
              {{ shopDisplayName }}
            </p>
            <p class="mt-3 text-3xl font-bold tabular-nums" :style="{ color: mainTextColor }">
              {{ balanceDisplay }} б
            </p>
            <p class="mt-2 text-sm" :style="{ color: mutedTextColor }">
              1 бонус = 1 б. Начисляются после успешной доставки или выдачи заказа. Списать бонусы можно при оформлении заказа.
            </p>
          </template>
          <p v-else class="text-sm" :style="{ color: mutedTextColor }">
            Не удалось определить ресторан. Откройте эту страницу из витрины ресторана.
          </p>
        </div>

        <p v-if="!isMessengerMiniApp" class="mt-6 text-center text-sm">
          <NuxtLink
            to="/profile"
            class="font-medium underline decoration-dotted underline-offset-2"
            :style="{ color: mainTextColor }"
          >
            Все рестораны с бонусами — в профиле
          </NuxtLink>
        </p>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSupabaseUser } from '#imports'
import { useTenant } from '~/composables/useTenant'
import { useTelegram } from '~/composables/useTelegram'

const user = useSupabaseUser()
const { tenant, tenantPath } = useTenant()
const { isMessengerMiniApp, messengerInitData, buildMessengerAuthHeaders } = useTelegram()

/** Сайт: Supabase. Mini App (Telegram / MAX): сессия через initData (без отдельного «ЛК») */
const canViewBonuses = computed(
  () => !!user.value || (!!isMessengerMiniApp.value && !!messengerInitData.value),
)

const theme = computed(() => tenant.value.theme || {})
const pageBgColor = computed(() => theme.value.surface_background || 'var(--color-surface-bg)')
const cardBgColor = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const mainTextColor = computed(() => theme.value.text_primary || 'var(--color-text-primary)')
const mutedTextColor = computed(() => theme.value.text_muted || 'var(--color-text-muted)')
const borderColor = computed(() => theme.value.primary_100 || '#e5e7eb')

const pageStyle = computed(() => ({
  backgroundColor: pageBgColor.value,
  color: mainTextColor.value,
}))

const headerStyle = computed(() => ({
  borderColor: borderColor.value,
  backgroundColor: cardBgColor.value,
}))

const cardStyle = computed(() => ({
  border: `1px solid ${borderColor.value}`,
  backgroundColor: cardBgColor.value,
  color: mainTextColor.value,
}))

const tenantLoading = computed(() => tenant.value.loading && !tenant.value.loaded)
const shopId = computed(() => tenant.value.shopId)
const shopDisplayName = computed(() => tenant.value.shopName || 'Ресторан')

const balance = ref<number | null>(null)
const balanceLoading = ref(false)

const balanceDisplay = computed(() => {
  if (balanceLoading.value) return '…'
  if (balance.value === null) return '0'
  return String(balance.value)
})

function balanceRequestHeaders() {
  return buildMessengerAuthHeaders(shopId.value ? { 'x-shop-id': shopId.value } : undefined)
}

async function loadBalance() {
  if (!shopId.value || !canViewBonuses.value) {
    balance.value = null
    return
  }
  balanceLoading.value = true
  try {
    const res = await $fetch<{ ok: boolean; balance: number }>('/api/loyalty/balance', {
      headers: balanceRequestHeaders(),
    })
    balance.value = res.balance
  } catch {
    balance.value = null
  } finally {
    balanceLoading.value = false
  }
}

watch(
  [user, shopId, canViewBonuses, isMessengerMiniApp, () => (isMessengerMiniApp.value ? messengerInitData.value : '')],
  () => {
    void loadBalance()
  },
  { immediate: true },
)
</script>
