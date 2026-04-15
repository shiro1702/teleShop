<template>
  <Teleport to="body">
    <Transition name="cart">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[70] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="absolute inset-0 bg-black/50" @click="$emit('update:modelValue', false)" />
        <div class="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5" @click.stop>
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-base font-semibold text-gray-900">Адрес доставки</h3>
            <button type="button" class="text-sm text-gray-500 hover:text-gray-800" @click="$emit('update:modelValue', false)">Закрыть</button>
          </div>

          <div class="relative z-10 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-sm font-medium transition"
              :class="activeTab === 'saved' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
              @click="activeTab = 'saved'"
            >
              Сохраненные
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-sm font-medium transition"
              :class="activeTab === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
              @click="activeTab = 'new'"
            >
              Новый адрес
            </button>
          </div>

          <div v-if="activeTab === 'saved'" class="relative z-10 mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p class="text-xs font-medium text-gray-500">Ранее введенные адреса</p>
            <div v-if="addresses.length" class="flex flex-wrap gap-2">
              <button
                v-for="addr in addresses"
                :key="addr.id"
                type="button"
                class="rounded-full border px-3 py-1.5 text-sm"
                :class="addr.id === selectedAddressId ? 'border-primary bg-primary-50 text-gray-900' : 'border-gray-200 bg-white text-gray-700 hover:border-primary'"
                @click="$emit('pick-address', addr.id)"
              >
                {{ addr.address }}
              </button>
            </div>
            <p v-else class="text-sm text-gray-500">
              Пока нет сохраненных адресов.
            </p>
          </div>

          <div v-else class="relative z-10 mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p class="mb-2 text-xs font-medium text-gray-500">Новый адрес</p>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div class="relative sm:col-span-2">
                <input
                  :value="addressLine"
                  type="text"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  placeholder="Улан-Удэ, улица, дом"
                  @input="onAddressInput"
                />
                <div
                  v-if="isSuggestLoading"
                  class="pointer-events-none absolute inset-y-0 right-2 flex items-center"
                >
                  <svg
                    class="h-4 w-4 animate-spin text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    />
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                </div>
                <div
                  v-if="suggestItems.length"
                  class="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                >
                  <button
                    v-for="item in suggestItems"
                    :key="item.value"
                    type="button"
                    class="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-800 transition hover:bg-gray-50"
                    @click="emit('pick-suggestion', item)"
                  >
                    <span class="truncate">
                      {{ item.displayName }}
                    </span>
                  </button>
                </div>
              </div>
              <input
                :value="flat"
                type="text"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                placeholder="Квартира / подъезд"
                @input="onFlatInput"
              />
            </div>
            <textarea
              :value="comment"
              rows="2"
              class="mt-2 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              placeholder="Комментарий курьеру"
              @input="onCommentInput"
            />
            <button type="button" class="mt-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary" @click="$emit('save-new')">
              Сохранить адрес
            </button>
          </div>

          <div class="relative z-0 mt-3">
            <p class="mb-2 text-xs font-medium text-gray-500">Филиалы и зоны доставки</p>
            <CheckoutDeliveryBranchesMap
              :branches="branches"
              :all-zones="allZones"
              :selected-branch-id="selectedBranchId"
              :allow-manual-select="allowManualBranchSelect"
              :client-lat="clientLat"
              :client-lon="clientLon"
              :client-address="clientAddress"
              @select-branch="$emit('select-branch', $event)"
            />
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { DeliveryZoneFeature } from '~/utils/deliveryZones'
import type { DadataSuggestItem } from '~/utils/dadataApi'

type SavedAddress = {
  id: string
  address: string
}

type BranchItem = {
  id: string
  name: string
  address: string
  lat?: number | null
  lon?: number | null
}

const props = defineProps<{
  modelValue: boolean
  addresses: SavedAddress[]
  initialTab?: 'saved' | 'new'
  selectedAddressId: string
  addressLine: string
  flat: string
  comment: string
  branches: BranchItem[]
  allZones: Record<string, DeliveryZoneFeature[]>
  selectedBranchId: string
  allowManualBranchSelect: boolean
  suggestItems: DadataSuggestItem[]
  isSuggestLoading: boolean
  clientLat?: number | null
  clientLon?: number | null
  clientAddress?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'pick-address': [addressId: string]
  'save-new': []
  'update:addressLine': [value: string]
  'update:flat': [value: string]
  'update:comment': [value: string]
  'select-branch': [branchId: string]
  'address-input': []
  'pick-suggestion': [item: DadataSuggestItem]
}>()
const activeTab = ref<'saved' | 'new'>('saved')

watch(
  () => props.modelValue,
  (opened: boolean) => {
    if (!opened) return
    if (props.initialTab) {
      activeTab.value = props.initialTab
      return
    }
    activeTab.value = props.addresses.length ? 'saved' : 'new'
  },
  { immediate: true },
)

function onAddressInput(event: Event) {
  const value = (event.target as HTMLInputElement | null)?.value ?? ''
  emit('update:addressLine', value)
  emit('address-input')
}

function onFlatInput(event: Event) {
  const value = (event.target as HTMLInputElement | null)?.value ?? ''
  emit('update:flat', value)
}

function onCommentInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
  emit('update:comment', value)
}
</script>
