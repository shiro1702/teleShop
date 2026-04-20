<template>
  <div class="mx-auto max-w-5xl space-y-8 px-4 py-8">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900">Маркетинг</h1>
      <p class="mt-1 text-sm text-gray-600">Промокоды и настройки бонусной программы (1 бонус = 1 ₽).</p>
    </div>

    <div class="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium"
        :class="tab === 'promo' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'"
        @click="tab = 'promo'"
      >
        Промокоды
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium"
        :class="tab === 'loyalty' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'"
        @click="tab = 'loyalty'"
      >
        Бонусы
      </button>
    </div>

    <section v-if="tab === 'promo'" class="space-y-6">
      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 class="text-sm font-semibold text-gray-900">
          {{ editingId ? 'Редактировать промокод' : 'Новый промокод' }}
        </h2>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="text-sm">
            <span class="text-gray-600">Код</span>
            <input v-model="form.code" class="mt-1 w-full rounded border px-2 py-1.5 uppercase" placeholder="WINTER2026">
          </label>
          <label class="text-sm">
            <span class="text-gray-600">Тип</span>
            <select v-model="form.type" class="mt-1 w-full rounded border px-2 py-1.5">
              <option value="percent">Процент</option>
              <option value="fixed">Фикс (₽)</option>
              <option value="free_item">Подарок</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="text-gray-600">{{ form.type === 'percent' ? 'Процент' : 'Значение (₽ или %)' }}</span>
            <input v-model.number="form.value" type="number" min="0" class="mt-1 w-full rounded border px-2 py-1.5">
          </label>
          <label class="text-sm">
            <span class="text-gray-600">Мин. сумма заказа (₽)</span>
            <input v-model.number="form.min_order_amount" type="number" min="0" class="mt-1 w-full rounded border px-2 py-1.5">
          </label>
          <label class="text-sm">
            <span class="text-gray-600">Начало (ISO)</span>
            <input v-model="form.starts_at" class="mt-1 w-full rounded border px-2 py-1.5" placeholder="2026-01-01T00:00:00Z">
          </label>
          <label class="text-sm">
            <span class="text-gray-600">Конец (ISO)</span>
            <input v-model="form.ends_at" class="mt-1 w-full rounded border px-2 py-1.5">
          </label>
          <label class="text-sm">
            <span class="text-gray-600">Лимит всего</span>
            <input v-model.number="form.max_uses_total" type="number" min="1" class="mt-1 w-full rounded border px-2 py-1.5" placeholder="пусто = нет">
          </label>
          <label class="text-sm">
            <span class="text-gray-600">Лимит на пользователя</span>
            <input v-model.number="form.max_uses_per_user" type="number" min="1" class="mt-1 w-full rounded border px-2 py-1.5" placeholder="пусто = нет">
          </label>
          <label v-if="form.type === 'free_item'" class="text-sm sm:col-span-2">
            <span class="text-gray-600">UUID товара-подарка</span>
            <input v-model="form.free_item_product_id" class="mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs">
          </label>
          <label v-if="form.type === 'free_item'" class="text-sm sm:col-span-2">
            <span class="text-gray-600">UUID варианта параметра (если нужен)</span>
            <input v-model="form.free_item_parameter_option_id" class="mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs">
          </label>
          <label class="flex items-center gap-2 text-sm sm:col-span-2">
            <input v-model="form.is_active" type="checkbox">
            Активен
          </label>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
            :disabled="saving"
            @click="savePromo"
          >
            {{ saving ? 'Сохранение…' : editingId ? 'Сохранить' : 'Создать' }}
          </button>
          <button v-if="editingId" type="button" class="rounded-lg border px-4 py-2 text-sm" @click="resetForm">
            Отмена
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b bg-gray-50 text-gray-600">
            <tr>
              <th class="px-3 py-2">Код</th>
              <th class="px-3 py-2">Тип</th>
              <th class="px-3 py-2">Знач.</th>
              <th class="px-3 py-2">Мин.</th>
              <th class="px-3 py-2">Активен</th>
              <th class="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in promos" :key="p.id" class="border-b border-gray-100">
              <td class="px-3 py-2 font-mono">{{ p.code }}</td>
              <td class="px-3 py-2">{{ p.type }}</td>
              <td class="px-3 py-2">{{ p.value }}</td>
              <td class="px-3 py-2">{{ p.min_order_amount }}</td>
              <td class="px-3 py-2">{{ p.is_active ? 'да' : 'нет' }}</td>
              <td class="px-3 py-2 text-right">
                <button type="button" class="text-blue-600 hover:underline" @click="editPromo(p)">Изм.</button>
                <button type="button" class="ml-2 text-red-600 hover:underline" @click="deletePromo(p.id)">Удал.</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 class="text-sm font-semibold text-gray-900">Настройки бонусов</h2>
      <p class="mt-1 text-xs text-gray-500">
        Начисление за заказ — после успешной онлайн-оплаты. Списание бонусов — при оформлении заказа. Магазин за баллы и отзывы — в планах.
      </p>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <label class="flex items-center gap-2 text-sm sm:col-span-2">
          <input v-model="loyalty.bonuses_enabled" type="checkbox">
          Включить систему бонусов
        </label>
        <label class="text-sm">
          <span class="text-gray-600">Кэшбек бонусами, % от суммы товаров после промо</span>
          <input v-model.number="loyalty.earn_percent_of_subtotal" type="number" min="0" max="100" class="mt-1 w-full rounded border px-2 py-1.5">
        </label>
        <label class="text-sm">
          <span class="text-gray-600">Макс. % заказа, оплачиваемый бонусами</span>
          <input v-model.number="loyalty.max_order_percent_payable_with_bonus" type="number" min="0" max="100" class="mt-1 w-full rounded border px-2 py-1.5">
        </label>
        <label class="flex items-center gap-2 text-sm sm:col-span-2">
          <input v-model="loyalty.allow_simultaneous_bonus_spend_and_earn" type="checkbox">
          Разрешить одновременно списывать и начислять бонусы в одном заказе
        </label>
        <p class="text-xs text-gray-500 sm:col-span-2">
          По умолчанию в заказе работает только один сценарий: либо списание, либо начисление.
        </p>
        <label class="flex items-center gap-2 text-sm sm:col-span-2">
          <input v-model="loyalty.expiry_enabled" type="checkbox">
          Сгорание при неактивности (настройка; авто-списание — позже)
        </label>
        <label class="text-sm">
          <span class="text-gray-600">Дней неактивности до сгорания</span>
          <input v-model.number="loyalty.expiry_days_inactivity" type="number" min="1" class="mt-1 w-full rounded border px-2 py-1.5">
        </label>
        <label class="text-sm">
          <span class="text-gray-600">Приветственный бонус (₽)</span>
          <input v-model.number="loyalty.welcome_bonus_amount" type="number" min="0" class="mt-1 w-full rounded border px-2 py-1.5">
        </label>
        <label class="text-sm">
          <span class="text-gray-600">День рождения (₽)</span>
          <input v-model.number="loyalty.birthday_bonus_amount" type="number" min="0" class="mt-1 w-full rounded border px-2 py-1.5">
        </label>
        <label class="text-sm">
          <span class="text-gray-600">За отзыв (₽), начисление после модуля отзывов</span>
          <input v-model.number="loyalty.review_bonus_amount" type="number" min="0" class="mt-1 w-full rounded border px-2 py-1.5">
        </label>
        <label class="text-sm">
          <span class="text-gray-600">Дней до ДР для поздравления</span>
          <input v-model.number="loyalty.birthday_bonus_days_before" type="number" min="0" max="60" class="mt-1 w-full rounded border px-2 py-1.5">
        </label>
      </div>
      <button
        type="button"
        class="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
        :disabled="loyaltySaving"
        @click="saveLoyalty"
      >
        {{ loyaltySaving ? 'Сохранение…' : 'Сохранить настройки' }}
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

definePageMeta({ layout: 'dashboard' })

const { load: loadAccess } = useDashboardAccess()
const tab = ref<'promo' | 'loyalty'>('promo')

const promos = ref<any[]>([])
const saving = ref(false)
const loyaltySaving = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  code: '',
  type: 'percent' as 'percent' | 'fixed' | 'free_item',
  value: 10,
  min_order_amount: 0,
  starts_at: '' as string | null,
  ends_at: '' as string | null,
  max_uses_total: null as number | null,
  max_uses_per_user: null as number | null,
  is_active: true,
  free_item_product_id: '' as string | null,
  free_item_parameter_option_id: '' as string | null,
})

const loyalty = reactive({
  bonuses_enabled: true,
  allow_simultaneous_bonus_spend_and_earn: false,
  earn_percent_of_subtotal: 5,
  max_order_percent_payable_with_bonus: 25,
  expiry_enabled: false,
  expiry_days_inactivity: null as number | null,
  welcome_bonus_amount: 0,
  birthday_bonus_amount: 0,
  review_bonus_amount: 0,
  birthday_bonus_days_before: 7,
})

async function loadPromos() {
  const res = await $fetch<{ ok: boolean; items: any[] }>('/api/dashboard/marketing/promo-codes')
  promos.value = res.items ?? []
}

async function loadLoyalty() {
  const res = await $fetch<{ ok: boolean; settings: any }>('/api/dashboard/marketing/loyalty-settings')
  const s = res.settings
  if (!s) return
  loyalty.bonuses_enabled = s.bonuses_enabled !== false
  loyalty.allow_simultaneous_bonus_spend_and_earn = s.allow_simultaneous_bonus_spend_and_earn === true
  loyalty.earn_percent_of_subtotal = s.earn_percent_of_subtotal ?? 5
  loyalty.max_order_percent_payable_with_bonus = s.max_order_percent_payable_with_bonus ?? 25
  loyalty.expiry_enabled = !!s.expiry_enabled
  loyalty.expiry_days_inactivity = s.expiry_days_inactivity
  loyalty.welcome_bonus_amount = s.welcome_bonus_amount ?? 0
  loyalty.birthday_bonus_amount = s.birthday_bonus_amount ?? 0
  loyalty.review_bonus_amount = s.review_bonus_amount ?? 0
  loyalty.birthday_bonus_days_before = s.birthday_bonus_days_before ?? 7
}

function resetForm() {
  editingId.value = null
  form.code = ''
  form.type = 'percent'
  form.value = 10
  form.min_order_amount = 0
  form.starts_at = null
  form.ends_at = null
  form.max_uses_total = null
  form.max_uses_per_user = null
  form.is_active = true
  form.free_item_product_id = null
  form.free_item_parameter_option_id = null
}

function editPromo(p: any) {
  editingId.value = p.id
  form.code = p.code
  form.type = p.type
  form.value = p.value
  form.min_order_amount = p.min_order_amount
  form.starts_at = p.starts_at || ''
  form.ends_at = p.ends_at || ''
  form.max_uses_total = p.max_uses_total
  form.max_uses_per_user = p.max_uses_per_user
  form.is_active = p.is_active
  form.free_item_product_id = p.free_item_product_id || ''
  form.free_item_parameter_option_id = p.free_item_parameter_option_id || ''
}

async function savePromo() {
  saving.value = true
  try {
    const body: any = {
      code: form.code,
      type: form.type,
      value: form.value,
      min_order_amount: form.min_order_amount,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      max_uses_total: form.max_uses_total,
      max_uses_per_user: form.max_uses_per_user,
      is_active: form.is_active,
      free_item_product_id: form.free_item_product_id || null,
      free_item_parameter_option_id: form.free_item_parameter_option_id || null,
    }
    if (editingId.value) {
      await $fetch(`/api/dashboard/marketing/promo-codes/${editingId.value}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/dashboard/marketing/promo-codes', { method: 'POST', body })
    }
    resetForm()
    await loadPromos()
  } finally {
    saving.value = false
  }
}

async function deletePromo(id: string) {
  if (!confirm('Удалить промокод?')) return
  await $fetch(`/api/dashboard/marketing/promo-codes/${id}`, { method: 'DELETE' })
  await loadPromos()
}

async function saveLoyalty() {
  loyaltySaving.value = true
  try {
    await $fetch('/api/dashboard/marketing/loyalty-settings', {
      method: 'PUT',
      body: { ...loyalty },
    })
  } finally {
    loyaltySaving.value = false
  }
}

onMounted(async () => {
  await loadAccess()
  await loadPromos()
  await loadLoyalty()
})
</script>
