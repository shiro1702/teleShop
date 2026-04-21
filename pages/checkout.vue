<template>
  <div class="min-h-screen" :style="pageStyle">
    <div class="pointer-events-none fixed inset-x-0 top-20 z-[95] mx-auto flex w-full max-w-md flex-col gap-2 px-4">
      <TransitionGroup name="toast">
        <div
          v-for="toast in promoToasts"
          :key="toast.id"
          class="pointer-events-auto rounded-lg border px-3 py-2 text-sm shadow-lg"
          :class="toast.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'"
        >
          {{ toast.message }}
        </div>
      </TransitionGroup>
    </div>
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
                <TransitionGroup name="cart-item" tag="div" class="space-y-4">
                <CartItem
                  v-for="item in cartStore.items"
                  :key="item.cartItemId"
                  :item="item"
                  @edit="openEditItemModal"
                />
                </TransitionGroup>
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
                  <div class="mt-1 flex gap-2 flex-row">
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
                <Transition name="collapse-fade" mode="out-in">
                  <p
                    v-if="promoError || promoSuccess"
                    :key="promoError ? `promo-error-${promoError}` : `promo-success-${promoSuccess}`"
                    class="text-sm"
                    :class="promoError ? 'text-red-600' : 'text-emerald-700'"
                  >
                    {{ promoError || promoSuccess }}
                  </p>
                </Transition>
                <div v-if="isAuthorizedForOrder" class="text-sm">
                  <div
                    v-if="loyaltyBalance === null"
                    class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs"
                    :style="{ borderColor: borderColor, color: mutedTextColor }"
                  >
                    <span>Не удалось загрузить бонусный баланс. Обновите данные или войдите заново.</span>
                    <button
                      type="button"
                      class="shrink-0 rounded-md border px-2 py-1 text-xs font-medium"
                      :style="{ borderColor: borderColor, color: mainTextColor }"
                      @click="void loadLoyaltyBalance({ force: true })"
                    >
                      Обновить
                    </button>
                  </div>
                  <div v-else-if="promoPreview?.bonusesEnabled === false" class="text-xs" :style="{ color: mutedTextColor }">
                    Бонусная программа временно отключена в настройках ресторана.
                  </div>
                  <template v-else-if="hasSpendableBonuses">
                    <CheckoutBonusSpendSlider
                      v-model="bonusToSpend"
                      :max="maxBonusAvailable"
                      :disabled="isPromoPreviewLoading"
                      :primary-color="theme.primary || 'var(--color-primary)'"
                      :muted-text-color="mutedTextColor"
                      :main-text-color="mainTextColor"
                      @commit="onBonusSliderCommit"
                    />
                  </template>
                  <p
                    v-if="hasSpendableBonuses && bonusEarnBlockedBySpend"
                    class="mt-2 text-xs"
                    :style="{ color: mutedTextColor }"
                  >
                    При списании бонусов в этом ресторане начисление по заказу отключено.
                  </p>
                  <p v-if="!hasSpendableBonuses" class="text-xs" :style="{ color: mutedTextColor }">
                    Бонусов для списания нет.
                  </p>
                </div>
                <p v-else class="text-xs" :style="{ color: mutedTextColor }">
                  Войдите в аккаунт, чтобы списывать бонусы в заказе.
                </p>
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
              <div
                v-if="deliveryProgress"
                class="rounded-2xl p-4 sm:p-5"
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
              <p v-if="upsellError" class="text-xs text-amber-700">
                {{ upsellError }}
              </p>
              <p v-else-if="isUpsellLoading && !upsellItems.length" class="text-xs" :style="{ color: mutedTextColor }">
                Подбираем рекомендации...
              </p>
              <CartUpsellStrip
                v-if="upsellItems.length > 0"
                :items="upsellItems"
                :loading-item-ids="upsellAddingItemIds"
                :remaining-rub="upsellRemainingRub"
                :border-color="borderColor"
                :main-text-color="mainTextColor"
                :muted-text-color="mutedTextColor"
                @add="onUpsellAdd"
              />
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
          </section>

          <!-- Шаг 2: оформление (получение + адрес + оплата + подтверждение) -->
          <section v-else key="checkout-step-2">
          <div class="rounded-2xl p-4 sm:p-6" :style="cardStyle">
            <div class="space-y-3">
              <section class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
                <h2 class="text-sm font-semibold text-gray-900">
                  Способ получения
                </h2>
                <p
                  v-if="!restaurantsLoaded"
                  class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  Загружаем филиалы и доступные способы получения...
                </p>
                <p
                  v-else-if="restaurants.length === 0"
                  class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                  Для этого ресторана пока не настроены активные филиалы. Выберите другой магазин или проверьте настройки филиалов.
                </p>
                <p
                  v-else-if="availableFulfillmentTypes.length === 0"
                  class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  Для этого магазина сейчас не настроены способы получения.
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
                    class="flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium leading-tight transition sm:px-3 sm:py-2 sm:text-sm"
                    :class="state.fulfillmentType === 'delivery'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'"
                    @click="setFulfillmentTypeByUser('delivery')"
                  >
                    Доставка
                  </button>
                  <button
                    v-if="hasPickupOption"
                    type="button"
                    class="flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium leading-tight transition sm:px-3 sm:py-2 sm:text-sm"
                    :class="state.fulfillmentType === 'pickup'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'"
                    @click="setFulfillmentTypeByUser('pickup')"
                  >
                    Самовывоз
                  </button>
                  <button
                    v-if="hasQrMenuOption"
                    type="button"
                    class="flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium leading-tight transition sm:px-3 sm:py-2 sm:text-sm"
                    :class="state.fulfillmentType === 'qr-menu'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'"
                    @click="setFulfillmentTypeByUser('qr-menu')"
                  >
                    В&nbsp;ресторане
                  </button>
                </div>
              </section>

              <div
                v-if="hasDeliveryOption && state.fulfillmentType === 'delivery'"
                class="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4"
              >
                <div class="flex items-center justify-between gap-2">
                  <button
                    v-if="selectedAddress"
                    type="button"
                    class="truncate text-left text-sm font-medium text-gray-900 hover:text-primary"
                    @click="openSavedAddressesModal"
                  >
                    Текущий адрес: {{ selectedAddress.address }}
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary transition hover:bg-primary-600"
                    @click="openNewAddressModal"
                  >
                    Ввести новый
                  </button>
                </div>
                <p class="text-xs font-medium text-gray-500">
                  Ранее использованные адреса
                </p>
                <div v-if="savedAddresses.length" class="flex flex-wrap gap-2">
                  <button
                    v-for="addr in savedAddresses"
                    :key="addr.id"
                    type="button"
                    class="group flex items-center gap-1 rounded-full border px-4 py-2 text-sm transition"
                    :class="addr.id === selectedCustomerAddressId
                      ? 'border-primary bg-primary-50 text-gray-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-primary hover:bg-primary-50'"
                    @click="applySavedAddressAndResolve(addr)"
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
                <p v-else class="text-xs text-gray-500">
                  Сохраненных адресов пока нет.
                </p>
              </div>

              <p
                v-if="hasDeliveryOption && state.fulfillmentType === 'delivery' && cartStore.deliverySummary.message"
                class="text-xs text-gray-500"
              >
                {{ cartStore.deliverySummary.message }}
              </p>
              <p
                v-if="hasDeliveryOption && state.fulfillmentType === 'delivery' && branchResolveInfo"
                class="text-xs text-amber-800/90"
              >
                {{ branchResolveInfo }}
              </p>
              <p
                v-if="hasDeliveryOption && state.fulfillmentType === 'delivery' && isResolvingDeliveryFromServer"
                class="text-xs text-gray-500"
              >
                Проверяем зону...
              </p>

              <section
                v-else-if="hasPickupOption && state.fulfillmentType === 'pickup'"
                class="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 sm:p-4"
              >
                <p class="font-medium">
                  {{ fulfillmentScenarioTitle }}
                </p>
                <p>
                  {{ fulfillmentScenarioDescription }}
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

              </section>

              <section
                v-else-if="hasQrMenuOption && state.fulfillmentType === 'qr-menu'"
                class="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4"
              >
                <p class="font-medium">
                  {{ fulfillmentScenarioTitle }}
                </p>
                <p class="text-amber-900/80">
                  {{ fulfillmentScenarioDescription }}
                </p>
              </section>

              <section class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div class="space-y-2">
                  <h2 class="text-sm font-semibold text-gray-900">
                    Ресторан
                  </h2>
                  <p v-if="restaurants.length > 0" class="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {{ currentRestaurantModeLabel }}
                  </p>
                  <p
                    v-if="!restaurantsLoaded"
                    class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  >
                    Загружаем список филиалов...
                  </p>
                  <p
                    v-else-if="restaurants.length === 0"
                    class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                  >
                    Нет активных филиалов с адресом и картой для оформления заказа.
                  </p>
                  <div v-if="restaurants.length > 0" class="grid gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
                    <div class="order-2 space-y-2 lg:order-1">
                      <div
                        v-for="branch in restaurants"
                        :key="branch.id"
                        class="rounded-xl border px-3 py-3 text-sm"
                        :class="branchCardClass(branch)"
                        @click="handleBranchCardClick(branch.id)"
                      >
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <p class="font-medium text-gray-900">
                              {{ branch.name }}
                            </p>
                            <p class="text-xs text-gray-600">
                              {{ branch.address || 'Адрес филиала пока не указан' }}
                            </p>
                          </div>
                          <button
                            type="button"
                            class="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium transition"
                            :class="branchSelectButtonClass(branch)"
                            :disabled="!branchSupportsCurrentFulfillment(branch)"
                            @click.stop="handleBranchCardClick(branch.id)"
                            tabindex="-1"
                          >
                            {{
                              branch.id === selectedRestaurantId
                                ? 'Выбран'
                                : branchSupportsCurrentFulfillment(branch)
                                  ? 'Выбрать'
                                  : 'Недоступен'
                            }}
                          </button>
                        </div>
                        <div class="mt-2 flex flex-wrap gap-2">
                          <span
                            v-if="branch.supports_delivery"
                            class="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
                          >
                            Доставка
                          </span>
                          <span
                            v-if="branch.supports_pickup"
                            class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                          >
                            Самовывоз
                          </span>
                          <span
                            v-if="branch.supports_qr_menu"
                            class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                          >
                            В ресторане
                          </span>
                          <span
                            v-if="!branch.supports_delivery && !branch.supports_pickup && !branch.supports_qr_menu"
                            class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                          >
                            Способы получения не настроены
                          </span>
                          <span
                            v-else-if="!branchSupportsCurrentFulfillment(branch)"
                            class="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
                          >
                            Недоступен для режима «{{ summaryDeliveryLabel }}»
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="order-1 rounded-lg border border-gray-200 bg-white p-2 lg:order-2 lg:sticky lg:top-4">
                      <CheckoutDeliveryBranchesMap
                        :branches="restaurants"
                        :all-zones="allRestaurantZones"
                        :selected-branch-id="selectedRestaurantId"
                        :allow-manual-select="false"
                        :client-lat="mapClientLat"
                        :client-lon="mapClientLon"
                        :client-address="mapClientAddress"
                      />
                    </div>
                  </div>
                </div>
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
                <Transition name="collapse-fade">
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
                </Transition>
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
                <template v-else>
                  <button
                    type="button"
                    class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
                    :disabled="!isRestaurantOpenNow"
                    @click="openAuthModal('auth')"
                  >
                    Авторизоваться и оформить
                  </button>
                  <button
                    type="button"
                    class="w-full rounded-lg border border-primary px-4 py-3 text-base font-medium text-primary transition hover:bg-primary-50 active:bg-primary-100 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 sm:w-auto"
                    :disabled="!isRestaurantOpenNow"
                    @click="openAuthModal('continue')"
                  >
                    Продолжить в боте
                  </button>
                </template>
                <p v-if="!isRestaurantOpenNow" class="text-xs text-red-600">
                  Ресторан сейчас закрыт. Оформление заказа недоступно.
                </p>
                <p v-if="state.fulfillmentType === 'delivery' && isResolvingDeliveryFromServer" class="text-xs text-gray-500">
                  Проверяем зону...
                </p>
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
        :class="isMessengerMiniApp ? 'pb-20' : ''"
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
            class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            :disabled="!isRestaurantOpenNow"
            @click="openAuthModal('auth')"
          >
            Авторизоваться и оформить
          </button>
          <button
            type="button"
            class="w-full rounded-lg border border-primary px-4 py-3 text-base font-medium text-primary transition hover:bg-primary-50 active:bg-primary-100 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
            :disabled="!isRestaurantOpenNow"
            @click="openAuthModal('continue')"
          >
            Продолжить в боте
          </button>
        </template>
        <p v-if="!isRestaurantOpenNow" class="text-xs text-red-600">
          Ресторан сейчас закрыт. Оформление заказа недоступно.
        </p>
        <p v-if="state.fulfillmentType === 'delivery' && isResolvingDeliveryFromServer" class="text-xs text-gray-500">
          Проверяем зону...
        </p>
      </div>
      </div>
    </Transition>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showAuthModal" class="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/40" @click="closeAuthModal" />
          <div class="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-xl modal-panel">
            <h3 class="text-base font-semibold text-gray-900">Выберите способ входа</h3>
            <p class="mt-1 text-sm text-gray-600">
              {{ authModalMode === 'auth' ? 'Авторизация для оформления заказа.' : 'Продолжение в выбранном боте.' }}
            </p>
            <div class="mt-4 space-y-2">
              <button v-if="telegramBotUrl" type="button" class="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white" @click="runAuthAction('telegram')">
                {{ authModalMode === 'auth' ? 'Войти через Telegram' : 'Продолжить в Telegram' }}
              </button>
              <button v-if="maxBotUrl" type="button" class="w-full rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary" @click="runAuthAction('max')">
                {{ authModalMode === 'auth' ? 'Войти через MAX' : 'Продолжить в MAX' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <CheckoutDeliveryAddressModal
      v-model="showAddressModal"
      :addresses="savedAddresses"
      :initial-tab="addressModalInitialTab"
      :selected-address-id="selectedCustomerAddressId"
      :address-line="addressLine"
      :flat="flat"
      :comment="comment"
      :suggest-items="suggestItems"
      :is-suggest-loading="isSuggestLoading"
      :branches="restaurants"
      :all-zones="allRestaurantZones"
      :selected-branch-id="selectedRestaurantId"
      :allow-manual-branch-select="state.fulfillmentType !== 'delivery'"
      :client-lat="mapClientLat"
      :client-lon="mapClientLon"
      :client-address="mapClientAddress"
      @pick-address="handleAddressPickFromModal"
      @address-input="onAddressInput"
      @pick-suggestion="selectSuggestion"
      @save-new="saveAddressFromModal"
      @update:address-line="onModalAddressLineInput"
      @update:flat="flat = $event"
      @update:comment="comment = $event"
      @select-branch="handleBranchPickFromMap"
    />
    <Teleport to="body">
      <Transition name="product">
        <div
          v-if="editingItemProduct"
          class="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div class="absolute inset-0" @click="closeEditItemModal" />
          <div
            class="relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-t-2xl shadow-xl sm:rounded-2xl flex flex-col"
            :style="cardStyle"
          >
            <button
              type="button"
              class="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
              aria-label="Закрыть"
              @click="closeEditItemModal"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div class="h-48 w-full shrink-0 overflow-hidden sm:h-56" :style="{ backgroundColor: cardBgColor }">
              <img :src="editingItemProduct.image" :alt="editingItemProduct.name" class="h-full w-full object-cover">
            </div>
            <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div>
                <h2 class="text-lg font-semibold sm:text-xl" :style="{ color: mainTextColor }">{{ editingItemProduct.name }}</h2>
                <p v-if="editingItemProduct.description" class="mt-1 text-sm" :style="{ color: mutedTextColor }">
                  {{ editingItemProduct.description }}
                </p>
              </div>
              <div v-if="editingItemProduct.parameters?.length" class="space-y-4 pt-2">
                <div v-for="group in editingItemProduct.parameters" :key="group.id" class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h3 class="font-medium text-sm" :style="{ color: mainTextColor }">{{ group.name }}</h3>
                    <span v-if="group.isRequired" class="text-[10px] uppercase tracking-wider text-red-500 font-semibold bg-red-50 px-2 py-0.5 rounded">Обязательно</span>
                  </div>
                  <div class="flex flex-wrap gap-2 w-full">
                    <label
                      v-for="opt in group.options"
                      :key="opt.id"
                      class="relative flex-1 min-w-[80px] flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors text-center"
                      :style="{
                        borderColor: isEditParameterSelected(group.id, opt.id) ? 'var(--color-primary)' : borderColor,
                        backgroundColor: isEditParameterSelected(group.id, opt.id) ? 'var(--color-primary)' : 'transparent',
                        color: isEditParameterSelected(group.id, opt.id) ? '#ffffff' : mainTextColor
                      }"
                    >
                      <input type="radio" :name="`edit-param-${group.id}`" :checked="isEditParameterSelected(group.id, opt.id)" class="sr-only" @change="toggleEditParameter(group.id, opt.id)">
                      <div class="flex flex-col items-center">
                        <span class="text-sm font-medium">{{ opt.name }}</span>
                        <span class="text-xs opacity-80">{{ formatPrice(opt.price || 0) }}</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              <div v-if="editingItemProduct.modifiers?.length" class="space-y-4 pt-2">
                <div v-for="group in editingItemProduct.modifiers" :key="group.id" class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h3 class="font-medium text-sm" :style="{ color: mainTextColor }">{{ group.name }}</h3>
                    <span v-if="group.isRequired" class="text-[10px] uppercase tracking-wider text-red-500 font-semibold bg-red-50 px-2 py-0.5 rounded">Обязательно</span>
                  </div>
                  <div class="flex flex-wrap gap-2 w-full">
                    <label
                      v-for="opt in group.options"
                      :key="opt.id"
                      class="relative flex-1 min-w-[80px] flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors text-center"
                      :style="{
                        borderColor: isEditOptionSelected(group.id, opt.id) ? 'var(--color-primary)' : borderColor,
                        backgroundColor: isEditOptionSelected(group.id, opt.id) ? 'var(--color-primary)' : 'transparent',
                        color: isEditOptionSelected(group.id, opt.id) ? '#ffffff' : mainTextColor
                      }"
                    >
                      <input
                        :type="group.selectionType === 'multi' ? 'checkbox' : 'radio'"
                        :name="`edit-group-${group.id}`"
                        :checked="isEditOptionSelected(group.id, opt.id)"
                        class="sr-only"
                        @change="toggleEditOption(group, opt)"
                      >
                      <span class="text-sm font-medium">{{ opt.name }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div class="shrink-0 border-t p-4 sm:p-5" :style="{ borderColor, backgroundColor: cardBgColor }">
              <button
                type="button"
                class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                :disabled="!isEditModifiersValid"
                @click="saveEditedItem"
              >
                <span>{{ isEditModifiersValid ? 'Сохранить' : 'Выберите опции' }}</span>
                <span v-if="isEditModifiersValid" class="font-bold">{{ formatPrice(editingItemPrice) }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCheckoutAddress } from '~/composables/useCheckoutAddress'
import { useCheckoutTenantRestaurants } from '~/composables/useCheckoutTenantRestaurants'
import type { DineInHallMode, FulfillmentType } from '~/composables/useCheckoutTenantRestaurants'
import { useMessengerStorage } from '~/composables/useMessengerStorage'
import {
  clearOrderContinuationHint,
  readOrderContinuationHint,
} from '~/composables/useTelegram'
import { readShopIdFromQuery, resolveCartScopeKey } from '~/utils/cartScope'
import {
  mapFulfillmentToCityMode,
  readCityFulfillmentMode,
  resolveFulfillmentByPreference,
  resolveFulfillmentScopeFromRoute,
  writeCityFulfillmentMode,
} from '~/utils/fulfillmentPreference'
import { buildDefaultCartSelections, findProductById } from '~/utils/storyCart'
import { useWorkingHoursStatus } from '~/composables/useWorkingHoursStatus'
import type { Product, ModifierGroup, ModifierOption } from '~/data/products'
import type { CartItem, SelectedModifier, SelectedParameter } from '~/stores/cart'
import CartUpsellStrip from '~/components/checkout/CartUpsellStrip.vue'

const cartStore = useCartStore()
const route = useRoute()
const router = useRouter()
const {
  isMessengerMiniApp,
  messengerInitData,
  messengerClientChannel,
  buildMessengerAuthHeaders,
  expandMessengerViewport,
} = useTelegram()
const { canUseMessengerStorage, setItem, getItem } = useMessengerStorage()
const supabaseUser = useSupabaseUser()
const config = useRuntimeConfig()
const { tenant, tenantKey, tenantPath } = useTenant()

const telegramBotName = (config.public.telegramBotName as string | undefined) || ''
const telegramBotUrl = computed(() =>
  telegramBotName ? `https://t.me/${telegramBotName}` : null,
)
const maxBotUrl = computed(() => {
  const raw = (config.public.maxBotUrl as string | undefined) || ''
  const trimmed = raw.trim()
  return trimmed || null
})
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
const pendingRestoredFulfillmentType = ref<FulfillmentType | null>(null)

const isPlacing = ref(false)
const promoCodeInput = ref('')
const appliedPromoCode = ref('')
const bonusToSpend = ref(0)
const promoPreview = ref<{
  ok?: boolean
  error?: string
  bonusesEnabled?: boolean
  allowSimultaneousBonusSpendAndEarn?: boolean
  bonusEarnBlockedBySpend?: boolean
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
const promoToasts = ref<Array<{ id: number; kind: 'success' | 'error'; message: string }>>([])
let promoToastSeq = 0
const loyaltyBalance = ref<number | null>(null)
const isPromoApplyLoading = ref(false)
const isPromoPreviewLoading = ref(false)
let promoPreviewSeq = 0
let promoPreviewTimer: ReturnType<typeof setTimeout> | null = null
type UpsellItem = {
  id: string
  name: string
  price: number
  image: string
  category: string
  canAddModifier?: boolean
}
const upsellItems = ref<UpsellItem[]>([])
const upsellError = ref('')
const isUpsellLoading = ref(false)
const upsellAddingItemIds = ref<string[]>([])
let upsellRequestSeq = 0
let upsellTimer: ReturnType<typeof setTimeout> | null = null
let upsellInFlightSignature: string | null = null
let upsellLastLoadedSignature: string | null = null

const changeFrom = ref<string>('')
const showClearCartModal = ref(false)
const showAddressModal = ref(false)
const addressModalInitialTab = ref<'saved' | 'new'>('new')
const hasShownAddressModalOnCurrentEntry = ref(false)
const step1InlineNavRef = ref<HTMLElement | null>(null)
const step2ActionsRef = ref<HTMLElement | null>(null)
const isStep1InlineNavVisible = ref(false)
const isStep2ActionsVisible = ref(false)
const stepDirection = ref<'forward' | 'backward'>('forward')
const showAuthModal = ref(false)
const authModalMode = ref<'auth' | 'continue'>('auth')
const branchResolveInfo = ref<string | null>(null)
const skipNextDeliveryZoneReset = ref(false)
const lastDeliveryCoords = ref<{ lat: number; lon: number } | null>(null)
const lastGeocodedAddressLine = ref('')
const isResolvingDeliveryFromServer = ref(false)
const deliveryResolveRequestSeq = ref(0)
const editingCartItemId = ref<string | null>(null)
const editingItemQuantity = ref(1)
const editingItemProduct = ref<Product | null>(null)
const editingModifiers = ref<Record<string, Set<string>>>({})
const editingParameters = ref<Record<string, string>>({})

const stepTransitionName = computed(() =>
  stepDirection.value === 'forward' ? 'step-forward' : 'step-backward',
)

const showBottomBar = computed(() => {
  if (!cartStore.items.length) return false
  if (state.currentStep === 1) return !isStep1InlineNavVisible.value
  return !isStep2ActionsVisible.value
})

/** Сначала slug/query из маршрута — стабильно при гидратации tenant; иначе смена tenantKey дублирует loadRestaurants/zones. */
const shopIdFromRoute = computed(() => {
  const fromRouteSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  const fromQuery = typeof route.query.shop_id === 'string' ? route.query.shop_id.trim() : ''
  const fromTenantState = typeof tenantKey.value === 'string' ? tenantKey.value.trim() : ''
  return fromRouteSlug || fromQuery || fromTenantState || null
})
/** Канонический идентификатор витрины для API: UUID из тенанта, иначе slug/query из маршрута. */
const checkoutXShopId = computed(() => {
  const fromTenant = typeof tenant.value.shopId === 'string' ? tenant.value.shopId.trim() : ''
  return fromTenant || shopIdFromRoute.value
})
function checkoutXShopIdHeaders(): { 'x-shop-id': string } | undefined {
  const id = checkoutXShopId.value
  return id ? { 'x-shop-id': id } : undefined
}
const hasTenantRouteContext = computed(() => {
  const tenantSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  return !!tenantSlug
})

if (!hasTenantRouteContext.value && !shopIdFromRoute.value) {
  throw createError({ statusCode: 404, statusMessage: 'Checkout route not found' })
}

function applyCartScope() {
  const scope = resolveFulfillmentScopeFromRoute(route, shopIdFromRoute.value)
  cartStore.setScope(scope)
  cartStore.adoptLegacyShopIdScopeIfEmpty(readShopIdFromQuery(route))
}

const citySlug = computed(() => {
  const raw = route.params.city_slug
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
})

function resolveCheckoutFulfillment(allowed: FulfillmentType[], current: FulfillmentType) {
  const resolved = resolveFulfillmentByPreference({
    allowed,
    preferred: pendingRestoredFulfillmentType.value,
    cityMode: readCityFulfillmentMode(citySlug.value),
    current,
  })
  if (resolved === pendingRestoredFulfillmentType.value) {
    pendingRestoredFulfillmentType.value = null
  }
  return resolved
}

function setFulfillmentTypeByUser(next: FulfillmentType) {
  if (!availableFulfillmentTypes.value.includes(next)) return
  state.fulfillmentType = next
  pendingRestoredFulfillmentType.value = null
  const cityMode = mapFulfillmentToCityMode(next)
  if (cityMode) {
    writeCityFulfillmentMode(citySlug.value, cityMode)
  }
}
applyCartScope()

// После полной гидрации маршрута (особенно hard refresh) повторно подхватываем scope/localStorage.
if (import.meta.client) {
  onMounted(() => {
    applyCartScope()
  })
}

const {
  addressLine,
  flat,
  comment,
  suggestItems,
  isSuggestLoading,
  savedAddresses,
  addressBookReady,
  selectedAddressId: selectedCustomerAddressId,
  selectedAddress,
  setDeliveryZones,
  refreshDeliveryZone,
  onAddressInput,
  selectSuggestion,
  selectSavedAddressById,
  saveAddress,
  saveCurrentAddress,
  deleteSavedAddress,
} = useCheckoutAddress({
  onGeocodedCoords: async (coords) => {
    await resolveDeliveryBranch(coords.lat, coords.lon)
  },
  getCurrentCoords: () => lastDeliveryCoords.value,
})

const {
  selectedPickupPointId,
  selectedRestaurantId,
  selectedPickupPoint,
  restaurants,
  restaurantsLoaded,
  restaurantZones,
  allRestaurantZones,
  pickupPoints,
  availableFulfillmentTypes,
  hasDeliveryOption,
  hasPickupOption,
  hasQrMenuOption,
  pickupIntroText,
  organizationTimezone,
  dineInHallMode,
  selectedRestaurantWorkingHours,
  getRestaurantFulfillmentTypes,
  loadRestaurants,
} = useCheckoutTenantRestaurants({
  shopIdFromRoute,
  pickupPointsConfigRaw,
  fulfillmentTypesConfigRaw,
  currentFulfillmentType: toRef(state, 'fulfillmentType'),
  setDeliveryZones,
  skipNextDeliveryZoneReset,
  resolveFallbackFulfillmentType: ({ allowed, current }) => resolveCheckoutFulfillment(allowed, current),
})

type DeliveryResolveApi = {
  ok: boolean
  reason?: string
  selected: null | {
    restaurantId: string
    restaurantName: string
    zone: {
      slug: string
      name: string
      minOrderAmount: number
      deliveryCost: number
      freeDeliveryThreshold: number
      priority?: number
    }
  }
  infoMessage?: string | null
}

function deliveryResolveReasonMessage(reason: string | undefined): string {
  switch (reason) {
    case 'out_of_zone':
      return 'Мы пока не доставляем по этому адресу'
    case 'all_closed':
      return 'Сейчас нет открытых филиалов с доставкой по этому адресу'
    case 'delivery_disabled':
      return 'Доставка не подключена для этого магазина'
    case 'no_restaurants':
      return 'Нет доступных филиалов для доставки'
    default:
      return 'Не удалось определить зону доставки'
  }
}

function normalizeCoord(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function getSavedAddressCoordsByLine(lineRaw: string): { lat: number; lon: number } | null {
  const line = lineRaw.trim().toLowerCase()
  if (!line) return null
  const found = savedAddresses.value.find((a: { address: string; lat?: unknown; lon?: unknown }) => a.address.trim().toLowerCase() === line)
  if (!found) return null
  const lat = normalizeCoord(found.lat)
  const lon = normalizeCoord(found.lon)
  if (lat == null || lon == null) return null
  return { lat, lon }
}

async function waitForRestaurantZonesLoaded(timeoutMs = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await nextTick()
    if (restaurantZones.value.length > 0) return true
    await new Promise<void>((r) => setTimeout(r, 30))
  }
  return restaurantZones.value.length > 0
}

async function resolveDeliveryBranch(lat: number, lon: number) {
  branchResolveInfo.value = null
  if (!shopIdFromRoute.value && !messengerInitData.value) return
  const requestSeq = ++deliveryResolveRequestSeq.value

  isResolvingDeliveryFromServer.value = true
  try {
    const res = await $fetch<DeliveryResolveApi>('/api/delivery-resolve', {
      method: 'POST',
      headers: buildMessengerAuthHeaders(
        checkoutXShopIdHeaders(),
      ),
      body: { lat, lon },
    })

    if (requestSeq !== deliveryResolveRequestSeq.value) return

    if (!res.selected) {
      lastDeliveryCoords.value = null
      cartStore.setDeliveryZone(null)
      cartStore.setDeliveryError(deliveryResolveReasonMessage(res?.reason))
      return
    }

    branchResolveInfo.value = typeof res.infoMessage === 'string' && res.infoMessage.trim()
      ? res.infoMessage.trim()
      : null

    lastDeliveryCoords.value = { lat, lon }
    lastGeocodedAddressLine.value = addressLine.value.trim()

    cartStore.setDeliveryError(null)
    // Apply server-selected zone immediately so checkout button updates without waiting
    // for client-side restaurant zones reload.
    cartStore.setDeliveryZone(res.selected.zone)
    skipNextDeliveryZoneReset.value = true
    selectedRestaurantId.value = res.selected.restaurantId
  } catch {
    if (requestSeq !== deliveryResolveRequestSeq.value) return
    lastDeliveryCoords.value = null
    cartStore.setDeliveryZone(null)
    cartStore.setDeliveryError('Не удалось рассчитать доставку')
  } finally {
    if (requestSeq === deliveryResolveRequestSeq.value) {
      isResolvingDeliveryFromServer.value = false
    }
  }
}

watch(selectedRestaurantId, async (id, prev) => {
  if (isResolvingDeliveryFromServer.value) return
  if (!id || !prev || id === prev) return
  if (state.fulfillmentType !== 'delivery') return
  const currentAddress = addressLine.value.trim()
  if (!lastDeliveryCoords.value || !currentAddress || currentAddress !== lastGeocodedAddressLine.value) {
    if (currentAddress.length >= 3) {
      cartStore.setDeliveryZone(null)
      cartStore.setDeliveryError('Выберите адрес из подсказки или сохраненный адрес, чтобы рассчитать доставку')
    }
    return
  }
  // Не сбрасываем в "Укажите адрес...", если пересчитываем по уже подтвержденному адресу.
  skipNextDeliveryZoneReset.value = true
  await nextTick()
  await waitForRestaurantZonesLoaded()
  refreshDeliveryZone(lastDeliveryCoords.value.lat, lastDeliveryCoords.value.lon)
})

watch(addressLine, (next) => {
  const trimmed = next.trim()
  if (!trimmed) {
    lastDeliveryCoords.value = null
    lastGeocodedAddressLine.value = ''
    if (state.fulfillmentType === 'delivery') {
      cartStore.setDeliveryZone(null)
      cartStore.setDeliveryError('Выберите адрес из подсказки или сохраненный адрес, чтобы рассчитать доставку')
    }
    return
  }
  if (trimmed !== lastGeocodedAddressLine.value) {
    lastDeliveryCoords.value = null
    if (state.fulfillmentType === 'delivery') {
      cartStore.setDeliveryZone(null)
      cartStore.setDeliveryError('Выберите адрес из подсказки или сохраненный адрес, чтобы рассчитать доставку')
    }
  }
})

watch(
  () =>
    [
      state.currentStep,
      state.fulfillmentType,
      hasDeliveryOption.value,
      addressBookReady.value,
      savedAddresses.value.length,
      selectedCustomerAddressId.value,
      addressLine.value,
      selectedAddress.value?.address,
    ] as const,
  ([step, fulfillment, hasDelivery, bookReady, savedCount, addressId]) => {
    if (step !== 2) {
      hasShownAddressModalOnCurrentEntry.value = false
      return
    }
    if (!hasDelivery) return
    if (fulfillment !== 'delivery') return
    if (hasShownAddressModalOnCurrentEntry.value) return
    if (!bookReady) return
    if (savedCount > 0) {
      hasShownAddressModalOnCurrentEntry.value = true
      showAddressModal.value = false
      return
    }
    if (addressId && addressLine.value.trim().length > 0) {
      hasShownAddressModalOnCurrentEntry.value = true
      return
    }
    hasShownAddressModalOnCurrentEntry.value = true
    showAddressModal.value = true
  },
  { immediate: true },
)

watch(
  () => [state.fulfillmentType, selectedCustomerAddressId.value, selectedAddress.value?.lat, selectedAddress.value?.lon] as const,
  async ([fulfillment, addressId, latRaw, lonRaw]) => {
    if (fulfillment !== 'delivery') return
    if (!addressId) return
    if (isResolvingDeliveryFromServer.value) return
    if (cartStore.deliveryZone) return
    const lat = normalizeCoord(latRaw)
    const lon = normalizeCoord(lonRaw)
    if (lat == null || lon == null) return
    await resolveDeliveryBranch(lat, lon)
  },
  { immediate: true },
)

async function applySavedAddressAndResolve(addr: { id: string; address: string; flat?: string; comment?: string; lat?: unknown; lon?: unknown }) {
  selectSavedAddressById(addr.id)
  const lat = normalizeCoord(addr.lat)
  const lon = normalizeCoord(addr.lon)
  if (lat != null && lon != null) {
    await resolveDeliveryBranch(lat, lon)
    return
  }
  // Fallback for legacy saved addresses without coordinates.
  try {
    const geo = await $fetch<{ ok?: boolean; lat?: number; lon?: number }>('/api/geocode', {
      query: { q: addr.address },
    })
    if (geo?.ok && typeof geo.lat === 'number' && typeof geo.lon === 'number') {
      await resolveDeliveryBranch(geo.lat, geo.lon)
      await saveAddress({
        addressLine: addr.address,
        flat: addr.flat ?? null,
        comment: addr.comment ?? null,
        lat: geo.lat,
        lon: geo.lon,
      })
      return
    }
  } catch {
    // ignore geocode error and show validation message below
  }
  cartStore.setDeliveryZone(null)
  cartStore.setDeliveryError('Не удалось определить координаты адреса. Выберите адрес из подсказки или введите новый.')
}

async function handleAddressPickFromModal(addressId: string) {
  const addr = savedAddresses.value.find((x) => x.id === addressId)
  if (!addr) return
  await applySavedAddressAndResolve(addr)
}

async function saveAddressFromModal() {
  const line = addressLine.value.trim()
  if (line.length < 3) return
  let lat: number | null = null
  let lon: number | null = null
  const resolvedCoords = line === lastGeocodedAddressLine.value ? lastDeliveryCoords.value : null
  if (resolvedCoords) {
    lat = resolvedCoords.lat
    lon = resolvedCoords.lon
  } else {
    try {
      const geo = await $fetch<{ ok?: boolean; lat?: number; lon?: number }>('/api/geocode', {
        query: { q: line },
      })
      if (geo?.ok && typeof geo.lat === 'number' && typeof geo.lon === 'number') {
        lat = geo.lat
        lon = geo.lon
      }
    } catch {
      // ignore geocode error, keep nullable coords
    }
  }

  const saved = await saveAddress({
    addressLine: line,
    flat: flat.value || null,
    comment: comment.value || null,
    lat,
    lon,
  })
  showAddressModal.value = false
  const savedLat = normalizeCoord(saved?.lat)
  const savedLon = normalizeCoord(saved?.lon)
  if (savedLat != null && savedLon != null) {
    await resolveDeliveryBranch(savedLat, savedLon)
  }
}

function handleBranchPickFromMap(branchId: string) {
  if (!restaurants.value.some((r) => r.id === branchId)) return
  const branch = restaurants.value.find((r) => r.id === branchId) ?? null
  if (!branchSupportsCurrentFulfillment(branch)) return
  selectedRestaurantId.value = branchId
}

function branchSupportsFulfillment(
  branch: (typeof restaurants.value)[number] | null | undefined,
  fulfillment: FulfillmentType,
) {
  return getRestaurantFulfillmentTypes(branch ?? null).includes(fulfillment)
}

function branchSupportsCurrentFulfillment(branch: (typeof restaurants.value)[number] | null | undefined) {
  return branchSupportsFulfillment(branch, state.fulfillmentType)
}

function handleBranchCardClick(branchId: string) {
  handleBranchPickFromMap(branchId)
}

function branchCardClass(branch: (typeof restaurants.value)[number]) {
  const isSelected = branch.id === selectedRestaurantId.value
  const isEnabled = branchSupportsCurrentFulfillment(branch)
  if (!isEnabled) {
    return 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
  }
  if (isSelected) {
    return 'border-primary bg-primary-50 cursor-pointer'
  }
  return 'border-gray-200 bg-white cursor-pointer hover:border-primary hover:bg-primary-50'
}

function branchSelectButtonClass(branch: (typeof restaurants.value)[number]) {
  const isSelected = branch.id === selectedRestaurantId.value
  const isEnabled = branchSupportsCurrentFulfillment(branch)
  if (!isEnabled) {
    return 'border-gray-200 text-gray-400 cursor-not-allowed'
  }
  if (isSelected) {
    return 'border-primary bg-white text-primary'
  }
  return 'text-gray-700 hover:border-primary hover:text-primary'
}

function onModalAddressLineInput(value: string) {
  addressLine.value = value
  if (selectedCustomerAddressId.value && value.trim() !== selectedAddress.value?.address?.trim()) {
    selectedCustomerAddressId.value = ''
  }
}

function openSavedAddressesModal() {
  addressModalInitialTab.value = 'saved'
  showAddressModal.value = true
}

function openNewAddressModal() {
  addressModalInitialTab.value = 'new'
  addressLine.value = ''
  flat.value = ''
  comment.value = ''
  lastDeliveryCoords.value = null
  lastGeocodedAddressLine.value = ''
  cartStore.setDeliveryZone(null)
  cartStore.setDeliveryError('Выберите адрес из подсказки, чтобы рассчитать доставку')
  showAddressModal.value = true
}

const mapClientLat = computed(() => {
  if (lastDeliveryCoords.value?.lat != null) return lastDeliveryCoords.value.lat
  const byAddressLine = getSavedAddressCoordsByLine(addressLine.value)
  if (byAddressLine) return byAddressLine.lat
  const selectedLat = normalizeCoord(selectedAddress.value?.lat)
  if (selectedLat != null) return selectedLat
  return null
})

const mapClientLon = computed(() => {
  if (lastDeliveryCoords.value?.lon != null) return lastDeliveryCoords.value.lon
  const byAddressLine = getSavedAddressCoordsByLine(addressLine.value)
  if (byAddressLine) return byAddressLine.lon
  const selectedLon = normalizeCoord(selectedAddress.value?.lon)
  if (selectedLon != null) return selectedLon
  return null
})

const mapClientAddress = computed(() => {
  const line = addressLine.value.trim()
  if (line) return line
  return selectedAddress.value?.address ?? null
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
  const deliveryZone = cartStore.deliveryZone
  const hasResolvedZone = !!deliveryZone && !cartStore.deliveryError
  const meetsMinOrder = !!deliveryZone && cartStore.total >= deliveryZone.minOrderAmount
  const hasDeliveryAddress = addressLine.value.trim().length >= 3 || !!selectedAddress.value?.address?.trim()
  return (
    hasDeliveryOption.value &&
    hasResolvedZone &&
    meetsMinOrder &&
    hasDeliveryAddress &&
    hasAllRequiredParameterSelections.value
  )
})
const workingHoursStatusCacheKey = computed(() => {
  const shopRef = shopIdFromRoute.value || 'unknown'
  const restaurantRef = selectedRestaurantId.value || 'default'
  return `checkout:${shopRef}:${restaurantRef}`
})
const { isOpenNow: isRestaurantOpenNow } = useWorkingHoursStatus({
  workingHours: selectedRestaurantWorkingHours as any,
  timezone: organizationTimezone,
  cacheKey: workingHoursStatusCacheKey,
  defaultIsOpenWhenNoSchedule: true,
})
const canPlaceOrder = computed(() =>
  !isPlacing.value && !!cartStore.items.length && !!canGoToSummary.value && isRestaurantOpenNow.value,
)

const currentRestaurantModeLabel = computed(() =>
  state.fulfillmentType === 'pickup'
    ? 'заберу тут'
    : state.fulfillmentType === 'qr-menu'
      ? 'буду есть тут'
      : 'доставим отсюда',
)

const summaryDeliveryLabel = computed(() =>
  state.fulfillmentType === 'pickup'
    ? 'Самовывоз'
    : state.fulfillmentType === 'qr-menu'
      ? 'В\u00A0ресторане'
      : 'Доставка',
)

const fulfillmentScenarioTitle = computed(() =>
  state.fulfillmentType === 'pickup'
    ? 'Как пройдёт самовывоз'
    : state.fulfillmentType === 'qr-menu'
      ? 'Как пройдёт заказ в ресторане'
      : 'Как пройдёт доставка',
)

const fulfillmentScenarioDescription = computed(() => {
  if (state.fulfillmentType === 'pickup') {
    return 'Сделайте заказ и заберите его в выбранном филиале. Мы подготовим заказ и отправим подтверждение, когда можно будет подходить.'
  }
  if (state.fulfillmentType === 'qr-menu') {
    if (dineInHallMode.value === 'pickup-point') {
      return 'Сделайте заказ для этого филиала, а дальше мы передадим его в работу в ресторан. Когда заказ будет готов, вы сможете забрать его в зоне выдачи.'
    }
    if (dineInHallMode.value === 'to-table') {
      return 'Сделайте заказ для этого филиала, а дальше мы передадим его в работу в ресторан. Когда заказ будет готов, его принесут к вашему столику.'
    }
    return 'Сделайте заказ для этого филиала, а дальше мы передадим его в работу в ресторан.'
  }
  return 'Укажите адрес доставки, а мы определим подходящий филиал и рассчитаем условия доставки для вашего заказа.'
})

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
const effectiveBonusToSpend = computed(() => {
  if (!isAuthorizedForOrder.value) return 0
  if (!hasSpendableBonuses.value) return 0
  const normalized = Number.isFinite(bonusToSpend.value) ? Math.floor(bonusToSpend.value) : 0
  return Math.max(0, Math.min(normalized, maxBonusAvailable.value))
})
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
const bonusEarnBlockedBySpend = computed(() =>
  promoPreview.value?.ok === true && promoPreview.value?.bonusEarnBlockedBySpend === true,
)
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

const upsellRemainingRub = computed(() => {
  const remaining = deliveryProgress.value?.remaining
  if (typeof remaining !== 'number' || !Number.isFinite(remaining) || remaining <= 0) return null
  return Math.floor(remaining)
})
const upsellRestaurantId = computed(() =>
  selectedRestaurantId.value
  || selectedPickupPointId.value
  || restaurants.value[0]?.id
  || '',
)

async function runUpsellRecommendations() {
  const signature = upsellRequestSignature.value
  if (signature && (signature === upsellInFlightSignature || signature === upsellLastLoadedSignature)) {
    return
  }
  const requestSeq = ++upsellRequestSeq
  upsellError.value = ''
  if (!cartStore.items.length) {
    upsellItems.value = []
    isUpsellLoading.value = false
    upsellLastLoadedSignature = null
    upsellInFlightSignature = null
    return
  }
  if (!upsellRestaurantId.value) {
    isUpsellLoading.value = false
    return
  }

  isUpsellLoading.value = true
  upsellInFlightSignature = signature
  try {
    const res = await $fetch<{
      ok: boolean
      error?: string
      items?: Array<{
        id: string
        name: string
        price: number
        image?: string
        category?: string
      }>
    }>('/api/cart/recommendations', {
      method: 'POST',
      headers: checkoutXShopIdHeaders(),
      body: {
        restaurantId: upsellRestaurantId.value,
        fulfillmentType: state.fulfillmentType,
        cartProductIds: cartStore.items.map((item) => item.id),
        remainingToFreeDeliveryRub: upsellRemainingRub.value,
        limit: 6,
      },
    })

    if (requestSeq !== upsellRequestSeq) return
    if (!res?.ok) {
      upsellError.value = res?.error || 'Не удалось загрузить рекомендации'
      return
    }

    upsellItems.value = (res.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image || '',
      category: item.category || 'Без категории',
      canAddModifier: cartStore.items.some((cartItem: CartItem) =>
        cartItem.id === item.id
        && (cartItem.selectedModifiers?.length ?? 0) === 0
        && Boolean(
          cartStore.products.find((p: Product) => p.id === item.id)?.modifiers?.length,
        ),
      ),
    }))
    upsellLastLoadedSignature = signature
  } catch (error: any) {
    if (requestSeq !== upsellRequestSeq) return
    upsellError.value = error?.data?.statusMessage || error?.message || 'Не удалось загрузить рекомендации'
  } finally {
    if (requestSeq === upsellRequestSeq) {
      upsellInFlightSignature = null
    }
    if (requestSeq === upsellRequestSeq) {
      isUpsellLoading.value = false
    }
  }
}

async function onUpsellAdd(item: UpsellItem) {
  const catalogProduct = findProductById(cartStore.products, item.id)
  const cartItemWithoutModifiers = cartStore.items.find((cartItem: CartItem) =>
    cartItem.id === item.id && (cartItem.selectedModifiers?.length ?? 0) === 0,
  )
  const canOfferModifier = Boolean(catalogProduct?.modifiers?.length) && Boolean(cartItemWithoutModifiers)
  if (canOfferModifier && cartItemWithoutModifiers) {
    openEditItemModal(cartItemWithoutModifiers)
    return
  }
  if (upsellAddingItemIds.value.includes(item.id)) return
  upsellAddingItemIds.value = [...upsellAddingItemIds.value, item.id]
  try {
    const product: Product = catalogProduct ?? {
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      category: item.category,
    }
    const { modifiers, parameters } = buildDefaultCartSelections(product)
    await Promise.resolve(cartStore.addItem(product, 1, modifiers, parameters))
    pushPromoToast('success', `«${item.name}» добавлен в корзину`)
  } finally {
    upsellAddingItemIds.value = upsellAddingItemIds.value.filter((id) => id !== item.id)
  }
}

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
      headers: checkoutXShopIdHeaders(),
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
      pushPromoToast('error', promoError.value)
      return
    }

    appliedPromoCode.value = (res.promoCode || inputCode).toUpperCase()
    promoCodeInput.value = appliedPromoCode.value
    promoSuccess.value = typeof res.discountAmount === 'number' && res.discountAmount > 0
      ? `Скидка применена: вы экономите ${formatPrice(res.discountAmount)}`
      : 'Промокод применён'
    pushPromoToast('success', promoSuccess.value)
    await runPromoPreview()
  } catch (e: any) {
    appliedPromoCode.value = ''
    promoPreview.value = null
    promoError.value = e?.data?.message || e?.message || 'Ошибка применения промокода'
    pushPromoToast('error', promoError.value)
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
      allowSimultaneousBonusSpendAndEarn?: boolean
      bonusEarnBlockedBySpend?: boolean
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
      headers: checkoutXShopIdHeaders(),
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
        bonusPointsToSpend: effectiveBonusToSpend.value,
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

watch(
  () => bonusToSpend.value,
  (nextValue) => {
    const normalized = Number.isFinite(nextValue) ? Math.floor(nextValue) : 0
    const clamped = Math.max(0, Math.min(normalized, maxBonusAvailable.value))
    if (clamped !== nextValue) {
      bonusToSpend.value = clamped
    }
  },
)

function resolveSupabaseUserId(): string | null {
  const raw = supabaseUser.value as Record<string, unknown> | null | undefined
  const byId = typeof raw?.id === 'string' ? raw.id.trim() : ''
  if (byId) return byId
  const bySub = typeof raw?.sub === 'string' ? raw.sub.trim() : ''
  if (bySub) return bySub
  return null
}

const loyaltyBalanceContextKey = computed(() => {
  const uid = resolveSupabaseUserId()
  const shop = checkoutXShopId.value
  if (!shop) return null
  if (uid) return `${uid}\t${shop}`
  if (messengerInitData.value) {
    const channel = messengerClientChannel()
    return `${channel}\t${shop}`
  }
  return null
})

let loyaltyBalanceLastFetchedKey: string | null = null
let loyaltyBalanceInFlightKey: string | null = null
let loyaltyBalanceInFlightPromise: Promise<void> | null = null

async function loadLoyaltyBalance(options?: { force?: boolean }) {
  const key = loyaltyBalanceContextKey.value
  const headerShop = checkoutXShopId.value
  const isMiniAuth = isMessengerMiniApp.value && !!messengerInitData.value
  const requestHeaders = isMiniAuth
    ? buildMessengerAuthHeaders({ 'x-shop-id': headerShop || '' })
    : (headerShop ? { 'x-shop-id': headerShop } : undefined)
  if (!key || !headerShop) {
    loyaltyBalance.value = null
    loyaltyBalanceLastFetchedKey = null
    loyaltyBalanceInFlightKey = null
    loyaltyBalanceInFlightPromise = null
    return
  }
  if (!options?.force && key === loyaltyBalanceLastFetchedKey) return
  if (!options?.force && loyaltyBalanceInFlightPromise && loyaltyBalanceInFlightKey === key) {
    await loyaltyBalanceInFlightPromise
    return
  }

  const p = (async () => {
    try {
      const res = await $fetch<{ ok: boolean; balance: number }>('/api/loyalty/balance', {
        headers: requestHeaders,
      })
      if (loyaltyBalanceContextKey.value !== key) return
      loyaltyBalance.value = res.balance
      loyaltyBalanceLastFetchedKey = key
    } catch {
      if (loyaltyBalanceContextKey.value === key) {
        loyaltyBalance.value = null
      }
    }
  })()

  loyaltyBalanceInFlightKey = key
  loyaltyBalanceInFlightPromise = p
  void p.finally(() => {
    if (loyaltyBalanceInFlightKey === key) {
      loyaltyBalanceInFlightKey = null
      loyaltyBalanceInFlightPromise = null
    }
  })
}

watch(loyaltyBalanceContextKey, (nextKey: string | null) => {
  if (!nextKey) {
    loyaltyBalance.value = null
    loyaltyBalanceLastFetchedKey = null
    loyaltyBalanceInFlightKey = null
    loyaltyBalanceInFlightPromise = null
    return
  }
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
  shopId: checkoutXShopId.value || '',
}))

watch(promoPreviewWatchSignature, () => {
  if (promoPreviewTimer) clearTimeout(promoPreviewTimer)
  promoPreviewTimer = setTimeout(() => {
    void runPromoPreview()
  }, 450)
}, { immediate: true })

const upsellRequestSignature = computed(() => JSON.stringify({
  items: cartStore.items
    .map((item) => ({
      id: item.id,
      cartItemId: item.cartItemId,
      modifiersCount: item.selectedModifiers?.length ?? 0,
    }))
    .sort((a: { cartItemId: string }, b: { cartItemId: string }) => a.cartItemId.localeCompare(b.cartItemId)),
  restaurantId: upsellRestaurantId.value || '',
  fulfillmentType: state.fulfillmentType,
}))

const upsellWatchSignature = computed(() => JSON.stringify({
  request: upsellRequestSignature.value,
  remaining: upsellRemainingRub.value ?? null,
  shopId: checkoutXShopId.value || '',
}))

watch(upsellWatchSignature, () => {
  if (upsellTimer) clearTimeout(upsellTimer)
  upsellTimer = setTimeout(() => {
    void runUpsellRecommendations()
  }, 400)
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

const isEditModifiersValid = computed(() => {
  if (!editingItemProduct.value) return false
  if (editingItemProduct.value.parameters) {
    for (const group of editingItemProduct.value.parameters) {
      if (group.isRequired && !editingParameters.value[group.id]) return false
    }
  }
  if (editingItemProduct.value.modifiers) {
    for (const group of editingItemProduct.value.modifiers) {
      const selectedCount = editingModifiers.value[group.id]?.size || 0
      if (group.isRequired && selectedCount === 0) return false
      if (group.minSelect > 0 && selectedCount < group.minSelect) return false
    }
  }
  return true
})

const editingItemPrice = computed(() => {
  if (!editingItemProduct.value) return 0
  let basePrice = editingItemProduct.value.price
  if (editingItemProduct.value.parameters) {
    for (const group of editingItemProduct.value.parameters) {
      const selectedId = editingParameters.value[group.id]
      if (!selectedId) continue
      const opt = group.options.find((o) => o.id === selectedId)
      if (opt?.price != null) {
        basePrice = opt.price
        break
      }
    }
  }
  let multiplier = 1
  let delta = 0
  if (editingItemProduct.value.modifiers) {
    editingItemProduct.value.modifiers.forEach((group) => {
      const selectedIds = editingModifiers.value[group.id]
      if (!selectedIds) return
      group.options.forEach((opt) => {
        if (!selectedIds.has(opt.id)) return
        if (opt.pricingType === 'multiplier') multiplier *= (opt.priceMultiplier ?? 1)
        else delta += (opt.priceDelta || 0)
      })
    })
  }
  return Math.round(basePrice * multiplier + delta)
})

const hasMiniAppOrderAuth = computed(() =>
  // В мини-приложении считаем авторизацию валидной только при наличии initData.
  isMessengerMiniApp.value && !!messengerInitData.value,
)

const hasWebOrderAuth = computed(() => !!resolveSupabaseUserId())

const isAuthorizedForOrder = computed(() => {
  // Для web — Supabase-сессия, для mini app — только подписанный initData.
  return hasMiniAppOrderAuth.value || hasWebOrderAuth.value
})

/** Один канонический путь оформления; шаг задаётся только через ?step=1|2 (см. docs/TODO/CART_CHECKOUT_FETCH_OPTIMIZATION_PLAN_RU.md). */
const checkoutFlowPath = computed(() => tenantPath('/checkout'))

function readStepQuery(): number | null {
  const raw = route.query.step
  const s = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
  if (s === '1') return 1
  if (s === '2') return 2
  return null
}

/** Эффективный шаг из URL и корзины (без учёта сохранённого в storage — его применяют отдельно). */
function deriveEffectiveStep(): 1 | 2 {
  if (route.query.payment === 'return') return 2
  if (route.path.endsWith('/cart')) return 1
  const explicit = readStepQuery()
  if (explicit === 1) return 1
  if (explicit === 2) return cartStore.items.length > 0 ? 2 : 1
  if (route.path.endsWith('/checkout')) {
    // Без query step: как раньше для прямого захода на /checkout
    return cartStore.items.length > 0 ? 2 : 1
  }
  return 1
}

function goToStep(step: 1 | 2) {
  if (step === 2) {
    cartStore.flushPendingRemovals()
  }
  if (step === 2 && cartStore.items.length === 0) return

  const path = checkoutFlowPath.value
  const nextQuery = { ...route.query, step: String(step) as string }

  const urlMatches = route.path === path && String(route.query.step ?? '') === String(step)
  if (step === state.currentStep && urlMatches) return

  if (step !== state.currentStep) {
    stepDirection.value = step > state.currentStep ? 'forward' : 'backward'
  }
  state.currentStep = step

  if (!urlMatches) {
    void router.replace({ path, query: nextQuery })
  }
}

watch(
  () => [route.fullPath, cartStore.items.length] as const,
  () => {
    if (isPlacing.value) return
    const next = deriveEffectiveStep()
    if (next !== state.currentStep) {
      stepDirection.value = next > state.currentStep ? 'forward' : 'backward'
      state.currentStep = next
    }
    if (next === 1 && route.path === checkoutFlowPath.value && String(route.query.step) === '2') {
      void router.replace({ path: checkoutFlowPath.value, query: { ...route.query, step: '1' } })
    }
  },
)

function openEditItemModal(item: CartItem) {
  editingCartItemId.value = item.cartItemId
  editingItemQuantity.value = item.quantity
  editingItemProduct.value = item
  const nextMods: Record<string, Set<string>> = {}
  const nextParams: Record<string, string> = {}
  ;(item.selectedParameters || []).forEach((param) => {
    nextParams[param.productParameterId] = param.optionId
  })
  ;(item.selectedModifiers || []).forEach((mod) => {
    if (!nextMods[mod.groupId]) nextMods[mod.groupId] = new Set<string>()
    nextMods[mod.groupId].add(mod.optionId)
  })
  editingModifiers.value = nextMods
  editingParameters.value = nextParams
}

function closeEditItemModal() {
  editingCartItemId.value = null
  editingItemQuantity.value = 1
  editingItemProduct.value = null
  editingModifiers.value = {}
  editingParameters.value = {}
}

function isEditParameterSelected(groupId: string, optionId: string) {
  return editingParameters.value[groupId] === optionId
}

function toggleEditParameter(groupId: string, optionId: string) {
  editingParameters.value = {
    ...editingParameters.value,
    [groupId]: optionId,
  }
}

function isEditOptionSelected(groupId: string, optionId: string) {
  return editingModifiers.value[groupId]?.has(optionId) || false
}

function toggleEditOption(group: ModifierGroup, option: ModifierOption) {
  const prev = editingModifiers.value[group.id] ?? new Set<string>()
  let next = new Set(prev)
  if (group.selectionType === 'single' || group.selectionType === 'boolean') {
    next = new Set([option.id])
  } else if (next.has(option.id)) {
    next.delete(option.id)
  } else {
    const max = group.maxSelect
    if (typeof max === 'number' && max > 0 && next.size >= max) {
      const ordered = Array.from(next)
      const lastId = ordered[ordered.length - 1]
      if (lastId) next.delete(lastId)
    }
    next.add(option.id)
  }
  editingModifiers.value = {
    ...editingModifiers.value,
    [group.id]: next,
  }
}

function saveEditedItem() {
  if (!editingItemProduct.value || !editingCartItemId.value || !isEditModifiersValid.value) return
  const modifiers: SelectedModifier[] = []
  const parameters: SelectedParameter[] = []
  if (editingItemProduct.value.parameters) {
    editingItemProduct.value.parameters.forEach((group) => {
      const selectedId = editingParameters.value[group.id]
      if (!selectedId) return
      const opt = group.options.find((o) => o.id === selectedId)
      if (!opt) return
      parameters.push({
        parameterKindId: group.parameterKindId,
        productParameterId: group.id,
        optionId: opt.id,
        optionName: opt.name,
        price: opt.price || 0,
        weightG: opt.weightG,
        volumeMl: opt.volumeMl,
        pieces: opt.pieces,
      })
    })
  }
  if (editingItemProduct.value.modifiers) {
    editingItemProduct.value.modifiers.forEach((group) => {
      const selectedIds = editingModifiers.value[group.id]
      if (!selectedIds) return
      group.options.forEach((opt) => {
        if (!selectedIds.has(opt.id)) return
        modifiers.push({
          groupId: group.id,
          groupName: group.name,
          optionId: opt.id,
          optionName: opt.name,
          pricingType: opt.pricingType || 'delta',
          priceDelta: opt.priceDelta,
          priceMultiplier: opt.priceMultiplier ?? null,
        })
      })
    })
  }
  cartStore.replaceItemConfig(
    editingCartItemId.value,
    editingItemProduct.value,
    editingItemQuantity.value,
    modifiers,
    parameters,
  )
  closeEditItemModal()
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
    selectedCustomerAddressId: selectedCustomerAddressId.value,
    promoCodeInput: promoCodeInput.value,
    appliedPromoCode: appliedPromoCode.value,
    bonusToSpend: bonusToSpend.value,
    lastDeliveryCoords: lastDeliveryCoords.value,
    lastGeocodedAddressLine: lastGeocodedAddressLine.value,
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
    obj.fulfillmentType === 'delivery'
    || obj.fulfillmentType === 'pickup'
    || obj.fulfillmentType === 'qr-menu'
  ) {
    if (availableFulfillmentTypes.value.includes(obj.fulfillmentType)) {
      state.fulfillmentType = obj.fulfillmentType
      pendingRestoredFulfillmentType.value = null
    } else {
      pendingRestoredFulfillmentType.value = obj.fulfillmentType
    }
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
  if (typeof obj.selectedCustomerAddressId === 'string') {
    selectedCustomerAddressId.value = obj.selectedCustomerAddressId
    const selected = selectSavedAddressById(obj.selectedCustomerAddressId)
    if (selected) {
      addressLine.value = selected.address
      flat.value = selected.flat ?? ''
      comment.value = selected.comment ?? ''
    }
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
  if (
    obj.lastDeliveryCoords
    && typeof obj.lastDeliveryCoords === 'object'
    && Number.isFinite(obj.lastDeliveryCoords.lat)
    && Number.isFinite(obj.lastDeliveryCoords.lon)
  ) {
    lastDeliveryCoords.value = {
      lat: Number(obj.lastDeliveryCoords.lat),
      lon: Number(obj.lastDeliveryCoords.lon),
    }
  }
  if (typeof obj.lastGeocodedAddressLine === 'string') {
    lastGeocodedAddressLine.value = obj.lastGeocodedAddressLine
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
  if (upsellTimer) {
    clearTimeout(upsellTimer)
    upsellTimer = null
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

function getCheckoutStorageKeysForRecovery(): string[] {
  const keys = [
    checkoutStorageKey.value,
    buildCheckoutStorageKey(resolveCartScopeKey(route, shopIdFromRoute.value)),
    buildCheckoutStorageKey(resolveCartScopeKey(route, tenantKey.value || shopIdFromRoute.value)),
    buildCheckoutStorageKey(shopIdFromRoute.value),
    CHECKOUT_STORAGE_KEY,
  ].filter((key): key is string => typeof key === 'string' && key.trim().length > 0)
  return Array.from(new Set(keys))
}

async function persistCheckoutStateCloud(data: string) {
  const keys = getCheckoutStorageKeysForRecovery()
  if (isClient()) {
    for (const key of keys) {
      try {
        localStorage.setItem(key, data)
      } catch {
        // ignore
      }
    }
  }
  if (canUseMessengerStorage()) {
    for (const key of keys) {
      await setItem(key, data)
    }
  }
}

async function loadCheckoutStateCloud(): Promise<any | null> {
  const keys = getCheckoutStorageKeysForRecovery()
  if (canUseMessengerStorage()) {
    for (const key of keys) {
      const raw = await getItem(key)
      if (raw) {
        try {
          return JSON.parse(raw)
        } catch {
          // continue to next key
        }
      }
    }
  }
  if (!isClient()) return null
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      return JSON.parse(raw)
    } catch {
      // continue to next key
    }
  }
  return null
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
    selectedCustomerAddressId: selectedCustomerAddressId.value,
    promoCodeInput: promoCodeInput.value,
    appliedPromoCode: appliedPromoCode.value,
    bonusToSpend: bonusToSpend.value,
  }),
  () => {
    const data = serializeState()
    void persistCheckoutStateCloud(data)
  },
  { deep: true },
)

onMounted(async () => {
  if (isMessengerMiniApp.value) {
    expandMessengerViewport()
  }
  if (!hasTenantRouteContext.value && shopIdFromRoute.value) {
    try {
      const canonical = await $fetch<{ ok: boolean; cartPath: string; checkoutPath: string }>(
        '/api/tenant/resolve-canonical',
        {
          query: { shop_id: shopIdFromRoute.value },
        },
      )
      if (canonical?.ok && typeof canonical.checkoutPath === 'string') {
        await navigateTo(
          { path: canonical.checkoutPath, query: { ...route.query, step: '1' } },
          { replace: true },
        )
        return
      }
    } catch {
      throw createError({ statusCode: 404, statusMessage: 'Checkout route not found' })
    }
  }

  const saved = await loadCheckoutStateCloud()
  if (saved) restoreFromPlainObject(saved)

  state.currentStep = deriveEffectiveStep()

  await loadRestaurants()
  if (availableFulfillmentTypes.value.length) {
    state.fulfillmentType = resolveCheckoutFulfillment(
      availableFulfillmentTypes.value,
      state.fulfillmentType,
    ) ?? state.fulfillmentType
  }
})

watch(
  () => [showAddressModal.value, state.currentStep, restaurants.value.length] as const,
  async ([opened, step]) => {
    if (!isMessengerMiniApp.value) return
    if (!opened || step !== 2) return
    await nextTick()
    expandMessengerViewport()
  },
)

watch(shopIdFromRoute, async () => {
  applyCartScope()
  await loadRestaurants()
  if (availableFulfillmentTypes.value.length) {
    state.fulfillmentType = resolveCheckoutFulfillment(
      availableFulfillmentTypes.value,
      state.fulfillmentType,
    ) ?? state.fulfillmentType
  }
})

watch(
  () => messengerInitData.value,
  async (initData, prevInitData) => {
    if (!initData) return
    // В Telegram/MAX initData может появляться после первого mount.
    // Если первая загрузка филиалов прошла без auth-заголовков, повторяем.
    if (initData === prevInitData) return
    await loadRestaurants()
    if (availableFulfillmentTypes.value.length) {
      state.fulfillmentType = resolveCheckoutFulfillment(
        availableFulfillmentTypes.value,
        state.fulfillmentType,
      ) ?? state.fulfillmentType
    }
  },
)

watch(checkoutStorageKey, async (nextKey: string, prevKey: string) => {
  if (nextKey === prevKey) return
  resetScopedCheckoutFields()
  const saved = await loadCheckoutStateCloud()
  if (saved) restoreFromPlainObject(saved)
  if (availableFulfillmentTypes.value.length) {
    state.fulfillmentType = resolveCheckoutFulfillment(
      availableFulfillmentTypes.value,
      state.fulfillmentType,
    ) ?? state.fulfillmentType
  }
})

async function placeOrder() {
  if (isPlacing.value || !cartStore.items.length || !canGoToSummary.value || !isRestaurantOpenNow.value) return

  isPlacing.value = true
  try {
    if (state.fulfillmentType === 'delivery') {
      await saveCurrentAddress()
    }

    const selectedAddressIdForOrder =
      typeof selectedCustomerAddressId.value === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selectedCustomerAddressId.value)
        ? selectedCustomerAddressId.value
        : null

    const body: any = {
      shopId: checkoutXShopId.value,
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
            customerAddressId: selectedAddressIdForOrder,
            line: addressLine.value || null,
            flat: flat.value || null,
            comment: comment.value || null,
            zone: cartStore.deliveryZone ?? null,
            lat: lastDeliveryCoords.value?.lat ?? selectedAddress.value?.lat ?? null,
            lon: lastDeliveryCoords.value?.lon ?? selectedAddress.value?.lon ?? null,
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
      bonusPointsToSpend: effectiveBonusToSpend.value,
    }

    if (messengerInitData.value) {
      body.initData = messengerInitData.value
    }

    const continuation = readOrderContinuationHint()
    body.orderClientChannel = messengerClientChannel()
    body.orderContinuation = continuation

    const orderHeaders = buildMessengerAuthHeaders(
      checkoutXShopIdHeaders(),
    )

    const res = await $fetch<{ ok: boolean; orderId?: string }>('/api/order', {
      method: 'POST',
      headers: orderHeaders,
      body,
    })

    if (res?.ok) {
      clearOrderContinuationHint()
      if (state.paymentMethod === 'online' && res.orderId) {
        const returnUrl = isClient()
          ? `${window.location.origin}${tenantPath('/checkout')}?payment=return&orderId=${encodeURIComponent(res.orderId)}&step=2`
          : undefined
        const paymentRes = await $fetch<{ ok: boolean; confirmationUrl?: string }>('/api/checkout/create', {
          method: 'POST',
          headers: checkoutXShopIdHeaders(),
          body: {
            orderId: res.orderId,
            returnUrl,
          },
        })
        if (!paymentRes?.confirmationUrl) {
          throw new Error('Payment confirmation URL not received')
        }
        const data = serializeState()
        void persistCheckoutStateCloud(data)
        cartStore.clear()
        if (isClient()) {
          localStorage.removeItem(checkoutStorageKey.value)
          window.location.href = paymentRes.confirmationUrl
        }
        return
      }

      const data = serializeState()
      void persistCheckoutStateCloud(data)
      cartStore.clear()
      if (isClient()) {
        localStorage.removeItem(checkoutStorageKey.value)
      }
      const ordersTarget = {
        path: tenantPath('/orders'),
        query: {
          orderId: res.orderId ?? undefined,
          shop_id: checkoutXShopId.value || undefined,
        },
      }
      await navigateTo(ordersTarget)
      // MAX mini app иногда не выполняет SPA-переход после mutate+clear.
      // Делаем мягкий fallback на hard navigation, если маршрут не сменился.
      if (isClient() && isMessengerMiniApp.value && messengerClientChannel() === 'max_mini') {
        await nextTick()
        const currentPath = window.location.pathname
        if (currentPath.includes('/checkout') || currentPath.endsWith('/cart')) {
          const search = new URLSearchParams()
          if (res.orderId) search.set('orderId', res.orderId)
          if (checkoutXShopId.value) search.set('shop_id', checkoutXShopId.value)
          const nextUrl = `${tenantPath('/orders')}${search.toString() ? `?${search.toString()}` : ''}`
          window.location.assign(nextUrl)
        }
      }
    } else if (isClient()) {
      window.alert('Не удалось оформить заказ. Попробуйте ещё раз.')
    }
  } catch (error: any) {
    const status = error?.statusCode || error?.status
    const apiMessage =
      typeof error?.data?.message === 'string' && error.data.message.trim().length > 0
        ? error.data.message.trim()
        : null
    if (isClient() && !isMessengerMiniApp.value && (status === 401 || status === 409)) {
      await openTelegramAuth()
      return
    }
    if (isClient()) {
      window.alert(apiMessage ? `Ошибка при отправке заказа: ${apiMessage}` : 'Ошибка при отправке заказа. Попробуйте ещё раз.')
    }
  } finally {
    isPlacing.value = false
  }
}

function authAndReturn() {
  void openTelegramAuth()
}

function openAuthModal(mode: 'auth' | 'continue') {
  authModalMode.value = mode
  showAuthModal.value = true
}

function closeAuthModal() {
  showAuthModal.value = false
}

async function openMaxAuthFlow() {
  if (!maxBotUrl.value || !isClient()) return
  await saveCurrentAddress()
  await persistCheckoutStateCloud(serializeState())
  const shopRef = checkoutXShopId.value || ''
  if (!shopRef) {
    window.alert('Не удалось определить ресторан. Обновите страницу.')
    return
  }
  let bridgeKey = ''
  try {
    if (cartStore.items.length) {
      const bridgeRes = await $fetch<{ ok: boolean; bridgeKey?: string }>('/api/auth/bridge-session', {
        method: 'POST',
        body: {
          shopId: shopRef,
          scopeKey: resolveCartScopeKey(route),
          redirectPath: `${tenantPath('/checkout')}?step=1`,
          items: cartStore.items,
        },
      })
      if (bridgeRes?.ok && typeof bridgeRes.bridgeKey === 'string') {
        bridgeKey = bridgeRes.bridgeKey
      }
    }
  } catch {
    // bridge optional
  }
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  try {
    const res = await $fetch<{ ok: boolean; token: string; botStartParam: string }>(
      '/api/auth/request-max-link',
      {
        method: 'POST',
        headers: { 'x-shop-id': shopRef },
        body: {
          shopId: shopRef,
          citySlug: citySlug || undefined,
          redirectPath: tenantPath('/checkout'),
          bridgeKey: bridgeKey || undefined,
        },
      },
    )
    if (!res?.ok || !res.token || !res.botStartParam) {
      throw new Error('bad_response')
    }
    const hasQuery = maxBotUrl.value.includes('?')
    const maxUrl = `${maxBotUrl.value}${hasQuery ? '&' : '?'}start=${encodeURIComponent(res.botStartParam)}`
    window.open(maxUrl, '_blank', 'noopener')
    await navigateTo({
      path: '/link-max',
      query: {
        token: res.token,
        redirect: tenantPath('/checkout'),
        shop_id: shopRef,
      },
    })
  } catch {
    window.alert('Не удалось начать вход через MAX. Попробуйте ещё раз.')
  }
}

function openMaxAuth() {
  void openMaxAuthFlow()
}

async function openTelegramAuth() {
  if (!telegramBotUrl.value || !isClient()) return
  await saveCurrentAddress()
  await persistCheckoutStateCloud(serializeState())
  const shopRef = checkoutXShopId.value || ''
  if (!shopRef) {
    window.alert('Не удалось определить ресторан. Обновите страницу.')
    return
  }
  let bridgeKey = ''
  try {
    if (cartStore.items.length) {
      const bridgeRes = await $fetch<{ ok: boolean; bridgeKey?: string }>('/api/auth/bridge-session', {
        method: 'POST',
        body: {
          shopId: shopRef,
          scopeKey: resolveCartScopeKey(route),
          redirectPath: `${tenantPath('/checkout')}?step=1`,
          items: cartStore.items,
        },
      })
      if (bridgeRes?.ok && typeof bridgeRes.bridgeKey === 'string') {
        bridgeKey = bridgeRes.bridgeKey
      }
    }
  } catch {
    // bridge optional
  }
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  try {
    const res = await $fetch<{ ok: boolean; token: string; botStartParam: string }>(
      '/api/auth/request-telegram-link',
      {
        method: 'POST',
        headers: { 'x-shop-id': shopRef },
        body: {
          shopId: shopRef,
          citySlug: citySlug || undefined,
          redirectPath: tenantPath('/checkout'),
          bridgeKey: bridgeKey || undefined,
        },
      },
    )
    if (!res?.ok || !res.token || !res.botStartParam) {
      throw new Error('bad_response')
    }
    const tgUrl = `${telegramBotUrl.value}?start=${encodeURIComponent(res.botStartParam)}`
    window.open(tgUrl, '_blank', 'noopener')
    await navigateTo({
      path: '/link-telegram',
      query: {
        token: res.token,
        redirect: tenantPath('/checkout'),
        shop_id: shopRef,
      },
    })
  } catch {
    window.alert('Не удалось начать вход через Telegram. Попробуйте ещё раз.')
  }
}

async function runAuthAction(channel: 'telegram' | 'max') {
  showAuthModal.value = false
  if (authModalMode.value === 'continue') {
    if (channel === 'telegram') {
      await continueInTelegramFromCheckout()
      return
    }
    await continueInMaxFromCheckout()
    return
  }
  if (channel === 'telegram') {
    await openTelegramAuth()
    return
  }
  await openMaxAuthFlow()
}

async function continueInTelegramFromCheckout() {
  await continueInMiniAppFromCheckout('telegram')
}

async function continueInMaxFromCheckout() {
  await continueInMiniAppFromCheckout('max')
}

async function continueInMiniAppFromCheckout(channel: 'telegram' | 'max') {
  if (!cartStore.items.length || !isClient()) return
  try {
    const res = await $fetch<{ ok: boolean; deepLink: string }>('/api/cart-bridge', {
      method: 'POST',
      headers: checkoutXShopIdHeaders(),
      body: {
        channel,
        scopeKey: resolveCartScopeKey(route),
        items: cartStore.items,
      },
    })
    if (res?.ok && res.deepLink) {
      window.location.href = res.deepLink
      return
    }
    window.alert(`Не удалось подготовить корзину для ${channel === 'max' ? 'MAX' : 'Telegram'}. Попробуйте ещё раз.`)
  } catch {
    window.alert(`Ошибка при подготовке корзины для ${channel === 'max' ? 'MAX' : 'Telegram'}. Попробуйте ещё раз.`)
  }
}

function pushPromoToast(kind: 'success' | 'error', message: string, durationMs = 2600) {
  const text = (message || '').trim()
  if (!text) return
  const id = ++promoToastSeq
  promoToasts.value = [...promoToasts.value, { id, kind, message: text }]
  setTimeout(() => {
    promoToasts.value = promoToasts.value.filter((item) => item.id !== id)
  }, durationMs)
}

function onBonusSliderCommit() {
  void runPromoPreview()
}
</script>

<style scoped>
.cart-enter-active,
.cart-leave-active {
  transition: opacity 0.2s ease;
}
.cart-enter-from,
.cart-leave-to {
  opacity: 0;
}
.cart-enter-active > div:last-child,
.cart-leave-active > div:last-child {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.cart-enter-from > div:last-child,
.cart-leave-to > div:last-child {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

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

.collapse-fade-enter-active,
.collapse-fade-leave-active {
  transition: max-height 0.22s ease, opacity 0.22s ease, transform 0.22s ease, margin 0.22s ease;
  overflow: hidden;
  max-height: 120px;
}
.collapse-fade-enter-from,
.collapse-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.22s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .modal-panel,
.modal-fade-leave-active .modal-panel {
  transition: transform 0.22s ease, opacity 0.22s ease;
}
.modal-fade-enter-from .modal-panel,
.modal-fade-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.cart-item-enter-active,
.cart-item-leave-active {
  transition: opacity 0.24s ease, transform 0.24s ease, max-height 0.24s ease, margin 0.24s ease;
  overflow: hidden;
  max-height: 180px;
}
.cart-item-enter-from,
.cart-item-leave-to {
  opacity: 0;
  transform: translateY(12px);
  max-height: 0;
}
.cart-item-move {
  transition: transform 0.24s ease;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.product-enter-active,
.product-leave-active {
  transition: opacity 0.25s ease;
}
.product-enter-active .max-w-md,
.product-leave-active .max-w-md {
  transition: transform 0.25s ease;
}
.product-enter-from,
.product-leave-to {
  opacity: 0;
}
.product-enter-from .max-w-md,
.product-leave-to .max-w-md {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .product-enter-from .max-w-md,
  .product-leave-to .max-w-md {
    transform: scale(0.95);
  }
}
</style>

