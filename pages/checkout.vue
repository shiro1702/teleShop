<template>
  <div class="min-h-screen" :style="pageStyle">
    <!-- Модалка подтверждения очистки корзины -->
    <Teleport to="body">
      <Transition name="cart">
        <div
          v-if="showClearCartModal"
          class="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-cart-title"
        >
          <div
            class="absolute inset-0 bg-black/50"
            @click="closeClearCartModal"
          />
          <div
            class="relative w-full max-w-sm rounded-2xl p-6 shadow-xl"
            :style="cardStyle"
            @click.stop
          >
            <h2 id="clear-cart-title" class="text-lg font-semibold" :style="{ color: mainTextColor }">
              Очистить корзину?
            </h2>
            <p class="mt-2 text-sm" :style="{ color: mutedTextColor }">
              Все товары будут удалены из корзины.
            </p>
            <div class="mt-5 flex gap-3">
              <button
                type="button"
                class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition"
                :style="secondaryButtonStyle"
                @click="closeClearCartModal"
              >
                Отмена
              </button>
              <button
                type="button"
                class="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 active:bg-red-800"
                @click="confirmClearCart"
              >
                Очистить
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <header class="border-b" :style="headerStyle">
      <div class="mx-auto grid max-w-6xl grid-cols-3 items-center gap-3 px-4 py-4 sm:px-6">
        <div class="flex w-24 items-center sm:w-32">
          <button
            v-if="state.currentStep === 1"
            type="button"
            class="flex w-fit items-center gap-2 transition"
            :style="{ color: mutedTextColor }"
            aria-label="Назад к меню"
            @click="goBackToMenu"
          >
            <span
              class="flex h-10 w-10 items-center justify-center rounded-lg"
              :style="{ backgroundColor: 'transparent' }"
              aria-hidden="true"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </span>
            <span class="hidden text-sm sm:inline">
              Назад к меню
            </span>
          </button>
          <button
            v-else
            type="button"
            class="flex w-fit items-center gap-2 transition"
            :style="{ color: mutedTextColor }"
            aria-label="Назад"
            @click="goBackStep"
          >
            <span
              class="flex h-10 w-10 items-center justify-center rounded-lg"
              :style="{ backgroundColor: 'transparent' }"
              aria-hidden="true"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </span>
            <span class="hidden text-sm sm:inline">
              Назад
            </span>
          </button>
        </div>

        <h1 class="text-center text-xl font-bold" :style="{ color: mainTextColor }">
          Оформление
        </h1>

        <div class="text-right">
          <div
            v-if="cartStore.count > 0"
            class="flex flex-col items-end leading-tight"
          >
            <span class="text-sm font-medium" :style="{ color: mutedTextColor }">
              {{ cartStore.count }} шт.
            </span>
            <span class="text-sm font-semibold text-primary">
              {{ formatPrice(displayGoodsTotal) }}
            </span>
          </div>
        </div>
      </div>
    </header>

    <main
      class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8"
      :class="cartStore.items.length ? 'pb-28 sm:pb-8' : ''"
    >
      <CheckoutSteps
        :current-step="state.currentStep"
        :can-go-to-step2="canGoToAddress"
        @go="goToStep"
      />

      <div class="space-y-6">
        <Transition :name="stepTransitionName" mode="out-in" @after-enter="onStepTransitionAfterEnter">
          <!-- Шаг 1: корзина -->
          <section v-if="state.currentStep === 1" key="checkout-step-1">
          <div class="rounded-2xl p-4 sm:p-6" :style="cardStyle">
            <div v-if="cartStore.items.length === 0" class="py-10 text-center">
              <p :style="{ color: mutedTextColor }">
                Корзина пуста
              </p>
              <NuxtLink
                :to="tenantPath('/')"
                class="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700"
              >
                Перейти к товарам
              </NuxtLink>
            </div>
            <template v-else>
              <ul class="space-y-4">
                <CartItem
                  v-for="item in cartStore.items"
                  :key="item.cartItemId"
                  :item="item"
                />
                <button
                  type="button"
                  class="w-full rounded-lg border border-red-200 bg-white px-4 py-3 text-base font-medium text-red-600 transition hover:bg-red-50 active:bg-red-100"
                  @click="openClearCartModal"
                >
                  Очистить корзину
                </button>
              </ul>

              <div v-if="cartStore.items.length > 0" class="mt-4 space-y-3 border-t pt-4" :style="{ borderColor }">
                <label class="block text-sm">
                  <span :style="{ color: mutedTextColor }">Промокод</span>
                  <div class="mt-1 flex flex-col gap-2 sm:flex-row">
                    <input
                      v-model="promoCodeInput"
                      class="themed-input flex-1 rounded-lg border px-3 py-2"
                      :style="inputStyle"
                      placeholder="Например STUDENT24"
                      autocomplete="off"
                    >
                    <button
                      type="button"
                      class="inline-flex min-w-28 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:cursor-not-allowed disabled:bg-gray-300"
                      :disabled="isPromoApplyLoading || !cartStore.items.length"
                      @click="runPromoApply"
                    >
                      <span
                        v-if="isPromoApplyLoading"
                        class="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white"
                        aria-hidden="true"
                      />
                      <span v-else>Применить</span>
                    </button>
                  </div>
                </label>
                <p v-if="promoError" class="text-sm text-red-600">
                  {{ promoError }}
                </p>
                <p v-else-if="promoSuccess" class="text-sm text-emerald-700">
                  {{ promoSuccess }}
                </p>
                <div v-if="isAuthorizedForOrder && loyaltyBalance !== null" class="text-sm">
                  <div v-if="promoPreview?.bonusesEnabled === false" class="text-xs" :style="{ color: mutedTextColor }">
                    Бонусная программа временно отключена в настройках ресторана.
                  </div>
                  <template v-else-if="hasSpendableBonuses">
                    <div class="flex items-center justify-between">
                      <span :style="{ color: mutedTextColor }">Списать бонусов</span>
                      <span class="font-medium" :style="{ color: mainTextColor }">
                        {{ bonusToSpend }} / {{ maxBonusAvailable }}
                      </span>
                    </div>
                    <input
                      v-model.number="bonusToSpend"
                      type="range"
                      min="0"
                      :max="maxBonusAvailable"
                      step="1"
                      class="mt-2 w-full cursor-pointer accent-primary"
                      @change="runPromoPreview"
                    >
                    <p class="mt-1 text-xs" :style="{ color: mutedTextColor }">
                      Можно списать до {{ maxBonusAvailable }} бонусов (с учетом лимита заказа и вашего баланса).
                    </p>
                  </template>
                  <p v-else class="text-xs" :style="{ color: mutedTextColor }">
                    Бонусов для списания нет.
                  </p>
                </div>
              </div>
            </template>
          </div>

          <div
            v-if="cartStore.items.length > 0"
            ref="step1InlineNavRef"
            class="mt-4 flex flex-col items-stretch justify-between gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:p-5"
            :style="cardStyle"
          >
            <div class="space-y-1 text-sm">
              <div class="flex items-center justify-between">
                <div class="min-w-0">
                  <span :style="{ color: mutedTextColor }">Товары</span>
                </div>
                <span class="font-semibold" :style="{ color: mainTextColor }">
                  {{ formatPrice(promoSubtotalBeforeDiscount) }}
                </span>
              </div>
              <div v-if="hasPromoCodeApplied" class="flex items-center justify-between">
                <span :style="{ color: mutedTextColor }">Промокод {{ appliedPromoCode }}</span>
                <span class="font-semibold text-amber-500">
                  −{{ formatPrice(promoDiscountAmount) }}
                </span>
              </div>
              <div
                v-if="promoPreview?.ok && typeof promoPreview.bonusSpent === 'number' && promoPreview.bonusSpent > 0"
                class="flex items-center justify-between"
              >
                <span :style="{ color: mutedTextColor }">Списано бонусов</span>
                <span class="font-semibold text-emerald-600">
                  −{{ formatPrice(promoPreview.bonusSpent) }}
                </span>
              </div>
              <div v-if="bonusEarnEstimate > 0" class="flex items-center justify-between">
                <span :style="{ color: mutedTextColor }">
                  Начислим бонусов{{ loyaltyEarnPercent > 0 ? ` (${loyaltyEarnPercent}%)` : '' }}
                </span>
                <span class="font-semibold text-emerald-600">
                  +{{ bonusEarnEstimate }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span :style="{ color: mutedTextColor }">Доставка</span>
                <span
                  class="font-semibold"
                  :class="step1DeliveryCost === 0 ? 'text-emerald-600' : 'text-gray-900'"
                >
                  {{ step1DeliveryCost === 0 ? '0 ₽' : formatPrice(step1DeliveryCost) }}
                </span>
              </div>
              <div class="flex items-center justify-between border-t border-dashed pt-2" :style="{ borderColor }">
                <span class="font-semibold" :style="{ color: mainTextColor }">
                  Итого
                </span>
                <span class="text-xl font-bold text-primary">
                  {{ formatPrice(step1GrandTotal) }}
                </span>
              </div>
            </div>

            <div class="flex flex-1 flex-col gap-2 sm:max-w-xs">
              <button
                type="button"
                class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                :disabled="!canGoToAddress"
                @click="goToStep(2)"
              >
                {{ step1NextButtonLabel }}
              </button>
              <p
                v-if="!cartStore.canCheckout && cartStore.deliverySummary.minOrderAmount"
                class="text-xs text-red-600"
              >
                Минимальная сумма заказа для вашей зоны — {{ formatPrice(cartStore.deliverySummary.minOrderAmount) }}.
              </p>
            </div>
          </div>
          <div
            v-if="deliveryProgress"
            class="mt-4 rounded-2xl p-4 sm:p-5"
            :style="cardStyle"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-2xl font-bold" :style="{ color: mainTextColor }">
                  {{ step1DeliveryCost === 0 ? 'Доставка бесплатно' : formatPrice(step1DeliveryCost) }}
                </div>
                <p class="text-sm" :style="{ color: mutedTextColor }">
                  {{
                    deliveryProgress.remaining > 0
                      ? `Добавьте ещё ${formatPrice(deliveryProgress.remaining)} до бесплатной доставки`
                      : 'Порог бесплатной доставки достигнут'
                  }}
                </p>
              </div>
              <div class="text-sm font-medium" :style="{ color: mutedTextColor }">
                {{ formatPrice(deliveryProgress.threshold) }}
              </div>
            </div>
            <div class="mt-3 h-3 overflow-hidden rounded-full" :style="{ backgroundColor: borderColor }">
              <div
                class="h-full rounded-full bg-amber-400 transition-all duration-300"
                :style="{ width: `${deliveryProgress.progress}%` }"
              />
            </div>
          </div>
          </section>

          <!-- Шаг 2: оформление (получение + адрес + оплата + подтверждение) -->
          <section v-else key="checkout-step-2">
          <div class="rounded-2xl p-4 sm:p-6" :style="cardStyle">
            <div class="space-y-3">
              <section class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div class="space-y-2">
                  <h2 class="text-sm font-semibold text-gray-900">
                    Ресторан
                  </h2>
                  <select
                    v-model="selectedRestaurantId"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option v-for="r in restaurants" :key="r.id" :value="r.id">
                      {{ r.name }} — {{ r.address }}
                    </option>
                  </select>
                </div>
                <h2 class="text-sm font-semibold text-gray-900">
                  Способ получения
                </h2>
                <p
                  v-if="availableFulfillmentTypes.length === 0"
                  class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  Для выбранного ресторана не доступно оформление через delivery/pickup.
                </p>
                <p
                  v-else-if="availableFulfillmentTypes.length === 1"
                  class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  Доступно только: <span class="font-semibold text-gray-900">{{ summaryDeliveryLabel }}</span>
                </p>
                <div
                  v-else
                  class="inline-flex w-full rounded-xl border border-gray-200 bg-white p-1"
                >
                  <button
                    v-if="hasDeliveryOption"
                    type="button"
                    class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
                    :class="state.fulfillmentType === 'delivery'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'"
                    @click="state.fulfillmentType = 'delivery'"
                  >
                    Доставка
                  </button>
                  <button
                    v-if="hasPickupOption"
                    type="button"
                    class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
                    :class="state.fulfillmentType === 'pickup'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'"
                    @click="state.fulfillmentType = 'pickup'"
                  >
                    Самовывоз
                  </button>
                  <button
                    v-if="hasQrMenuOption"
                    type="button"
                    class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
                    :class="state.fulfillmentType === 'qr-menu'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'"
                    @click="state.fulfillmentType = 'qr-menu'"
                  >
                    QR-меню
                  </button>
                </div>
              </section>

              <div
                v-if="hasDeliveryOption && state.fulfillmentType === 'delivery' && savedAddresses.length"
                class="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4"
              >
                <p class="text-xs font-medium text-gray-500">
                  Ранее использованные адреса
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="addr in savedAddresses"
                    :key="addr.id"
                    type="button"
                    class="group flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:border-primary hover:bg-primary-50"
                    @click="applySavedAddress(addr)"
                  >
                    <span class="max-w-[160px] truncate sm:max-w-[220px]">
                      {{ addr.address }}
                    </span>
                    <div
                      class="ml-1 text-gray-400 hover:text-red-500"
                      @click.stop="deleteSavedAddress(addr.id)"
                      aria-label="Удалить адрес"
                    >
                      ×
                    </div>
                  </button>
                </div>
              </div>

              <section
                v-if="hasDeliveryOption && state.fulfillmentType === 'delivery'"
                class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4"
              >
                <div class="space-y-2">
                  <div class="relative">
                    <input
                      ref="addressInputRef"
                      v-model="addressLine"
                      type="text"
                      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                      class="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                    >
                      <button
                        v-for="item in suggestItems"
                        :key="item.value"
                        type="button"
                        class="flex w-full items-center justify-between px-4 py-3 text-left text-base text-gray-800 transition hover:bg-gray-50"
                        @click="selectSuggestion(item)"
                      >
                        <span class="truncate">
                          {{ item.displayName }}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      v-model="flat"
                      type="text"
                      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Квартира / подъезд"
                    />
                    <textarea
                      v-model="comment"
                      rows="2"
                      class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Комментарий курьеру"
                    />
                  </div>
                  <p
                    v-if="cartStore.deliverySummary.message"
                    class="text-xs text-gray-500"
                  >
                    {{ cartStore.deliverySummary.message }}
                  </p>
                </div>
              </section>

              <section
                v-else-if="hasPickupOption && state.fulfillmentType === 'pickup'"
                class="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 sm:p-4"
              >
                <p>
                  {{ pickupIntroText }}
                </p>

                <div
                  v-if="pickupPoints.length > 1"
                  class="space-y-2"
                >
                  <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700/80">
                    Точка самовывоза
                  </p>
                  <div class="space-y-2">
                    <label
                      v-for="point in pickupPoints"
                      :key="point.id"
                      class="flex cursor-pointer items-start gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-gray-900"
                    >
                      <input
                        v-model="selectedPickupPointId"
                        type="radio"
                        :value="point.id"
                        class="mt-1 h-4 w-4 text-primary"
                      >
                      <div>
                        <p class="text-sm font-medium">
                          {{ point.name }}
                        </p>
                        <p class="text-xs text-gray-600">
                          {{ point.address }}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div v-else-if="selectedPickupPoint" class="rounded-lg border border-emerald-200 bg-white p-3 text-gray-900">
                  <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700/80">
                    Точка самовывоза
                  </p>
                  <p class="mt-1 text-sm font-medium">
                    {{ selectedPickupPoint.name }}
                  </p>
                  <p class="text-xs text-gray-600">
                    {{ selectedPickupPoint.address }}
                  </p>
                </div>
              </section>

              <section
                v-else-if="hasQrMenuOption && state.fulfillmentType === 'qr-menu'"
                class="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4"
              >
                <p class="font-medium">
                  Оформление через QR-меню
                </p>
                <p class="text-amber-900/80">
                  Адрес доставки не требуется. Мы передадим заказ в работу и отправим подтверждение после оформления.
                </p>
              </section>
            </div>
          </div>

          <div class="mt-4 space-y-4">
            <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
              <h2 class="mb-3 text-base font-semibold text-gray-900 sm:text-lg">
                Способ оплаты
              </h2>
              <div class="space-y-2">
                <label class="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="state.paymentMethod"
                      type="radio"
                      value="cash"
                      class="h-4 w-4 text-primary"
                    >
                    <div>
                      <p class="font-medium text-gray-900">
                        Наличными при получении
                      </p>
                      <p class="text-xs text-gray-500">
                        Оплата наличными при получении
                      </p>
                    </div>
                  </div>
                </label>
                <div
                  v-if="state.paymentMethod === 'cash'"
                  class="mt-1 space-y-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                >
                  <label class="flex flex-col gap-1">
                    <span>С какой суммы подготовить сдачу (необязательно)</span>
                    <div class="flex items-center gap-2">
                      <input
                        v-model="changeFrom"
                        type="number"
                        min="0"
                        step="1"
                        inputmode="numeric"
                        class="w-32 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="2000"
                      >
                      <span class="text-gray-500">₽</span>
                    </div>
                  </label>
                </div>
                <label class="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="state.paymentMethod"
                      type="radio"
                      value="card_courier"
                      class="h-4 w-4 text-primary"
                    >
                    <div>
                      <p class="font-medium text-gray-900">
                        Картой при получении
                      </p>
                      <p class="text-xs text-gray-500">
                        Курьер привезёт терминал
                      </p>
                    </div>
                  </div>
                </label>
                <label class="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="state.paymentMethod"
                      type="radio"
                      value="online"
                      class="h-4 w-4 text-primary"
                    >
                    <div>
                      <p class="font-medium text-gray-900">
                        Оплата на сайте
                      </p>
                      <p class="text-xs text-gray-500">
                        Банковская страница YooKassa
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
              <div class="space-y-2 text-sm">
                <div class="flex items-start justify-between">
                  <div class="min-w-0">
                    <span class="text-gray-600">Товары</span>
                    <p class="truncate text-xs text-gray-500" :title="orderItemsSummary" v-html="orderItemsSummary"></p>
                  </div>
                  <span class="font-semibold text-gray-900">
                    {{ formatPrice(promoSubtotalBeforeDiscount) }}
                  </span>
                </div>
                <div v-if="hasPromoCodeApplied" class="flex items-center justify-between">
                  <span class="text-gray-600">Промокод {{ appliedPromoCode }}</span>
                  <span class="font-semibold text-amber-500">
                    −{{ formatPrice(promoDiscountAmount) }}
                  </span>
                </div>
                <div
                  v-if="promoPreview?.ok && typeof promoPreview.bonusSpent === 'number' && promoPreview.bonusSpent > 0"
                  class="flex items-center justify-between"
                >
                  <span class="text-gray-600">Списано бонусов</span>
                  <span class="font-semibold text-emerald-600">
                    −{{ formatPrice(promoPreview.bonusSpent) }}
                  </span>
                </div>
                <div v-if="bonusEarnEstimate > 0" class="flex items-center justify-between">
                  <span class="text-gray-600">
                    Начислим бонусов{{ loyaltyEarnPercent > 0 ? ` (${loyaltyEarnPercent}%)` : '' }}
                  </span>
                  <span class="font-semibold text-emerald-600">
                    +{{ bonusEarnEstimate }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">{{ summaryDeliveryLabel }}</span>
                  <span
                    class="font-semibold"
                    :class="summaryDeliveryCost === 0 ? 'text-emerald-600' : 'text-gray-900'"
                  >
                    {{ summaryDeliveryCost === 0 ? '0 ₽' : formatPrice(summaryDeliveryCost) }}
                  </span>
                </div>
                <div class="flex items-center justify-between border-t border-dashed border-gray-200 pt-2">
                  <span class="font-semibold text-gray-900">
                    Итого к оплате
                  </span>
                  <span class="text-xl font-bold text-primary">
                    {{ formatPrice(summaryGrandTotal) }}
                  </span>
                </div>
              </div>
            </div>

            <div
              ref="step2ActionsRef"
              class="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center"
            >
              <button
                type="button"
                class="w-full rounded-lg border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                @click="goToStep(1)"
              >
                Назад к корзине
              </button>

              <div class="flex w-full flex-col gap-2 sm:w-auto">
                <button
                  v-if="isAuthorizedForOrder"
                  type="button"
                  class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
                  :disabled="!canPlaceOrder"
                  @click="placeOrder"
                >
                  <span v-if="isPlacing">Оформляем заказ...</span>
                  <span v-else>Оформить заказ</span>
                </button>
                <p v-if="!isRestaurantOpenNow" class="text-xs text-red-600">
                  Ресторан сейчас закрыт. Оформление заказа недоступно.
                </p>

                <template v-else-if="!isAuthorizedForOrder">
                  <button
                    type="button"
                    class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 sm:w-auto"
                    @click="authAndReturn"
                  >
                    Авторизоваться и оформить
                  </button>
                  <button
                    type="button"
                    class="w-full rounded-lg border border-primary px-4 py-3 text-base font-medium text-primary transition hover:bg-primary-50 active:bg-primary-100 sm:w-auto"
                    @click="continueInTelegramFromCheckout"
                  >
                    Продолжить в Telegram‑боте
                  </button>
                </template>
              </div>
            </div>
          </div>
          </section>
        </Transition>
      </div>
    </main>

    <!-- Нижняя панель (моб.) -->
    <Transition name="bottom-bar">
      <div
        v-if="showBottomBar"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pt-3 pb-10 backdrop-blur sm:hidden"
        :class="isTelegram ? 'pb-20' : ''"
      >
      <!-- Шаг 1: навигация -->
      <button
        v-if="state.currentStep === 1"
        type="button"
        class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        :disabled="!canGoToAddress"
        @click="goToStep(2)"
      >
        Далее
      </button>

      <!-- Шаг 2: кнопки оформления (скрываем, если виден обычный блок) -->
      <div v-else class="flex flex-col gap-2">
        <button
          v-if="isAuthorizedForOrder"
          type="button"
          class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          :disabled="!canPlaceOrder"
          @click="placeOrder"
        >
          <span v-if="isPlacing">Оформляем заказ...</span>
          <span v-else>Оформить заказ</span>
        </button>
        <template v-else>
          <button
            type="button"
            class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700"
            @click="authAndReturn"
          >
            Авторизоваться и оформить
          </button>
          <button
            type="button"
            class="w-full rounded-lg border border-primary px-4 py-3 text-base font-medium text-primary transition hover:bg-primary-50 active:bg-primary-100"
            @click="continueInTelegramFromCheckout"
          >
            Продолжить в Telegram‑боте
          </button>
        </template>
      </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCheckoutAddress } from '~/composables/useCheckoutAddress'
import { useCheckoutTenantRestaurants } from '~/composables/useCheckoutTenantRestaurants'
import type { FulfillmentType } from '~/composables/useCheckoutTenantRestaurants'
import { resolveCartScopeKey } from '~/utils/cartScope'
import type { WeeklyWorkingHours } from '~/types/organization-style'
import { isOpenNowBySchedule } from '~/utils/workingHours'

const cartStore = useCartStore()
const route = useRoute()
const router = useRouter()
const { isTelegram, webApp } = useTelegram()
const supabaseUser = useSupabaseUser()
const config = useRuntimeConfig()
const { tenant, tenantKey, tenantPath } = useTenant()

const telegramBotName = (config.public.telegramBotName as string | undefined) || ''
const telegramBotUrl = computed(() =>
  telegramBotName ? `https://t.me/${telegramBotName}` : null,
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
const inputBgColor = computed(() => theme.value.surface_input || cardBgColor.value)
const inputBorderColor = computed(() => theme.value.surface_input_border || borderColor.value)
const inputStyle = computed(() => ({
  borderColor: inputBorderColor.value,
  backgroundColor: inputBgColor.value,
  color: mainTextColor.value,
  '--input-placeholder-color': mutedTextColor.value,
}))

const secondaryButtonStyle = computed(() => ({
  border: `1px solid ${borderColor.value}`,
  color: mainTextColor.value,
  backgroundColor: 'transparent',
}))
const pickupPointsConfigRaw = (config.public.pickupPointsJson as string | undefined) || ''
const fulfillmentTypesConfigRaw = (config.public.fulfillmentTypes as string | undefined) || ''

type PaymentMethod = 'cash' | 'card_courier' | 'online'

type CheckoutState = {
  currentStep: 1 | 2
  paymentMethod: PaymentMethod
  fulfillmentType: FulfillmentType
}

const CHECKOUT_STORAGE_KEY = 'teleshop_checkout_state'

function buildCheckoutStorageKey(scopeKey: string | null | undefined) {
  const scope = typeof scopeKey === 'string' ? scopeKey.trim() : ''
  return scope ? `${CHECKOUT_STORAGE_KEY}:${scope}` : CHECKOUT_STORAGE_KEY
}

const checkoutStorageKey = computed(() => buildCheckoutStorageKey(shopIdFromRoute.value))

const state = reactive<CheckoutState>({
  currentStep: 1,
  paymentMethod: 'cash',
  fulfillmentType: 'delivery',
})

const isPlacing = ref(false)
const promoCodeInput = ref('')
const appliedPromoCode = ref('')
const bonusToSpend = ref(0)
const promoPreview = ref<{
  ok?: boolean
  error?: string
  bonusesEnabled?: boolean
  loyaltyEarnPercent?: number
  bonusEarnEstimate?: number
  subtotalAfterPromo?: number
  discountAmount?: number
  payableGoods?: number
  bonusSpent?: number
  maxBonusForOrder?: number
  balance?: number
} | null>(null)
const promoError = ref('')
const promoSuccess = ref('')
const loyaltyBalance = ref<number | null>(null)
const isPromoApplyLoading = ref(false)
const isPromoPreviewLoading = ref(false)
let promoPreviewSeq = 0
let promoPreviewTimer: ReturnType<typeof setTimeout> | null = null

const changeFrom = ref<string>('')
const showClearCartModal = ref(false)
const step1InlineNavRef = ref<HTMLElement | null>(null)
const step2ActionsRef = ref<HTMLElement | null>(null)
const isStep1InlineNavVisible = ref(false)
const isStep2ActionsVisible = ref(false)
const stepDirection = ref<'forward' | 'backward'>('forward')

const stepTransitionName = computed(() =>
  stepDirection.value === 'forward' ? 'step-forward' : 'step-backward',
)

const showBottomBar = computed(() => {
  if (!cartStore.items.length) return false
  if (state.currentStep === 1) return !isStep1InlineNavVisible.value
  return !isStep2ActionsVisible.value
})

const {
  addressLine,
  flat,
  comment,
  addressInputRef,
  suggestItems,
  isSuggestLoading,
  savedAddresses,
  setDeliveryZones,
  onAddressInput,
  selectSuggestion,
  applySavedAddress,
  deleteSavedAddress,
} = useCheckoutAddress()

const shopIdFromRoute = computed(() => {
  const fromTenantState = typeof tenantKey.value === 'string' ? tenantKey.value.trim() : ''
  const fromRouteSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  const fromQuery = typeof route.query.shop_id === 'string' ? route.query.shop_id.trim() : ''
  return fromTenantState || fromRouteSlug || fromQuery || null
})

function applyCartScope() {
  const scope = resolveCartScopeKey(route, shopIdFromRoute.value)
  cartStore.setScope(scope)
}
applyCartScope()

const {
  selectedPickupPointId,
  selectedRestaurantId,
  selectedPickupPoint,
  restaurants,
  pickupPoints,
  availableFulfillmentTypes,
  hasDeliveryOption,
  hasPickupOption,
  hasQrMenuOption,
  pickupIntroText,
  organizationTimezone,
  selectedRestaurantWorkingHours,
  loadRestaurants,
} = useCheckoutTenantRestaurants({
  shopIdFromRoute,
  pickupPointsConfigRaw,
  fulfillmentTypesConfigRaw,
  currentFulfillmentType: toRef(state, 'fulfillmentType'),
  setDeliveryZones,
})

const canGoToAddress = computed(
  () => cartStore.items.length > 0,
)

const hasAllRequiredParameterSelections = computed(() => {
  // Для каждого товара: если есть обязательные параметрные группы,
  // то в cartStore должен быть выбран как минимум один option для этой группы.
  return cartStore.items.every((item) => {
    const requiredGroups = (item.parameters ?? []).filter((g) => !!g.isRequired)
    if (!requiredGroups.length) return true

    const selected = item.selectedParameters ?? []
    return requiredGroups.every((g) => selected.some((p) => p.productParameterId === g.id))
  })
})

const canGoToSummary = computed(() => {
  if (state.fulfillmentType === 'pickup') {
    return (
      hasPickupOption.value &&
      cartStore.items.length > 0 &&
      !!selectedPickupPoint.value &&
      hasAllRequiredParameterSelections.value
    )
  }

  if (state.fulfillmentType === 'qr-menu') {
    return (
      hasQrMenuOption.value &&
      cartStore.items.length > 0 &&
      hasAllRequiredParameterSelections.value
    )
  }
  const hasHouseNumber = /\d/.test(addressLine.value.trim())
  return (
    hasDeliveryOption.value &&
    hasHouseNumber &&
    cartStore.items.length > 0 &&
    !!cartStore.deliveryZone &&
    !cartStore.deliveryError &&
    hasAllRequiredParameterSelections.value
  )
})
const isRestaurantOpenNow = computed(() => {
  const schedule = selectedRestaurantWorkingHours.value as WeeklyWorkingHours | null
  if (!schedule) return true
  return isOpenNowBySchedule(schedule, organizationTimezone.value).isOpen
})
const canPlaceOrder = computed(() =>
  !isPlacing.value && !!cartStore.items.length && !!canGoToSummary.value && isRestaurantOpenNow.value,
)

const summaryDeliveryLabel = computed(() =>
  state.fulfillmentType === 'pickup'
    ? 'Самовывоз'
    : state.fulfillmentType === 'qr-menu'
      ? 'QR-меню'
      : 'Доставка',
)

const displayGoodsTotal = computed(() =>
  promoPreview.value?.ok && typeof promoPreview.value.payableGoods === 'number'
    ? promoPreview.value.payableGoods
    : cartStore.total,
)

const promoSubtotalBeforeDiscount = computed(() => cartStore.total)
const promoDiscountAmount = computed(() =>
  promoPreview.value?.ok && typeof promoPreview.value.discountAmount === 'number'
    ? Math.max(0, promoPreview.value.discountAmount)
    : 0,
)
const maxBonusAvailable = computed(() => {
  if (promoPreview.value?.bonusesEnabled === false) return 0
  const byPreview = promoPreview.value?.ok && typeof promoPreview.value.maxBonusForOrder === 'number'
    ? promoPreview.value.maxBonusForOrder
    : null
  const byBalance = typeof loyaltyBalance.value === 'number' ? loyaltyBalance.value : 0
  const resolved = byPreview != null ? Math.min(byPreview, byBalance) : byBalance
  return Math.max(0, Math.floor(Number.isFinite(resolved) ? resolved : 0))
})
const hasSpendableBonuses = computed(() => maxBonusAvailable.value > 0)
const hasPromoCodeApplied = computed(() =>
  !!appliedPromoCode.value.trim()
  && !!promoPreview.value?.ok
  && (promoDiscountAmount.value > 0 || Number(promoPreview.value?.subtotalAfterPromo || 0) !== cartStore.total),
)
const orderItemsSummary = computed(() =>
  cartStore.items
    .map((item: { name: string; quantity: number }) => `${item.name} × ${item.quantity}`)
    .join(',<br/>'),
)
const bonusEarnEstimate = computed(() => {
  if (!isAuthorizedForOrder.value) return 0
  if (!promoPreview.value?.ok) return 0
  const estimate = promoPreview.value.bonusEarnEstimate
  return typeof estimate === 'number' && Number.isFinite(estimate) ? Math.max(0, Math.floor(estimate)) : 0
})
const loyaltyEarnPercent = computed(() => {
  if (!promoPreview.value?.ok) return 0
  const pct = promoPreview.value.loyaltyEarnPercent
  return typeof pct === 'number' && Number.isFinite(pct) ? Math.max(0, pct) : 0
})

const summaryDeliveryCost = computed(() => {
  if (state.fulfillmentType !== 'delivery') return 0
  const zone = cartStore.deliveryZone
  if (!zone) return cartStore.deliveryCost
  const sub =
    promoPreview.value?.ok && typeof promoPreview.value.subtotalAfterPromo === 'number'
      ? promoPreview.value.subtotalAfterPromo
      : cartStore.total
  return sub >= zone.freeDeliveryThreshold ? 0 : zone.deliveryCost
})

const summaryGrandTotal = computed(
  () => displayGoodsTotal.value + summaryDeliveryCost.value,
)

const step1DeliveryCost = computed(() => {
  if (state.fulfillmentType === 'pickup' || state.fulfillmentType === 'qr-menu') return 0
  return summaryDeliveryCost.value
})

const step1GrandTotal = computed(() => displayGoodsTotal.value + step1DeliveryCost.value)
const deliveryProgress = computed(() => {
  if (state.fulfillmentType !== 'delivery') return null
  const zone = cartStore.deliveryZone
  if (!zone || !Number.isFinite(zone.freeDeliveryThreshold) || zone.freeDeliveryThreshold <= 0) return null
  const subtotalForThreshold =
    promoPreview.value?.ok && typeof promoPreview.value.subtotalAfterPromo === 'number'
      ? promoPreview.value.subtotalAfterPromo
      : cartStore.total
  const remaining = Math.max(0, zone.freeDeliveryThreshold - subtotalForThreshold)
  const progress = Math.max(0, Math.min(100, Math.round((subtotalForThreshold / zone.freeDeliveryThreshold) * 100)))
  return {
    threshold: zone.freeDeliveryThreshold,
    remaining,
    progress,
  }
})

async function runPromoApply() {
  promoError.value = ''
  promoSuccess.value = ''
  if (!cartStore.items.length) return
  const inputCode = promoCodeInput.value.trim()
  if (!inputCode) {
    appliedPromoCode.value = ''
    await runPromoPreview()
    return
  }

  isPromoApplyLoading.value = true
  try {
    const res = await $fetch<{
      ok: boolean
      error?: string
      promoCode?: string
      discountAmount?: number
    }>('/api/promo/apply', {
      method: 'POST',
      headers: shopIdFromRoute.value ? { 'x-shop-id': shopIdFromRoute.value } : undefined,
      body: {
        items: cartStore.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          cartItemId: item.cartItemId,
          selectedModifiers: item.selectedModifiers ?? [],
          selectedParameters: item.selectedParameters ?? [],
        })),
        promoCode: inputCode,
      },
    })

    if (!res?.ok) {
      appliedPromoCode.value = ''
      promoPreview.value = null
      promoError.value = res?.error || 'Промокод не применён'
      return
    }

    appliedPromoCode.value = (res.promoCode || inputCode).toUpperCase()
    promoCodeInput.value = appliedPromoCode.value
    promoSuccess.value = typeof res.discountAmount === 'number' && res.discountAmount > 0
      ? `Скидка применена: вы экономите ${formatPrice(res.discountAmount)}`
      : 'Промокод применён'
    await runPromoPreview()
  } catch (e: any) {
    appliedPromoCode.value = ''
    promoPreview.value = null
    promoError.value = e?.data?.message || e?.message || 'Ошибка применения промокода'
  } finally {
    isPromoApplyLoading.value = false
  }
}

async function runPromoPreview() {
  const requestSeq = ++promoPreviewSeq
  isPromoPreviewLoading.value = true
  promoError.value = ''
  promoSuccess.value = ''
  if (!cartStore.items.length) {
    promoPreview.value = null
    if (requestSeq === promoPreviewSeq) {
      isPromoPreviewLoading.value = false
    }
    return
  }
  try {
    const res = await $fetch<{
      ok: boolean
      error?: string
      bonusesEnabled?: boolean
      loyaltyEarnPercent?: number
      bonusEarnEstimate?: number
      subtotalAfterPromo?: number
      discountAmount?: number
      payableGoods?: number
      bonusSpent?: number
      maxBonusForOrder?: number
      balance?: number
    }>('/api/promo/preview', {
      method: 'POST',
      headers: shopIdFromRoute.value ? { 'x-shop-id': shopIdFromRoute.value } : undefined,
      body: {
        items: cartStore.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          cartItemId: item.cartItemId,
          selectedModifiers: item.selectedModifiers ?? [],
          selectedParameters: item.selectedParameters ?? [],
        })),
        promoCode: appliedPromoCode.value.trim() || null,
        bonusPointsToSpend: bonusToSpend.value || 0,
      },
    })
    if (requestSeq !== promoPreviewSeq) return
    if (res && typeof res === 'object' && res.ok === false) {
      promoPreview.value = null
      promoError.value = res.error || 'Промокод не применён'
      promoSuccess.value = ''
      return
    }
    promoPreview.value = res
    promoError.value = ''
    if (!appliedPromoCode.value.trim()) {
      promoSuccess.value = ''
    }
  } catch (e: any) {
    if (requestSeq !== promoPreviewSeq) return
    promoPreview.value = null
    promoError.value = e?.data?.message || e?.message || 'Ошибка проверки промокода'
  } finally {
    if (requestSeq === promoPreviewSeq) {
      isPromoPreviewLoading.value = false
    }
  }
}

watch(maxBonusAvailable, (nextMax: number) => {
  if (bonusToSpend.value > nextMax) {
    bonusToSpend.value = nextMax
    void runPromoPreview()
  }
})

async function loadLoyaltyBalance() {
  if (!supabaseUser.value || !shopIdFromRoute.value) {
    loyaltyBalance.value = null
    return
  }
  try {
    const res = await $fetch<{ ok: boolean; balance: number }>('/api/loyalty/balance', {
      headers: { 'x-shop-id': shopIdFromRoute.value },
    })
    loyaltyBalance.value = res.balance
  } catch {
    loyaltyBalance.value = null
  }
}

watch([supabaseUser, shopIdFromRoute], () => {
  void loadLoyaltyBalance()
}, { immediate: true })

const promoPreviewWatchSignature = computed(() => JSON.stringify({
  items: cartStore.items.map(item => ({
    id: item.id,
    price: item.price,
    quantity: item.quantity,
    cartItemId: item.cartItemId,
    selectedModifiers: item.selectedModifiers ?? [],
    selectedParameters: item.selectedParameters ?? [],
  })),
  promoCode: appliedPromoCode.value.trim(),
  bonusToSpend: bonusToSpend.value || 0,
  shopId: shopIdFromRoute.value || '',
}))

watch(promoPreviewWatchSignature, () => {
  if (promoPreviewTimer) clearTimeout(promoPreviewTimer)
  promoPreviewTimer = setTimeout(() => {
    void runPromoPreview()
  }, 450)
}, { immediate: true })

const step1NextButtonLabel = computed(() =>
  hasDeliveryOption.value && hasPickupOption.value
    ? 'Далее: способ получения'
    : hasPickupOption.value
      ? 'Далее: самовывоз'
      : hasQrMenuOption.value
        ? 'Далее: оформление'
        : 'Далее: адрес доставки',
)

const isAuthorizedForOrder = computed(() => {
  // В TMA авторизацию обеспечивает initData, в вебе — Supabase-сессия
  return isTelegram.value || !!supabaseUser.value
})

const isCheckoutRoute = computed(() => route.path.endsWith('/checkout'))
const isCartRoute = computed(() => route.path.endsWith('/cart'))

function goToStep(step: 1 | 2) {
  const targetPath = step === 2 ? tenantPath('/checkout') : tenantPath('/cart')
  if (route.path !== targetPath) {
    void router.push({ path: targetPath })
  }
  if (step === state.currentStep) return
  stepDirection.value = step > state.currentStep ? 'forward' : 'backward'
  state.currentStep = step
}

function goBackStep() {
  if (state.currentStep === 2) goToStep(1)
}

function goBackToMenu() {
  void router.push({ path: tenantPath('/') })
}

function openClearCartModal() {
  if (!cartStore.items.length) return
  showClearCartModal.value = true
}

function closeClearCartModal() {
  showClearCartModal.value = false
}

function confirmClearCart() {
  if (!cartStore.items.length) {
    showClearCartModal.value = false
    return
  }
  cartStore.clear()
  state.currentStep = 1
  showClearCartModal.value = false
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}

function serializeState() {
  return JSON.stringify({
    currentStep: state.currentStep,
    paymentMethod: state.paymentMethod,
    fulfillmentType: state.fulfillmentType,
    addressLine: addressLine.value,
    flat: flat.value,
    comment: comment.value,
    changeFrom: changeFrom.value,
    selectedPickupPointId: selectedPickupPointId.value,
    selectedRestaurantId: selectedRestaurantId.value,
    promoCodeInput: promoCodeInput.value,
    appliedPromoCode: appliedPromoCode.value,
    bonusToSpend: bonusToSpend.value,
  })
}

function restoreFromPlainObject(obj: any) {
  if (!obj || typeof obj !== 'object') return

  if (obj.currentStep === 2) {
    state.currentStep = 2
  }
  if (obj.paymentMethod === 'cash' || obj.paymentMethod === 'card_courier' || obj.paymentMethod === 'online') {
    state.paymentMethod = obj.paymentMethod
  }
  if (
    (obj.fulfillmentType === 'delivery' || obj.fulfillmentType === 'pickup')
    && availableFulfillmentTypes.value.includes(obj.fulfillmentType)
  ) {
    state.fulfillmentType = obj.fulfillmentType
  }
  if (typeof obj.addressLine === 'string') {
    addressLine.value = obj.addressLine
  }
  if (typeof obj.flat === 'string') {
    flat.value = obj.flat
  }
  if (typeof obj.comment === 'string') {
    comment.value = obj.comment
  }
  if (typeof obj.changeFrom === 'string') {
    changeFrom.value = obj.changeFrom
  }
  if (typeof obj.selectedPickupPointId === 'string') {
    selectedPickupPointId.value = obj.selectedPickupPointId
  }
  if (typeof obj.selectedRestaurantId === 'string') {
    selectedRestaurantId.value = obj.selectedRestaurantId
  }
  if (typeof obj.promoCodeInput === 'string') {
    promoCodeInput.value = obj.promoCodeInput
  }
  if (typeof obj.appliedPromoCode === 'string') {
    appliedPromoCode.value = obj.appliedPromoCode
  }
  if (typeof obj.bonusToSpend === 'number' && Number.isFinite(obj.bonusToSpend)) {
    bonusToSpend.value = Math.max(0, Math.floor(obj.bonusToSpend))
  }
}

function resetScopedCheckoutFields() {
  promoCodeInput.value = ''
  appliedPromoCode.value = ''
  bonusToSpend.value = 0
  promoPreview.value = null
  promoError.value = ''
  promoSuccess.value = ''
}

function isClient() {
  return typeof window !== 'undefined'
}

function setupInlineNavObservers() {
  if (!isClient() || typeof IntersectionObserver === 'undefined') return () => {}

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target === step1InlineNavRef.value) {
          isStep1InlineNavVisible.value = entry.isIntersecting
        } else if (entry.target === step2ActionsRef.value) {
          isStep2ActionsVisible.value = entry.isIntersecting
        }
      }
    },
    { threshold: 0.15 },
  )

  if (step1InlineNavRef.value) observer.observe(step1InlineNavRef.value)
  if (step2ActionsRef.value) observer.observe(step2ActionsRef.value)

  return () => observer.disconnect()
}

let cleanupInlineNavObservers: (() => void) | null = null

async function refreshInlineNavObservers() {
  cleanupInlineNavObservers?.()
  cleanupInlineNavObservers = null
  // Сбрасываем видимость, чтобы не залипали старые значения при смене шага
  isStep1InlineNavVisible.value = false
  isStep2ActionsVisible.value = false
  await nextTick()
  cleanupInlineNavObservers = setupInlineNavObservers()
}

async function onStepTransitionAfterEnter() {
  await refreshInlineNavObservers()
}

onMounted(async () => {
  await refreshInlineNavObservers()
})

onBeforeUnmount(() => {
  if (promoPreviewTimer) {
    clearTimeout(promoPreviewTimer)
    promoPreviewTimer = null
  }
  cleanupInlineNavObservers?.()
  cleanupInlineNavObservers = null
})

watch(
  [() => state.currentStep, () => cartStore.items.length],
  async ([, itemsCount], [, prevItemsCount]) => {
    // На смене шага observer обновляем в after-enter Transition.
    if (itemsCount === 0) {
      cleanupInlineNavObservers?.()
      cleanupInlineNavObservers = null
      isStep1InlineNavVisible.value = false
      isStep2ActionsVisible.value = false
      return
    }

    // Если корзина появилась из пустой без переключения шага,
    // нужно заново подписаться прямо сейчас (без ожидания transition).
    if (prevItemsCount === 0 && itemsCount > 0) {
      await refreshInlineNavObservers()
    }
  },
)

function persistCheckoutStateLocal(data: string) {
  if (!isClient()) return
  try {
    localStorage.setItem(checkoutStorageKey.value, data)
  } catch {
    // ignore
  }
}

function loadCheckoutStateLocal() {
  if (!isClient()) return null
  try {
    const raw = localStorage.getItem(checkoutStorageKey.value)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function persistCheckoutStateCloud(data: string) {
  if (!isTelegram.value || !(webApp.value as any)?.CloudStorage) {
    persistCheckoutStateLocal(data)
    return
  }

  (webApp.value as any).CloudStorage.setItem(checkoutStorageKey.value, data, () => {
    persistCheckoutStateLocal(data)
  })
}

function loadCheckoutStateCloud(): Promise<any | null> {
  if (!isTelegram.value || !(webApp.value as any)?.CloudStorage) {
    return Promise.resolve(loadCheckoutStateLocal())
  }

  return new Promise((resolve) => {
    (webApp.value as any).CloudStorage.getItem(
      checkoutStorageKey.value,
      (_err: unknown, value: string | null) => {
        if (value) {
          try {
            resolve(JSON.parse(value))
            return
          } catch {
            // fall through to local
          }
        }
        resolve(loadCheckoutStateLocal())
      },
    )
  })
}

watch(
  () => ({
    currentStep: state.currentStep,
    paymentMethod: state.paymentMethod,
    fulfillmentType: state.fulfillmentType,
    addressLine: addressLine.value,
    flat: flat.value,
    comment: comment.value,
    changeFrom: changeFrom.value,
    selectedPickupPointId: selectedPickupPointId.value,
    selectedRestaurantId: selectedRestaurantId.value,
    promoCodeInput: promoCodeInput.value,
    appliedPromoCode: appliedPromoCode.value,
    bonusToSpend: bonusToSpend.value,
  }),
  () => {
    const data = serializeState()
    persistCheckoutStateCloud(data)
  },
  { deep: true },
)

onMounted(async () => {
  const saved = await loadCheckoutStateCloud()
  if (saved) restoreFromPlainObject(saved)

  const stepParam = Number(route.query.step || 0)
  if (isCheckoutRoute.value && cartStore.items.length > 0) {
    state.currentStep = 2
  } else if (isCartRoute.value) {
    state.currentStep = 1
  } else if (stepParam === 2 && cartStore.items.length > 0) {
    state.currentStep = 2
  }

  await loadRestaurants()
})

watch(shopIdFromRoute, async () => {
  applyCartScope()
  await loadRestaurants()
})

watch(checkoutStorageKey, async (nextKey: string, prevKey: string) => {
  if (nextKey === prevKey) return
  resetScopedCheckoutFields()
  const saved = await loadCheckoutStateCloud()
  if (saved) restoreFromPlainObject(saved)
})

async function placeOrder() {
  if (isPlacing.value || !cartStore.items.length || !canGoToSummary.value || !isRestaurantOpenNow.value) return

  isPlacing.value = true
  try {
    const body: any = {
      shopId: shopIdFromRoute.value,
      restaurantId: selectedRestaurantId.value || null,
      items: cartStore.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        cartItemId: item.cartItemId,
        selectedModifiers: item.selectedModifiers ?? [],
        selectedParameters: item.selectedParameters ?? [],
      })),
      fulfillmentType: state.fulfillmentType,
      address: state.fulfillmentType === 'delivery'
        ? {
            line: addressLine.value || null,
            flat: flat.value || null,
            comment: comment.value || null,
            zone: cartStore.deliveryZone ?? null,
          }
        : {
            line: null,
            flat: null,
            comment: comment.value || null,
            zone: null,
          },
      pickupPoint: state.fulfillmentType === 'pickup' && selectedPickupPoint.value
        ? selectedPickupPoint.value
        : null,
      paymentMethod: state.paymentMethod,
      changeFrom: state.paymentMethod === 'cash' && Number.isFinite(Number.parseInt(changeFrom.value, 10))
        ? Number.parseInt(changeFrom.value, 10)
        : null,
      promoCode: appliedPromoCode.value.trim() || null,
      bonusPointsToSpend: bonusToSpend.value || 0,
    }

    if (isTelegram.value && webApp.value?.initData) {
      body.initData = webApp.value.initData
    }

    const res = await $fetch<{ ok: boolean; orderId?: string }>('/api/order', {
      method: 'POST',
      headers: shopIdFromRoute.value ? { 'x-shop-id': shopIdFromRoute.value } : undefined,
      body,
    })

    if (res?.ok) {
      if (state.paymentMethod === 'online' && res.orderId) {
        const returnUrl = isClient()
          ? `${window.location.origin}${tenantPath('/checkout')}?payment=return&orderId=${encodeURIComponent(res.orderId)}`
          : undefined
        const paymentRes = await $fetch<{ ok: boolean; confirmationUrl?: string }>('/api/checkout/create', {
          method: 'POST',
          headers: shopIdFromRoute.value ? { 'x-shop-id': shopIdFromRoute.value } : undefined,
          body: {
            orderId: res.orderId,
            returnUrl,
          },
        })
        if (!paymentRes?.confirmationUrl) {
          throw new Error('Payment confirmation URL not received')
        }
        const data = serializeState()
        persistCheckoutStateCloud(data)
        cartStore.clear()
        if (isClient()) {
          localStorage.removeItem(checkoutStorageKey.value)
          window.location.href = paymentRes.confirmationUrl
        }
        return
      }

      const data = serializeState()
      persistCheckoutStateCloud(data)
      cartStore.clear()
      if (isClient()) {
        localStorage.removeItem(checkoutStorageKey.value)
      }
      await navigateTo({
        path: tenantPath('/orders'),
        query: {
          orderId: res.orderId ?? undefined,
          shop_id: shopIdFromRoute.value || undefined,
        },
      })
    } else if (isClient()) {
      window.alert('Не удалось оформить заказ. Попробуйте ещё раз.')
    }
  } catch (error: any) {
    const status = error?.statusCode || error?.status
    if (isClient() && !isTelegram.value && (status === 401 || status === 409)) {
      await navigateTo({
        path: '/link-telegram',
        query: { redirect: tenantPath('/checkout') },
      })
      return
    }
    if (isClient()) {
      window.alert('Ошибка при отправке заказа. Попробуйте ещё раз.')
    }
  } finally {
    isPlacing.value = false
  }
}

function authAndReturn() {
  if (!telegramBotUrl.value) return
  if (!isClient()) return
  const url = `${telegramBotUrl.value}?start=auth_link${shopIdFromRoute.value ? `_${encodeURIComponent(shopIdFromRoute.value)}` : ''}`
  window.open(url, '_blank', 'noopener')
}

async function continueInTelegramFromCheckout() {
  if (!cartStore.items.length) return

  try {
    const res = await $fetch<{ ok: boolean; deepLink: string }>('/api/cart-bridge', {
      method: 'POST',
      headers: shopIdFromRoute.value ? { 'x-shop-id': shopIdFromRoute.value } : undefined,
      body: {
        items: cartStore.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      },
    })

    if (res?.ok && res.deepLink) {
      if (isClient()) {
        window.location.href = res.deepLink
      }
    } else if (isClient()) {
      window.alert('Не удалось подготовить корзину для Telegram. Попробуйте ещё раз.')
    }
  } catch {
    if (isClient()) {
      window.alert('Ошибка при подготовке корзины для Telegram. Попробуйте ещё раз.')
    }
  }
}
</script>

<style scoped>
.bottom-bar-enter-active,
.bottom-bar-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.bottom-bar-enter-from,
.bottom-bar-leave-to {
  opacity: 0;
  transform: translateY(14px);
}

.step-forward-enter-active,
.step-forward-leave-active,
.step-backward-enter-active,
.step-backward-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.step-forward-enter-from,
.step-backward-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

.step-forward-leave-to,
.step-backward-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}

.themed-input::placeholder {
  color: var(--input-placeholder-color);
}
</style>

