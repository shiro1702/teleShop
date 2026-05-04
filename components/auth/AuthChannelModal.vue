<template>
  <Teleport to="body">
    <Transition name="auth-channel-modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[90] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <div class="absolute inset-0 bg-black/40" aria-hidden="true" @click="close" />
        <div
          class="modal-panel relative w-full max-w-sm rounded-2xl p-5 shadow-xl"
          :class="panelClass"
          :style="variant === 'dark' ? panelStyle : undefined"
        >
          <h3
            :id="titleId"
            class="text-base font-semibold"
            :class="variant === 'light' ? 'text-gray-900' : ''"
            :style="variant === 'dark' ? { color: mainTextColor } : undefined"
          >
            {{ title }}
          </h3>
          <p
            class="mt-1 text-sm"
            :class="variant === 'light' ? 'text-gray-600' : ''"
            :style="variant === 'dark' ? { color: mutedTextColor } : undefined"
          >
            {{ description }}
          </p>
          <fieldset v-if="channels.length" class="mt-4 space-y-2">
            <legend class="sr-only">Способ авторизации</legend>
            <label
              v-for="ch in channels"
              :key="ch"
              class="flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/35"
              :class="
                selectedChannel === ch
                  ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20'
                  : variant === 'dark'
                    ? 'border-white/15 bg-black/5 hover:border-white/25'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              "
            >
              <input
                v-model="selectedChannel"
                type="radio"
                :name="radioGroupName"
                :value="ch"
                class="sr-only"
              >
              <span
                class="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                :class="
                  selectedChannel === ch
                    ? variant === 'dark'
                      ? 'border-primary bg-primary/15'
                      : 'border-primary bg-white'
                    : variant === 'dark'
                      ? 'border-white/40 bg-black/10'
                      : 'border-gray-400 bg-white'
                "
                aria-hidden="true"
              >
                <span
                  class="rounded-full bg-primary transition-all duration-150 ease-out"
                  :class="
                    selectedChannel === ch ? 'h-2.5 w-2.5 scale-100 opacity-100' : 'h-2.5 w-2.5 scale-0 opacity-0'
                  "
                />
              </span>
              <span
                class="min-w-0 text-sm font-medium"
                :class="variant === 'light' ? 'text-gray-900' : ''"
                :style="variant === 'dark' ? { color: mainTextColor } : undefined"
              >{{ channelLabel(ch) }}</span>
            </label>
          </fieldset>
          <div class="mt-4">
            <AuthPdConsentCheckbox v-model="pdConsent" :variant="variant" :consent-href="consentHref" />
          </div>
          <div class="mt-4">
            <button
              type="button"
              class="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!pdConsent || !channels.length"
              @click="onSubmit"
            >
              {{ primaryButtonLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useTenant } from '~/composables/useTenant'
import type { AuthChannel } from '~/types/authChannel'

const props = withDefaults(
  defineProps<{
    /** Открыта ли модалка */
    modelValue: boolean
    title?: string
    description: string
    /** Доступные каналы (порядок = порядок радиокнопок) */
    channels: AuthChannel[]
    /** Текст основной кнопки */
    intent: 'login' | 'continue' | 'profile'
    variant?: 'light' | 'dark'
    consentHref: string
  }>(),
  {
    title: 'Выберите способ входа',
    variant: 'light',
  },
)

const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  submit: [channel: AuthChannel]
}>()

const { tenant } = useTenant()
const theme = computed(() => tenant.value.theme || {})
const mainTextColor = computed(() => theme.value.text_primary || 'var(--color-text-primary)')
const mutedTextColor = computed(() => theme.value.text_muted || 'var(--color-text-muted)')
const surfaceCardColor = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const borderColor = computed(() => theme.value.primary_100 || '#e5e7eb')

const panelStyle = computed(() => ({
  border: `1px solid ${borderColor.value}`,
  backgroundColor: surfaceCardColor.value,
  color: mainTextColor.value,
}))

const panelClass = computed(() =>
  props.variant === 'light' ? 'border border-gray-200 bg-white' : '',
)

const titleId = useId()
const radioGroupName = `auth-channel-${useId()}`

const pdConsent = ref(false)
const selectedChannel = ref<AuthChannel>('telegram')

function syncSelection() {
  const list = props.channels
  if (!list.length) return
  if (!list.includes(selectedChannel.value)) {
    selectedChannel.value = list[0]
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      pdConsent.value = false
      syncSelection()
    }
  },
)

watch(
  () => props.channels,
  () => syncSelection(),
  { deep: true },
)

const primaryButtonLabel = computed(() => {
  const ch = selectedChannel.value
  const intent = props.intent
  if (intent === 'continue') {
    if (ch === 'telegram') return 'Продолжить в Telegram'
    if (ch === 'max') return 'Продолжить в MAX'
    return 'Далее'
  }
  if (intent === 'profile') {
    if (ch === 'telegram') return 'Открыть Telegram'
    if (ch === 'max') return 'Открыть MAX'
    return 'Войти через ВКонтакте'
  }
  if (ch === 'vk') return 'Войти через ВКонтакте'
  if (ch === 'telegram') return 'Войти через Telegram'
  return 'Войти через MAX'
})

function channelLabel(ch: AuthChannel) {
  if (ch === 'telegram') return 'Telegram'
  if (ch === 'max') return 'MAX'
  return 'ВКонтакте'
}

function close() {
  emit('update:modelValue', false)
}

function onSubmit() {
  if (!pdConsent.value || !props.channels.length) return
  emit('submit', selectedChannel.value)
}
</script>

<style scoped>
.auth-channel-modal-fade-enter-active,
.auth-channel-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.auth-channel-modal-fade-enter-from,
.auth-channel-modal-fade-leave-to {
  opacity: 0;
}
.auth-channel-modal-fade-enter-active .modal-panel,
.auth-channel-modal-fade-leave-active .modal-panel {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.auth-channel-modal-fade-enter-from .modal-panel,
.auth-channel-modal-fade-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
</style>
