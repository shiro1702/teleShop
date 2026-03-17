<template>
  <nav
    class="mb-6 flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs sm:text-sm"
    aria-label="Шаги оформления заказа"
  >
    <div
      v-for="step in steps"
      :key="step.id"
      class="flex flex-1 items-center"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold sm:h-7 sm:w-7 sm:text-xs"
          :class="stepCircleClass(step.id)"
        >
          {{ step.id }}
        </div>
        <div class="flex flex-col">
          <span
            class="font-medium"
            :class="stepLabelClass(step.id)"
          >
            {{ step.title }}
          </span>
          <span class="hidden text-[11px] text-gray-400 sm:block">
            {{ step.subtitle }}
          </span>
        </div>
      </div>

      <div
        v-if="step.id !== steps.length"
        class="mx-2 hidden flex-1 items-center sm:flex"
      >
        <div
          class="h-px w-full"
          :class="connectorClass(step.id + 1)"
        />
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
const props = defineProps<{
  currentStep: 1 | 2 | 3
}>()

const steps = [
  {
    id: 1,
    title: 'Корзина',
    subtitle: 'Проверьте состав заказа',
  },
  {
    id: 2,
    title: 'Доставка',
    subtitle: 'Адрес и стоимость доставки',
  },
  {
    id: 3,
    title: 'Оплата',
    subtitle: 'Способ оплаты и итог',
  },
] as const

function stepCircleClass(id: number) {
  if (id === props.currentStep) {
    return 'border-[#2563eb] bg-[#2563eb] text-white'
  }
  if (id < props.currentStep) {
    return 'border-emerald-500 bg-emerald-50 text-emerald-600'
  }
  return 'border-gray-300 bg-gray-50 text-gray-400'
}

function stepLabelClass(id: number) {
  if (id === props.currentStep) {
    return 'text-gray-900'
  }
  if (id < props.currentStep) {
    return 'text-emerald-700'
  }
  return 'text-gray-400'
}

function connectorClass(id: number) {
  if (id <= props.currentStep) {
    return 'bg-[#2563eb]'
  }
  return 'bg-gray-200'
}
</script>

