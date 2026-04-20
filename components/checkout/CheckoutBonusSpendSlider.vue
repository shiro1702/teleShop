<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <span :style="{ color: mutedTextColor }">{{ label }}</span>
      <span class="font-medium" :style="{ color: mainTextColor }">
        {{ normalizedValue }} / {{ normalizedMax }}
      </span>
    </div>

    <div class="bonus-slider-hit-area">
      <input
        :value="normalizedValue"
        type="range"
        min="0"
        :max="normalizedMax"
        step="1"
        :disabled="disabled || normalizedMax === 0"
        class="bonus-slider-input w-full cursor-pointer"
        :style="sliderStyle"
        :aria-label="label"
        :aria-valuemin="0"
        :aria-valuemax="normalizedMax"
        :aria-valuenow="normalizedValue"
        :aria-valuetext="ariaValueText"
        @input="onInput"
        @change="onCommit"
      >
    </div>

    <p class="text-xs" :style="{ color: mutedTextColor }">
      Можно списать до {{ normalizedMax }} бонусов (с учетом лимита заказа и вашего баланса).
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  max: number
  disabled?: boolean
  label?: string
  primaryColor?: string
  mutedTextColor?: string
  mainTextColor?: string
}>(), {
  disabled: false,
  label: 'Списать бонусов',
  primaryColor: 'var(--color-primary)',
  mutedTextColor: 'var(--color-text-muted)',
  mainTextColor: 'var(--color-text-primary)',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'commit'): void
}>()

const normalizedMax = computed(() => {
  const next = Number.isFinite(props.max) ? Math.floor(props.max) : 0
  return Math.max(0, next)
})

const normalizedValue = computed(() => {
  const next = Number.isFinite(props.modelValue) ? Math.floor(props.modelValue) : 0
  return Math.max(0, Math.min(next, normalizedMax.value))
})

const progressPercent = computed(() => {
  if (normalizedMax.value <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((normalizedValue.value / normalizedMax.value) * 100)))
})

const ariaValueText = computed(() => `${normalizedValue.value} бонусов из ${normalizedMax.value}`)

const sliderStyle = computed(() => ({
  '--bonus-slider-progress': `${progressPercent.value}%`,
  '--bonus-slider-primary': props.primaryColor,
}))

function parseInputValue(raw: string): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(Math.floor(parsed), normalizedMax.value))
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  emit('update:modelValue', parseInputValue(target?.value || '0'))
}

function onCommit() {
  emit('commit')
}
</script>

<style scoped>
.bonus-slider-hit-area {
  display: flex;
  align-items: center;
  min-height: 44px;
}

.bonus-slider-input {
  appearance: none;
  -webkit-appearance: none;
  height: 8px;
  border-radius: 9999px;
  background: linear-gradient(
    to right,
    var(--bonus-slider-primary) 0%,
    var(--bonus-slider-primary) var(--bonus-slider-progress),
    rgba(148, 163, 184, 0.35) var(--bonus-slider-progress),
    rgba(148, 163, 184, 0.35) 100%
  );
}

.bonus-slider-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.bonus-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  border: 2px solid #ffffff;
  background: var(--bonus-slider-primary);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.25);
}

.bonus-slider-input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  border: 2px solid #ffffff;
  background: var(--bonus-slider-primary);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.25);
}
</style>
