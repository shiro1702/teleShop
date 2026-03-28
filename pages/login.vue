<template>
  <div class="login-page">
    <h1>Вход на сайт</h1>

    <p class="subtitle">
      Войдите, чтобы привязать ваш Telegram‑аккаунт и продолжить оформление заказа.
    </p>

    <form class="form" @submit.prevent="onSubmit">
      <label class="field">
        <span>Email</span>
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
        />
      </label>

      <label class="field">
        <span>Пароль</span>
        <input
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
        />
      </label>

      <p v-if="errorMessage" class="error">
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        class="btn-primary"
        :disabled="isLoading"
      >
        <span v-if="isLoading">Вход...</span>
        <span v-else>Войти</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter, useSupabaseClient } from '#imports';

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();

const email = ref('');
const password = ref('');
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

const redirectPath = computed(() => {
  const r = route.query.redirect;
  if (typeof r === 'string' && r.startsWith('/')) return r;
  return '';
});

const token = computed(() => {
  const t = route.query.token;
  return typeof t === 'string' ? t : undefined;
});

async function resolveDefaultRedirectPath(): Promise<string> {
  try {
    const accessRes = await fetch('/api/dashboard/access')
    if (!accessRes.ok) return '/dashboard'
    const access = await accessRes.json() as { ok: boolean; shopId?: string }
    if (!access?.ok || !access.shopId) return '/dashboard'

    const restaurantsRes = await fetch(`/api/restaurants?shop_id=${encodeURIComponent(access.shopId)}`)
    if (!restaurantsRes.ok) return '/dashboard'
    const restaurants = await restaurantsRes.json() as { ok: boolean; items?: unknown[] }
    if (restaurants?.ok && Array.isArray(restaurants.items) && restaurants.items.length > 0) {
      return '/dashboard/branches'
    }
  } catch {
    // fallback below
  }
  return '/dashboard'
}

async function goAfterAuth() {
  const path = redirectPath.value || await resolveDefaultRedirectPath()
  const query = token.value ? { token: token.value } : undefined;
  await router.replace({
    path,
    query,
  });
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await goAfterAuth()
  }
});

const onSubmit = async () => {
  isLoading.value = true;
  errorMessage.value = null;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });

    if (error) {
      errorMessage.value = error.message || 'Не удалось войти. Проверьте данные.';
      return;
    }

    await goAfterAuth()
  } catch (err: any) {
    errorMessage.value =
      err?.message || 'Не удалось войти. Попробуйте ещё раз.';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  max-width: 420px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 0.9rem;
  color: #4b5563;
  margin-bottom: 1.5rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
}

.field span {
  color: #374151;
}

.field input {
  padding: 0.6rem 0.75rem;
  border-radius: 0.4rem;
  border: 1px solid #d1d5db;
  font-size: 0.95rem;
}

.field input:focus {
  outline: none;
  border-color: #E25E2D;
  box-shadow: 0 0 0 1px rgba(226, 94, 45, 0.3);
}

.btn-primary {
  margin-top: 0.5rem;
  padding: 0.6rem 1.2rem;
  border-radius: 0.4rem;
  border: none;
  cursor: pointer;
  background: #E25E2D;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary:not(:disabled):hover {
  background: #C84E24;
}

.error {
  font-size: 0.85rem;
  color: #dc2626;
}
</style>

