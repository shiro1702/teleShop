<template>
  <div
    class="text-left"
    :class="wrapClass"
    role="group"
    :aria-label="ariaLabel"
  >
    <div class="flex gap-3">
      <input
        :id="inputId"
        v-model="model"
        type="checkbox"
        class="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-2"
        :class="checkboxClass"
      >
      <label :for="inputId" class="min-w-0 cursor-pointer text-sm leading-snug">
        <span class="block font-medium text-[color:var(--color-text-primary)]">Согласие на обработку персональных данных</span>
        <span class="mt-1 block text-xs leading-relaxed text-[color:var(--color-text-muted)]">
          Я согласен(на) на
          <NuxtLink
            :to="consentHref"
            target="_blank"
            rel="noopener noreferrer"
            class="underline decoration-dotted underline-offset-2 text-primary hover:opacity-90"
            @click.stop
          >
            обработку персональных данных
          </NuxtLink>
          (текст откроется в новой вкладке).
        </span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const model = defineModel<boolean>({ default: false })

const props = defineProps<{
  consentHref: string
  /** Тёмная панель (модалка шапки) vs светлая (checkout, профиль) */
  variant: 'dark' | 'light'
}>()

const inputId = useId()

const ariaLabel = 'Согласие на обработку персональных данных для входа'

const wrapClass = computed(() =>
  props.variant === 'dark'
    ? 'rounded-xl border border-[color:var(--color-primary-100)] bg-[color:var(--color-surface-card)] p-3.5 shadow-sm'
    : 'rounded-lg border border-gray-200 bg-gray-50/80 p-3.5',
)

const checkboxClass = computed(() =>
  props.variant === 'dark'
    ? 'border-[color:var(--color-text-muted)]/45 bg-[color:var(--color-surface-bg)] accent-[var(--color-primary)] checked:border-primary checked:bg-primary/15'
    : 'border-gray-400 bg-white accent-[var(--color-primary)] checked:border-primary',
)
</script>
