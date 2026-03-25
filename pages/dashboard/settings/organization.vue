<template>
  <section class="space-y-6">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold">Настройки организации</h1>
      <p class="text-sm text-gray-600">Бренд, стиль и пресеты витрины ресторана.</p>
    </div>

    <div v-if="loading" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Загружаем текущий стиль...
    </div>
    <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <template v-else>
      <div v-if="isReadonly" class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Режим только чтение: изменение стиля и идентики доступно только Owner.
      </div>

      <div class="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
        <h2 class="md:col-span-2 text-sm font-semibold text-gray-900">Идентика</h2>
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Название ресторана</span>
          <input v-model="form.identity.name" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly">
        </label>
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Короткое описание (до 160)</span>
          <input v-model="form.identity.shortDescription" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly">
        </label>
        <label class="md:col-span-2 text-sm">
          <span class="mb-1 block text-gray-600">Полное описание (до 1000)</span>
          <textarea v-model="form.identity.fullDescription" rows="4" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly" />
        </label>
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Логотип URL</span>
          <input v-model="form.identity.logoUrl" class="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="https://..." :disabled="isReadonly">
        </label>
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Логотип для темной темы URL</span>
          <input v-model="form.identity.darkLogoUrl" class="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="https://..." :disabled="isReadonly">
        </label>
        <label class="md:col-span-2 text-sm">
          <span class="mb-1 block text-gray-600">Favicon URL</span>
          <input v-model="form.identity.faviconUrl" class="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="https://..." :disabled="isReadonly">
        </label>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <h2 class="text-sm font-semibold text-gray-900">Готовые пресеты</h2>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <button
            v-for="preset in presets"
            :key="preset.id"
            class="rounded-lg border p-3 text-left transition hover:border-gray-400"
            :class="preset.id === form.presetId ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'"
            :disabled="isReadonly"
            @click="applyPreset(preset.id)"
          >
            <div class="flex items-center justify-between">
              <strong class="text-sm">{{ preset.title }}</strong>
              <span class="text-xs text-gray-500">{{ preset.id === form.presetId ? 'Текущий' : 'Применить' }}</span>
            </div>
            <p class="mt-1 text-xs text-gray-600">{{ preset.mood }}</p>
            <div class="mt-2 flex gap-2">
              <span class="h-4 w-4 rounded-full border border-gray-200" :style="{ backgroundColor: preset.config.tokens.brandPrimary }" />
              <span class="h-4 w-4 rounded-full border border-gray-200" :style="{ backgroundColor: preset.config.tokens.brandSecondary }" />
              <span class="h-4 w-4 rounded-full border border-gray-200" :style="{ backgroundColor: preset.config.tokens.brandAccent }" />
            </div>
          </button>
        </div>
      </div>

      <div class="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
        <h2 class="md:col-span-2 text-sm font-semibold text-gray-900">Цвета бренда</h2>
        <label v-for="field in colorFields" :key="field.key" class="text-sm">
          <span class="mb-1 block text-gray-600">{{ field.label }}</span>
          <div class="flex items-center gap-2">
            <input
              v-model="form.tokens[field.key]"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs uppercase"
              :disabled="isReadonly"
              placeholder="#000000"
            >
            <span class="h-8 w-8 rounded border border-gray-300" :style="{ backgroundColor: safeColor(form.tokens[field.key]) }" />
          </div>
        </label>
      </div>

      <div class="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
        <h2 class="md:col-span-2 text-sm font-semibold text-gray-900">Скругления</h2>
        <label v-for="field in radiusFields" :key="field.key" class="text-sm">
          <span class="mb-1 block text-gray-600">{{ field.label }} (0-32)</span>
          <input
            v-model.number="form.radii[field.key]"
            type="number"
            min="0"
            max="32"
            class="w-full rounded-lg border border-gray-300 px-3 py-2"
            :disabled="isReadonly"
          >
        </label>
      </div>

      <div class="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
        <div>
          <h2 class="text-sm font-semibold text-gray-900">Предпросмотр</h2>
          <div class="mt-3 rounded-lg border border-gray-200 p-3" :style="{ backgroundColor: form.tokens.surfaceBackground, color: form.tokens.textPrimary }">
            <div class="rounded border p-3" :style="{ backgroundColor: form.tokens.surfaceCard, borderRadius: `${form.radii.card}px` }">
              <p class="text-sm font-semibold">{{ form.identity.name || 'Название ресторана' }}</p>
              <p class="mt-1 text-xs" :style="{ color: form.tokens.textMuted }">{{ form.identity.shortDescription || 'Короткое описание' }}</p>
              <button
                class="mt-3 px-3 py-1.5 text-sm text-white"
                :style="{ backgroundColor: form.tokens.brandPrimary, borderRadius: `${form.radii.button}px` }"
              >
                Кнопка
              </button>
            </div>
          </div>
          <p v-if="!isContrastOk" class="mt-2 text-xs text-amber-700">
            Предупреждение: контраст `textPrimary` к `surfaceBackground` может быть ниже AA.
          </p>
        </div>
        <div>
          <h2 class="text-sm font-semibold text-gray-900">Что изменилось</h2>
          <ul class="mt-2 space-y-1 text-sm">
            <li v-for="item in diffItems" :key="item" class="rounded bg-gray-50 px-2 py-1">{{ item }}</li>
            <li v-if="!diffItems.length" class="text-gray-500">Изменений нет</li>
          </ul>
        </div>
      </div>

      <div v-if="validationErrors.length" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <ul class="space-y-1">
          <li v-for="item in validationErrors" :key="item">{{ item }}</li>
        </ul>
      </div>

      <div class="flex flex-wrap gap-2">
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="isReadonly || saving" @click="resetForm">
          Отменить
        </button>
        <button class="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50" :disabled="isReadonly || saving || !!validationErrors.length" @click="save">
          {{ saving ? 'Сохраняем...' : 'Сохранить' }}
        </button>
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="isReadonly || saving || !hasRollback" @click="rollback">
          Вернуть предыдущий стиль
        </button>
      </div>

      <div v-if="successMessage" class="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
        {{ successMessage }}
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <h2 class="text-sm font-semibold text-gray-900">Audit log</h2>
        <ul class="mt-2 space-y-2 text-sm">
          <li v-for="(item, idx) in auditLog" :key="idx" class="flex items-start justify-between gap-3 border-b border-gray-100 pb-2">
            <span>{{ item.notes?.[0] || item.action }}</span>
            <span class="text-xs text-gray-500">{{ formatDate(item.at) }}</span>
          </li>
          <li v-if="!auditLog.length" class="text-gray-500">Пока нет записей.</li>
        </ul>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { $fetch } from 'ofetch'
import { useDashboardAccess } from '../../../composables/useDashboardAccess'
import type {
  OrganizationStyleAuditEntry,
  OrganizationStyleConfig,
  OrganizationStylePreset,
  OrganizationStyleResponse,
} from '../../../types/organization-style'

declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })

const { role, load } = useDashboardAccess()
const loading = ref(true)
const saving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const hasRollback = ref(false)
const presets = ref<OrganizationStylePreset[]>([])
const auditLog = ref<OrganizationStyleAuditEntry[]>([])
const originalConfig = ref<OrganizationStyleConfig | null>(null)

const form = reactive<OrganizationStyleConfig>({
  identity: {
    name: '',
    shortDescription: '',
    fullDescription: '',
    logoUrl: '',
    darkLogoUrl: '',
    faviconUrl: '',
  },
  tokens: {
    brandPrimary: '#000000',
    brandSecondary: '#000000',
    brandAccent: '#000000',
    surfaceBackground: '#FFFFFF',
    surfaceCard: '#FFFFFF',
    textPrimary: '#111111',
    textMuted: '#666666',
    stateSuccess: '#16A34A',
    stateWarning: '#D97706',
    stateError: '#DC2626',
  },
  radii: { button: 8, modal: 14, input: 8, card: 12 },
  presetId: null,
})

const colorFields = [
  { key: 'brandPrimary', label: 'brand.primary' },
  { key: 'brandSecondary', label: 'brand.secondary' },
  { key: 'brandAccent', label: 'brand.accent' },
  { key: 'surfaceBackground', label: 'surface.background' },
  { key: 'surfaceCard', label: 'surface.card' },
  { key: 'textPrimary', label: 'text.primary' },
  { key: 'textMuted', label: 'text.muted' },
  { key: 'stateSuccess', label: 'state.success' },
  { key: 'stateWarning', label: 'state.warning' },
  { key: 'stateError', label: 'state.error' },
] as const

const radiusFields = [
  { key: 'button', label: 'radius.button' },
  { key: 'modal', label: 'radius.modal' },
  { key: 'input', label: 'radius.input' },
  { key: 'card', label: 'radius.card' },
] as const

const isReadonly = computed(() => role.value !== 'owner')

const validationErrors = computed(() => {
  const result: string[] = []
  const name = form.identity.name.trim()
  if (name.length < 2 || name.length > 60) result.push('Название должно быть от 2 до 60 символов.')
  if (form.identity.shortDescription.trim().length > 160) result.push('Короткое описание не должно превышать 160 символов.')
  if (form.identity.fullDescription.trim().length > 1000) result.push('Полное описание не должно превышать 1000 символов.')
  for (const field of colorFields) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(form.tokens[field.key])) {
      result.push(`Поле ${field.label} должно быть в формате #RRGGBB.`)
    }
  }
  for (const field of radiusFields) {
    const value = Number(form.radii[field.key])
    if (!Number.isFinite(value) || value < 0 || value > 32) {
      result.push(`${field.label} должен быть в диапазоне 0-32.`)
    }
  }
  return result
})

const isContrastOk = computed(() => {
  const bg = hexToRgb(form.tokens.surfaceBackground)
  const text = hexToRgb(form.tokens.textPrimary)
  if (!bg || !text) return true
  const ratio = contrastRatio(bg, text)
  return ratio >= 4.5
})

const diffItems = computed(() => {
  if (!originalConfig.value) return []
  const baseline = originalConfig.value
  const items: string[] = []
  if (form.identity.name !== baseline.identity.name) items.push('Изменено название ресторана')
  if (form.identity.shortDescription !== baseline.identity.shortDescription) items.push('Изменено короткое описание')
  if (form.identity.fullDescription !== baseline.identity.fullDescription) items.push('Изменено полное описание')
  if (form.identity.logoUrl !== baseline.identity.logoUrl) items.push('Обновлен URL основного логотипа')
  for (const field of colorFields) {
    if (form.tokens[field.key] !== baseline.tokens[field.key]) items.push(`Изменен ${field.label}`)
  }
  for (const field of radiusFields) {
    if (form.radii[field.key] !== baseline.radii[field.key]) items.push(`Изменен ${field.label}`)
  }
  return items
})

function cloneConfig(config: OrganizationStyleConfig): OrganizationStyleConfig {
  return JSON.parse(JSON.stringify(config)) as OrganizationStyleConfig
}

function fillForm(config: OrganizationStyleConfig) {
  Object.assign(form.identity, config.identity)
  Object.assign(form.tokens, config.tokens)
  Object.assign(form.radii, config.radii)
  form.presetId = config.presetId
}

async function loadData() {
  loading.value = true
  errorMessage.value = ''
  try {
    await load()
    const [styleResponse, presetsResponse] = await Promise.all([
      $fetch<OrganizationStyleResponse>('/api/dashboard/organization/style'),
      $fetch<{ ok: true; items: OrganizationStylePreset[] }>('/api/dashboard/organization/style-presets'),
    ])
    presets.value = presetsResponse.items
    auditLog.value = styleResponse.auditLog
    hasRollback.value = styleResponse.hasRollback
    originalConfig.value = cloneConfig(styleResponse.data)
    fillForm(styleResponse.data)
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Не удалось загрузить настройки организации.'
  } finally {
    loading.value = false
  }
}

function applyPreset(presetId: string) {
  const preset = presets.value.find((item) => item.id === presetId)
  if (!preset) return
  Object.assign(form.tokens, preset.config.tokens)
  Object.assign(form.radii, preset.config.radii)
  form.presetId = preset.id
}

function resetForm() {
  successMessage.value = ''
  if (!originalConfig.value) return
  fillForm(originalConfig.value)
}

async function save() {
  if (isReadonly.value || validationErrors.value.length) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const response = await $fetch<OrganizationStyleResponse>('/api/dashboard/organization/style', {
      method: 'PUT',
      body: { data: cloneConfig(form) },
    })
    originalConfig.value = cloneConfig(response.data)
    fillForm(response.data)
    auditLog.value = response.auditLog
    hasRollback.value = response.hasRollback
    successMessage.value = 'Настройки сохранены.'
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Не удалось сохранить настройки.'
  } finally {
    saving.value = false
  }
}

async function rollback() {
  if (isReadonly.value || !hasRollback.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const response = await $fetch<OrganizationStyleResponse>('/api/dashboard/organization/style/rollback', {
      method: 'POST',
    })
    originalConfig.value = cloneConfig(response.data)
    fillForm(response.data)
    auditLog.value = response.auditLog
    hasRollback.value = response.hasRollback
    successMessage.value = 'Предыдущий стиль восстановлен.'
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Не удалось выполнить rollback.'
  } finally {
    saving.value = false
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

function safeColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#FFFFFF'
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function relativeLuminance(input: { r: number; g: number; b: number }) {
  const transform = (x: number) => {
    const value = x / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const r = transform(input.r)
  const g = transform(input.g)
  const b = transform(input.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

onMounted(loadData)
</script>
