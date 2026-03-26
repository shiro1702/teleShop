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
        Режим только чтение: изменение стиля и айдентики доступно только Owner.
      </div>

      <div class="flex flex-wrap gap-2">
        <button class="rounded border px-3 py-1.5 text-sm" :class="activeMainTab === 'identity' ? 'border-blue-400 bg-blue-50' : 'border-gray-300'" @click="activeMainTab = 'identity'">
          Айдентика
        </button>
        <button class="rounded border px-3 py-1.5 text-sm" :class="activeMainTab === 'contacts' ? 'border-blue-400 bg-blue-50' : 'border-gray-300'" @click="activeMainTab = 'contacts'">
          Контакты и операционные настройки
        </button>
        <button class="rounded border px-3 py-1.5 text-sm" :class="activeMainTab === 'styles' ? 'border-blue-400 bg-blue-50' : 'border-gray-300'" @click="activeMainTab = 'styles'">
          Стили
        </button>
      </div>

      <div v-if="activeMainTab === 'identity'" class="space-y-4">
      <div class="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
        <h2 class="md:col-span-2 text-sm font-semibold text-gray-900">Айдентика</h2>
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Slug</span>
          <input v-model="settings.slug" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly">
        </label>
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Публичное название</span>
          <input v-model="settings.displayName" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly">
        </label>
        <label class="md:col-span-2 text-sm">
          <span class="mb-1 block text-gray-600">Короткий слоган под названием</span>
          <input v-model="settings.tagline" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly">
          <span class="mt-1 block text-xs text-gray-500">Показывается под названием ресторана в карточке и на витрине.</span>
        </label>
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Категория кухни</span>
          <div class="rounded-lg border border-gray-300 p-2">
            <div class="mb-2 flex flex-wrap gap-1.5" v-if="selectedCuisineTags.length">
              <span
                v-for="tag in selectedCuisineTags"
                :key="tag"
                class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
              >
                {{ tag }}
                <button
                  type="button"
                  class="text-gray-500 hover:text-gray-700"
                  :disabled="isReadonly"
                  @click="removeCuisineTag(tag)"
                >
                  x
                </button>
              </span>
            </div>
            <input
              v-model="cuisineSearch"
              class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              :disabled="isReadonly"
              placeholder="Поиск тега кухни..."
              @keydown.enter.prevent="addCuisineTagFromInput"
            >
            <div class="mt-2 flex flex-wrap gap-1.5">
              <button
                v-for="tag in filteredCuisineSuggestions"
                :key="tag"
                type="button"
                class="rounded-full border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                :disabled="isReadonly"
                @click="addCuisineTag(tag)"
              >
                {{ tag }}
              </button>
              <button
                v-if="canAddCuisineTag"
                type="button"
                class="rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                :disabled="isReadonly"
                @click="addCuisineTagFromInput"
              >
                Добавить "{{ normalizedCuisineSearch }}"
              </button>
            </div>
          </div>
        </label>
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
        <div class="md:col-span-2 grid gap-3 md:grid-cols-2">
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Логотип</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" :disabled="isReadonly || saving" @change="onFileChange($event, 'logo')">
            <p class="mt-1 text-xs text-gray-500">PNG/SVG/WebP, до 2MB, минимум 256x256.</p>
            <img v-if="form.identity.logoUrl" :src="form.identity.logoUrl" alt="logo" class="mt-2 h-14 w-14 rounded object-cover">
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Favicon</span>
            <input type="file" accept="image/png,image/x-icon,image/svg+xml" :disabled="isReadonly || saving" @change="onFileChange($event, 'favicon')">
            <img v-if="form.identity.faviconUrl" :src="form.identity.faviconUrl" alt="favicon" class="mt-2 h-10 w-10 rounded object-cover">
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Картинка карточки ресторана</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" :disabled="isReadonly || saving" @change="onFileChange($event, 'restaurant-card')">
            <img v-if="form.identity.restaurantCardImageUrl" :src="form.identity.restaurantCardImageUrl" alt="restaurant card" class="mt-2 h-16 w-full rounded object-cover">
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Hero image</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" :disabled="isReadonly || saving" @change="onFileChange($event, 'hero')">
            <img v-if="form.identity.heroImageUrl" :src="form.identity.heroImageUrl" alt="hero" class="mt-2 h-16 w-full rounded object-cover">
          </label>
        </div>
      </div>
      <div class="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
        <div>
          <h2 class="text-sm font-semibold text-gray-900">Предпросмотр в агрегаторе</h2>
          <div class="mt-3 rounded-lg border border-gray-200 p-3" :style="{ backgroundColor: form.tokens.surfaceBackground }">
            <OrganizationRestaurantPreviewCard
              :display-name="settings.displayName || form.identity.name"
              :tagline="settings.tagline"
              :description="form.identity.shortDescription"
              :logo-url="form.identity.logoUrl"
              :hero-image-url="form.identity.restaurantCardImageUrl || form.identity.heroImageUrl"
              :style-config="{ tokens: form.tokens, radii: form.radii }"
            />
          </div>
        </div>
        <div>
          <h2 class="text-sm font-semibold text-gray-900">Предпросмотр своей страницы</h2>
          <div class="mt-3 rounded-lg border border-gray-200 p-3" :style="{ backgroundColor: form.tokens.surfaceBackground, color: form.tokens.textPrimary }">
            <div class="rounded border p-3" :style="{ backgroundColor: form.tokens.surfaceCard, borderRadius: `${form.radii.card}px` }">
              <p class="text-sm font-semibold">{{ settings.displayName || form.identity.name || 'Название ресторана' }}</p>
              <p class="mt-1 text-xs" :style="{ color: form.tokens.textMuted }">{{ form.identity.shortDescription || 'Короткое описание' }}</p>
              <button class="mt-3 px-3 py-1.5 text-sm text-white" :style="{ backgroundColor: form.tokens.brandPrimary, borderRadius: `${form.radii.button}px` }">Открыть меню</button>
            </div>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50" :disabled="isReadonly || saving || !!validationErrors.length" @click="save('Айдентика сохранена.')">
          {{ saving ? 'Сохраняем...' : 'Сохранить айдентику' }}
        </button>
      </div>
      </div>

      <div v-if="activeMainTab === 'contacts'" class="space-y-4">
      <div class="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
        <h2 class="md:col-span-2 text-sm font-semibold text-gray-900">Контакты и операционные настройки</h2>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Телефон</span><input v-model="settings.contacts.phone" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly"></label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Email</span><input v-model="settings.contacts.email" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly"></label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">MAX</span><input v-model="settings.contacts.max" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly"></label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Telegram</span><input v-model="settings.contacts.telegram" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly"></label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Статус</span>
          <select v-model="settings.ops.status" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly">
            <option value="open">Открыт</option><option value="closed">Закрыт</option><option value="coming_soon">Скоро открытие</option><option value="temporarily_unavailable">Временно недоступен</option>
          </select>
        </label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Минимальный заказ</span><input v-model.number="settings.ops.minOrderAmount" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly"></label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Время приготовления (мин)</span><input v-model.number="settings.ops.prepTimeMinutes" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly"></label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Стоимость доставки</span><input v-model.number="settings.ops.deliveryFee" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly"></label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Бесплатная доставка от</span><input v-model.number="settings.ops.freeDeliveryFrom" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly"></label>
        <div class="md:col-span-2 rounded-lg border border-gray-200 p-3">
          <p class="text-sm font-medium text-gray-700">Способы работы ресторана</p>
          <p class="mt-1 text-xs text-gray-500">
            Здесь задаются общие режимы работы ресторана. На уровне филиала можно включить/выключить режимы отдельно - филиальные настройки перебивают эти правила.
          </p>
          <div class="mt-3 grid gap-2 md:grid-cols-2">
            <label v-for="option in fulfillmentOptions" :key="option.value" class="flex items-start gap-2 rounded border border-gray-200 p-2">
              <input
                type="checkbox"
                class="mt-0.5"
                :checked="settings.ops.fulfillmentTypes.includes(option.value)"
                :disabled="isReadonly"
                @change="onFulfillmentCheckboxChange($event, option.value)"
              >
              <span>
                <span class="block text-sm text-gray-700">{{ option.label }}</span>
                <span class="block text-xs text-gray-500">{{ option.description }}</span>
              </span>
            </label>
          </div>
        </div>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Принятие заказов</span>
          <select v-model="settings.ops.orderAcceptanceMode" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly">
            <option value="manual">Ручное</option><option value="auto">Автоматическое</option>
          </select>
        </label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Валюта</span><input v-model="settings.locale.currency" class="w-full rounded-lg border border-gray-300 px-3 py-2 uppercase" :disabled="isReadonly"></label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Часовой пояс</span><input v-model="settings.locale.timezone" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly"></label>
        <label class="text-sm"><span class="mb-1 block text-gray-600">Налоговый режим (РФ)</span>
          <select v-model="settings.tax.vatMode" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="isReadonly">
            <option value="none">Без НДС</option><option value="included">НДС включен в цену</option><option value="excluded">НДС начисляется сверху</option>
          </select>
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50" :disabled="isReadonly || saving || !!validationErrors.length" @click="save('Контакты и операционные настройки сохранены.')">
          {{ saving ? 'Сохраняем...' : 'Сохранить контакты и операционные настройки' }}
        </button>
      </div>
      </div>

      <template v-if="activeMainTab === 'styles'">
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
            <p v-if="preset.isSystem === false" class="mt-1 text-[11px] text-violet-600">Пользовательский</p>
            <div class="mt-2 flex gap-2">
              <span class="h-4 w-4 rounded-full border border-gray-200" :style="{ backgroundColor: preset.config.tokens.brandPrimary }" />
              <span class="h-4 w-4 rounded-full border border-gray-200" :style="{ backgroundColor: preset.config.tokens.brandSecondary }" />
              <span class="h-4 w-4 rounded-full border border-gray-200" :style="{ backgroundColor: preset.config.tokens.brandAccent }" />
            </div>
          </button>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <input v-model="newPresetTitle" class="w-64 rounded border border-gray-300 px-3 py-1.5 text-sm" placeholder="Название нового пресета" :disabled="isReadonly || saving">
          <input v-model="newPresetMood" class="w-64 rounded border border-gray-300 px-3 py-1.5 text-sm" placeholder="Настроение пресета" :disabled="isReadonly || saving">
          <button class="rounded border border-violet-400 bg-violet-600 px-3 py-1.5 text-sm text-white disabled:opacity-50" :disabled="isReadonly || saving || !newPresetTitle.trim()" @click="savePreset">
            Сохранить как новый пресет
          </button>
        </div>
      </div>

      <div class="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
        <h2 class="md:col-span-2 text-sm font-semibold text-gray-900">Цвета бренда</h2>
        <label v-for="field in colorFields" :key="field.key" class="text-sm">
          <span class="mb-1 block text-gray-600">{{ field.label }}</span>
          <div class="flex items-center gap-2">
            <input
              type="color"
              :value="safeColor(form.tokens[field.key])"
              class="h-9 w-11 cursor-pointer rounded border border-gray-300 bg-white p-1 disabled:cursor-not-allowed"
              :disabled="isReadonly"
              @input="onColorInput($event, field.key)"
            >
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
          <h2 class="text-sm font-semibold text-gray-900">Предпросмотр стилей</h2>
          <div class="mt-3 rounded-lg border border-gray-200 p-3" :style="{ backgroundColor: form.tokens.surfaceBackground, color: form.tokens.textPrimary }">
            <OrganizationProductPreviewCard
              title="Паста с трюфельным соусом"
              description="Товарное превью с текущими цветами и скруглениями."
              :image-url="form.identity.heroImageUrl"
              :price="490"
              :style-config="{ tokens: form.tokens, radii: form.radii }"
            />
            <div class="mt-3 rounded border p-3" :style="{ backgroundColor: form.tokens.surfaceCard, borderRadius: `${form.radii.modal}px` }">
              <p class="text-sm font-semibold">Кнопки</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button class="px-3 py-1.5 text-xs text-white" :style="{ backgroundColor: form.tokens.brandPrimary, borderRadius: `${form.radii.button}px` }">Primary</button>
                <button class="px-3 py-1.5 text-xs" :style="{ backgroundColor: form.tokens.brandSecondary, color: form.tokens.textPrimary, borderRadius: `${form.radii.button}px` }">Secondary</button>
                <button class="px-3 py-1.5 text-xs text-white" :style="{ backgroundColor: form.tokens.brandAccent, borderRadius: `${form.radii.button}px` }">Accent</button>
              </div>
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
      <div class="flex flex-wrap gap-2">
        <button class="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50" :disabled="isReadonly || saving || !!validationErrors.length" @click="save('Стили сохранены.')">
          {{ saving ? 'Сохраняем...' : 'Сохранить стили' }}
        </button>
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="isReadonly || saving || !hasRollback" @click="rollback">
          Вернуть предыдущий стиль
        </button>
      </div>
      </template>

      <div v-if="validationErrors.length" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <ul class="space-y-1">
          <li v-for="item in validationErrors" :key="item">{{ item }}</li>
        </ul>
      </div>

      <div class="flex flex-wrap gap-2">
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="isReadonly || saving" @click="resetForm">
          Отменить несохраненные изменения
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { $fetch } from 'ofetch'
import { useDashboardAccess } from '../../../composables/useDashboardAccess'
import type {
  OrganizationSettings,
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
const originalSettings = ref<OrganizationSettings | null>(null)
const newPresetTitle = ref('')
const newPresetMood = ref('')
const activeMainTab = ref<'identity' | 'contacts' | 'styles'>('identity')

const form = reactive<OrganizationStyleConfig>({
  identity: {
    name: '',
    shortDescription: '',
    fullDescription: '',
    logoUrl: '',
    faviconUrl: '',
    restaurantCardImageUrl: '',
    heroImageUrl: '',
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

const settings = reactive<OrganizationSettings>({
  slug: '',
  displayName: '',
  tagline: '',
  cuisine: '',
  contacts: {
    phone: '',
    max: '',
    telegram: '',
    email: '',
  },
  ops: {
    status: 'open',
    minOrderAmount: 500,
    prepTimeMinutes: 30,
    deliveryFee: 150,
    freeDeliveryFrom: 1000,
    fulfillmentTypes: ['delivery', 'pickup'],
    orderAcceptanceMode: 'manual',
    ordersPaused: false,
    ordersPausedReason: '',
  },
  locale: {
    currency: 'RUB',
    timezone: 'Asia/Irkutsk',
    languages: ['ru'],
  },
  tax: {
    vatMode: 'none',
  },
})
const languagesRaw = ref('ru')
const cuisineSearch = ref('')
const selectedCuisineTags = ref<string[]>([])
const defaultCuisineSuggestions = [
  'Итальянская',
  'Японская',
  'Китайская',
  'Грузинская',
  'Корейская',
  'Европейская',
  'Веганская',
  'Стрит-фуд',
  'Пицца',
  'Бургеры',
  'Суши',
  'Кофейня',
]
const fulfillmentOptions: Array<{
  value: 'delivery' | 'pickup' | 'dine-in' | 'qr-menu' | 'showcase-order'
  label: string
  description: string
}> = [
  { value: 'delivery', label: 'Доставка', description: 'Заказ с доставкой по адресу клиента.' },
  { value: 'pickup', label: 'Самовывоз', description: 'Клиент оформляет и забирает заказ сам.' },
  { value: 'dine-in', label: 'В зале', description: 'Заказ для гостей внутри ресторана.' },
  { value: 'qr-menu', label: 'QR-меню', description: 'Гость сканирует QR, открывает меню и делает заказ с телефона.' },
  { value: 'showcase-order', label: 'Витрина + к столу', description: 'Гость выбирает и оплачивает в витрине, заказ приносят сразу к столу.' },
]

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
const normalizedCuisineSearch = computed(() => cuisineSearch.value.trim())
const filteredCuisineSuggestions = computed(() => {
  const query = normalizedCuisineSearch.value.toLowerCase()
  return defaultCuisineSuggestions
    .filter((tag) => !selectedCuisineTags.value.includes(tag))
    .filter((tag) => !query || tag.toLowerCase().includes(query))
    .slice(0, 8)
})
const canAddCuisineTag = computed(() => {
  const tag = normalizedCuisineSearch.value
  if (!tag) return false
  return !selectedCuisineTags.value.some((item) => item.toLowerCase() === tag.toLowerCase())
})

const validationErrors = computed(() => {
  const result: string[] = []
  const name = form.identity.name.trim()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(settings.slug.trim().toLowerCase())) result.push('Slug должен быть в формате lowercase-kebab-case.')
  if (settings.displayName.trim().length < 2 || settings.displayName.trim().length > 60) result.push('Публичное название должно быть от 2 до 60 символов.')
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
  if (settings.contacts.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contacts.email)) {
    result.push('Некорректный email контакта.')
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
  if (form.identity.faviconUrl !== baseline.identity.faviconUrl) items.push('Обновлен favicon')
  if (form.identity.restaurantCardImageUrl !== baseline.identity.restaurantCardImageUrl) items.push('Обновлена картинка карточки ресторана')
  if (form.identity.heroImageUrl !== baseline.identity.heroImageUrl) items.push('Обновлен hero image')
  if (originalSettings.value && settings.slug !== originalSettings.value.slug) items.push('Изменен slug')
  if (originalSettings.value && settings.displayName !== originalSettings.value.displayName) items.push('Изменено публичное название')
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

function cloneSettings(input: OrganizationSettings): OrganizationSettings {
  return JSON.parse(JSON.stringify(input)) as OrganizationSettings
}

function fillForm(config: OrganizationStyleConfig) {
  Object.assign(form.identity, config.identity)
  Object.assign(form.tokens, config.tokens)
  Object.assign(form.radii, config.radii)
  form.presetId = config.presetId
}

function fillSettings(next: OrganizationSettings) {
  settings.slug = next.slug
  settings.displayName = next.displayName
  settings.tagline = next.tagline
  settings.cuisine = next.cuisine
  selectedCuisineTags.value = next.cuisine
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  Object.assign(settings.contacts, next.contacts)
  Object.assign(settings.ops, next.ops)
  Object.assign(settings.locale, next.locale)
  Object.assign(settings.tax, next.tax)
  languagesRaw.value = next.locale.languages.join(',')
  settings.ops.minOrderAmount = next.ops.minOrderAmount ?? 500
  settings.ops.prepTimeMinutes = next.ops.prepTimeMinutes ?? 30
  settings.ops.deliveryFee = next.ops.deliveryFee ?? 150
  settings.ops.freeDeliveryFrom = next.ops.freeDeliveryFrom ?? 1000
}

function syncCuisineToSettings() {
  settings.cuisine = selectedCuisineTags.value.join(', ')
}

function addCuisineTag(tag: string) {
  const normalized = tag.trim()
  if (!normalized) return
  if (selectedCuisineTags.value.some((item) => item.toLowerCase() === normalized.toLowerCase())) return
  selectedCuisineTags.value.push(normalized)
  cuisineSearch.value = ''
  syncCuisineToSettings()
}

function addCuisineTagFromInput() {
  if (!canAddCuisineTag.value) return
  addCuisineTag(normalizedCuisineSearch.value)
}

function removeCuisineTag(tag: string) {
  selectedCuisineTags.value = selectedCuisineTags.value.filter((item) => item !== tag)
  syncCuisineToSettings()
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
    originalSettings.value = cloneSettings(styleResponse.settings)
    fillForm(styleResponse.data)
    fillSettings(styleResponse.settings)
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
  if (originalSettings.value) fillSettings(originalSettings.value)
}

async function save(successText = 'Настройки сохранены.') {
  if (isReadonly.value || validationErrors.value.length) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const response = await $fetch<OrganizationStyleResponse>('/api/dashboard/organization/style', {
      method: 'PUT',
      body: {
        data: cloneConfig(form),
        settings: cloneSettings(settings),
      },
    })
    originalConfig.value = cloneConfig(response.data)
    originalSettings.value = cloneSettings(response.settings)
    fillForm(response.data)
    fillSettings(response.settings)
    auditLog.value = response.auditLog
    hasRollback.value = response.hasRollback
    successMessage.value = successText
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
    originalSettings.value = cloneSettings(response.settings)
    fillForm(response.data)
    fillSettings(response.settings)
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

function onColorPick(key: keyof OrganizationStyleConfig['tokens'], value: string) {
  form.tokens[key] = value.toUpperCase()
}

function onColorInput(event: Event, key: keyof OrganizationStyleConfig['tokens']) {
  const input = event.target as HTMLInputElement | null
  if (!input?.value) return
  onColorPick(key, input.value)
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

async function savePreset() {
  if (isReadonly.value || !newPresetTitle.value.trim()) return
  saving.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<{ ok: true; item: OrganizationStylePreset }>('/api/dashboard/organization/style-presets', {
      method: 'POST',
      body: {
        title: newPresetTitle.value.trim(),
        mood: newPresetMood.value.trim(),
        config: {
          tokens: form.tokens,
          radii: form.radii,
        },
      },
    })
    presets.value = [response.item, ...presets.value]
    newPresetTitle.value = ''
    newPresetMood.value = ''
    successMessage.value = 'Пользовательский пресет сохранен.'
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Не удалось сохранить пресет.'
  } finally {
    saving.value = false
  }
}

async function onFileChange(event: Event, kind: 'logo' | 'favicon' | 'restaurant-card' | 'hero') {
  if (isReadonly.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    errorMessage.value = 'Файл должен быть меньше 2MB.'
    return
  }
  const dataBase64 = await fileToBase64(file)
  const dimensions = await getImageDimensions(file)
  const response = await $fetch<{ ok: true; url: string }>('/api/dashboard/organization/media', {
    method: 'POST',
    body: {
      kind,
      fileName: file.name,
      mimeType: file.type,
      dataBase64,
      width: dimensions?.width,
      height: dimensions?.height,
    },
  })
  if (kind === 'logo') form.identity.logoUrl = response.url
  if (kind === 'favicon') form.identity.faviconUrl = response.url
  if (kind === 'restaurant-card') form.identity.restaurantCardImageUrl = response.url
  if (kind === 'hero') form.identity.heroImageUrl = response.url
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result || '')
      const marker = 'base64,'
      const idx = value.indexOf(marker)
      if (idx === -1) reject(new Error('Failed to parse file data'))
      else resolve(value.slice(idx + marker.length))
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (file.type === 'image/svg+xml') {
      resolve({ width: 256, height: 256 })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve(null)
      img.src = String(reader.result || '')
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

watch(languagesRaw, (value) => {
  settings.locale.languages = value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
})

function toggleFulfillmentType(
  value: 'delivery' | 'pickup' | 'dine-in' | 'qr-menu' | 'showcase-order',
  checked: boolean,
) {
  if (checked) {
    if (!settings.ops.fulfillmentTypes.includes(value)) {
      settings.ops.fulfillmentTypes = [...settings.ops.fulfillmentTypes, value]
    }
    return
  }
  settings.ops.fulfillmentTypes = settings.ops.fulfillmentTypes.filter((item) => item !== value)
}

function onFulfillmentCheckboxChange(
  event: Event,
  value: 'delivery' | 'pickup' | 'dine-in' | 'qr-menu' | 'showcase-order',
) {
  const input = event.target as HTMLInputElement | null
  toggleFulfillmentType(value, Boolean(input?.checked))
}

onMounted(loadData)
</script>
