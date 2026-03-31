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
              {{ formatPrice(cartStore.total) }}
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
                class="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700"
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
                <span :style="{ color: mutedTextColor }">Товары</span>
                <span class="font-semibold" :style="{ color: mainTextColor }">
                  {{ formatPrice(cartStore.total) }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span :style="{ color: mutedTextColor }">Доставка</span>
                <span
                  class="font-semibold"
                  :class="cartStore.deliveryCost === 0 ? 'text-emerald-600' : 'text-gray-900'"
                >
                  {{ cartStore.deliveryCost === 0 ? '0 ₽' : formatPrice(cartStore.deliveryCost) }}
                </span>
              </div>
              <div class="flex items-center justify-between border-t border-dashed pt-2" :style="{ borderColor }">
                <span class="font-semibold" :style="{ color: mainTextColor }">
                  Итого
                </span>
                <span class="text-xl font-bold text-primary">
                  {{ formatPrice(cartStore.grandTotal) }}
                </span>
              </div>
            </div>

            <div class="flex flex-1 flex-col gap-2 sm:max-w-xs">
              <button
                type="button"
                class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
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
                      ? 'bg-primary text-white shadow-sm'
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
                      ? 'bg-primary text-white shadow-sm'
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
                      ? 'bg-primary text-white shadow-sm'
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
                <label class="flex cursor-not-allowed items-center justify-between rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm opacity-70">
                  <div class="flex items-center gap-2">
                    <input
                      type="radio"
                      value="online"
                      disabled
                      class="h-4 w-4 text-primary"
                    >
                    <div>
                      <p class="font-medium text-gray-400">
                        Оплата на сайте
                      </p>
                      <p class="text-xs text-gray-400">
                        Скоро появится
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
              <div class="space-y-2 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Товары</span>
                  <span class="font-semibold text-gray-900">
                    {{ formatPrice(cartStore.total) }}
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
                  class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
                  :disabled="isPlacing || !cartStore.items.length || !canGoToSummary"
                  @click="placeOrder"
                >
                  <span v-if="isPlacing">Оформляем заказ...</span>
                  <span v-else>Оформить заказ</span>
                </button>

                <template v-else>
                  <button
                    type="button"
                    class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700 sm:w-auto"
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
        class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
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
          class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          :disabled="isPlacing || !cartStore.items.length || !canGoToSummary"
          @click="placeOrder"
        >
          <span v-if="isPlacing">Оформляем заказ...</span>
          <span v-else>Оформить заказ</span>
        </button>
        <template v-else>
          <button
            type="button"
            class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700"
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

const state = reactive<CheckoutState>({
  currentStep: 1,
  paymentMethod: 'cash',
  fulfillmentType: 'delivery',
})

const isPlacing = ref(false)
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

const shopIdFromRoute = computed(() =>
  tenantKey.value,
)

function applyCartScope() {
  const scope = resolveCartScopeKey(route, shopIdFromRoute.value)
  cartStore.setScope(scope)
}

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

const summaryDeliveryLabel = computed(() =>
  state.fulfillmentType === 'pickup'
    ? 'Самовывоз'
    : state.fulfillmentType === 'qr-menu'
      ? 'QR-меню'
      : 'Доставка',
)

const summaryDeliveryCost = computed(() =>
  state.fulfillmentType === 'delivery'
    ? cartStore.deliveryCost
    : 0,
)

const summaryGrandTotal = computed(() =>
  cartStore.total + summaryDeliveryCost.value,
)

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
    localStorage.setItem(CHECKOUT_STORAGE_KEY, data)
  } catch {
    // ignore
  }
}

function loadCheckoutStateLocal() {
  if (!isClient()) return null
  try {
    const raw = localStorage.getItem(CHECKOUT_STORAGE_KEY)
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

  (webApp.value as any).CloudStorage.setItem(CHECKOUT_STORAGE_KEY, data, () => {
    persistCheckoutStateLocal(data)
  })
}

function loadCheckoutStateCloud(): Promise<any | null> {
  if (!isTelegram.value || !(webApp.value as any)?.CloudStorage) {
    return Promise.resolve(loadCheckoutStateLocal())
  }

  return new Promise((resolve) => {
    (webApp.value as any).CloudStorage.getItem(
      CHECKOUT_STORAGE_KEY,
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
    selectedPickupPointId: selectedPickupPointId.value,
    selectedRestaurantId: selectedRestaurantId.value,
  }),
  () => {
    const data = serializeState()
    persistCheckoutStateCloud(data)
  },
  { deep: true },
)

onMounted(async () => {
  applyCartScope()
  const saved = await loadCheckoutStateCloud()
  if (saved) {
    restoreFromPlainObject(saved)
  }

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

async function placeOrder() {
  if (isPlacing.value || !cartStore.items.length || !canGoToSummary.value) return

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
      const data = serializeState()
      persistCheckoutStateCloud(data)
      cartStore.clear()
      if (isClient()) {
        localStorage.removeItem(CHECKOUT_STORAGE_KEY)
      }
      // Пока просто редиректим на главную, позже можно сделать отдельную страницу успеха
      await navigateTo({
        path: tenantPath('/orders'),
        query: {
          orderId: res.orderId ?? undefined,
          // Явно прокидываем магазин, чтобы tenant-контекст был корректным для API.
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
</style>

