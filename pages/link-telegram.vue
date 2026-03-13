<template>
  <div class="link-telegram-page">
    <h1>Привязка Telegram</h1>

    <p v-if="!token">Некорректная ссылка: отсутствует токен.</p>

    <div v-else>
      <p v-if="!user">Для привязки Telegram необходимо войти на сайт.</p>

      <div v-if="!user">
        <button type="button" @click="goToLogin" class="btn btn-primary">
          Войти
        </button>
      </div>

      <div v-else>
        <p>Вы вошли как: {{ user?.email || user?.id }}</p>

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
      </div>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="isSuccess" class="success">
        Telegram-аккаунт успешно привязан к вашему профилю.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter, useSupabaseUser } from '#imports';

const route = useRoute();
const router = useRouter();
const user = useSupabaseUser();

const token = computed(() => {
  const t = route.query.token;
  return typeof t === 'string' ? t : undefined;
});

const redirectPath = computed(() => {
  const r = route.query.redirect;
  return typeof r === 'string' ? r : undefined;
});

const isLoading = ref(false);
const isSuccess = ref(false);
const errorMessage = ref<string | null>(null);

onMounted(() => {
  if (!token.value) {
    errorMessage.value = 'Некорректная или устаревшая ссылка.';
  }
});

const goToLogin = () => {
  router.push({
    path: '/login',
    query: {
      redirect: '/link-telegram',
      token: token.value,
    },
  });
};

const linkTelegram = async () => {
  if (!token.value) {
    errorMessage.value = 'Токен отсутствует.';
    return;
  }

  isLoading.value = true;
  errorMessage.value = null;

  try {
    await $fetch('/api/auth/link-telegram', {
      method: 'POST',
      body: { token: token.value },
    });

    isSuccess.value = true;

    if (redirectPath.value) {
      await router.replace(redirectPath.value);
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
  background: #2563eb;
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

