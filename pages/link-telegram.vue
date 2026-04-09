<template>
  <div class="link-telegram-page">
    <h1>Привязка Telegram</h1>

    <p v-if="!token">Некорректная ссылка: отсутствует токен.</p>

    <div v-else>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="isLoading || isSuccess || !token"
        @click="linkTelegram"
      >
        <span v-if="isLoading">Привязка...</span>
        <span v-else-if="isSuccess">Успешно привязано</span>
        <span v-else>Привязать Telegram</span>
      </button>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="isSuccess" class="success">
        Telegram-аккаунт успешно привязан к вашему профилю.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter, useSupabaseClient } from '#imports';

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();

const token = computed(() => {
  const t = route.query.token;
  return typeof t === 'string' ? t : undefined;
});

const redirectPath = computed(() => {
  const r = route.query.redirect;
  return typeof r === 'string' ? r : undefined;
});
const shopId = computed(() => {
  const s = route.query.shop_id;
  return typeof s === 'string' && s.trim() ? s.trim() : undefined;
});

const isLoading = ref(false);
const isSuccess = ref(false);
const errorMessage = ref<string | null>(null);

function buildRedirectTarget() {
  const fallbackPath = '/';
  const raw = redirectPath.value || fallbackPath;
  if (!shopId.value) return raw;
  if (!raw.startsWith('/')) return fallbackPath;

  // Preserve tenant context after auth for routes like /checkout.
  const [pathPart, queryPart = ''] = raw.split('?');
  const query = new URLSearchParams(queryPart);
  if (!query.get('shop_id')) {
    query.set('shop_id', shopId.value);
  }
  const serialized = query.toString();
  return serialized ? `${pathPart}?${serialized}` : pathPart;
}

onMounted(async () => {
  if (!token.value) {
    errorMessage.value = 'Некорректная или устаревшая ссылка.';
    return;
  }

  // Пытаемся привязать Telegram сразу, без нажатия на кнопку
  if (!isSuccess.value && !isLoading.value) {
    await linkTelegram();
  }
});

const linkTelegram = async () => {
  if (!token.value) {
    errorMessage.value = 'Токен отсутствует.';
    return;
  }

  isLoading.value = true;
  errorMessage.value = null;

  try {
    const res = await $fetch<{
      success: boolean;
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>('/api/auth/exchange-telegram-session', {
      method: 'POST',
      body: { token: token.value },
    });

    if (res?.success) {
      const { access_token, refresh_token } = res;
      // Устанавливаем Supabase-сессию на фронте.
      // Плагин @nuxtjs/supabase сам синхронизирует cookie через onAuthStateChange.
      const { error: setError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (setError) {
        throw new Error('Не удалось установить сессию Supabase на клиенте.');
      }

      isSuccess.value = true;

      await router.replace(buildRedirectTarget());
    } else {
      throw new Error('Не удалось создать сессию Supabase.');
    }
  } catch (err: any) {
    const message =
      err?.data?.statusMessage ||
      err?.statusMessage ||
      err?.message ||
      'Не удалось привязать Telegram.';

    errorMessage.value = message;
    isSuccess.value = false;
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.link-telegram-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 0.4rem;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background: #E25E2D;
  color: #ffffff;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin-top: 1rem;
  color: #dc2626;
}

.success {
  margin-top: 1rem;
  color: #16a34a;
}
</style>

