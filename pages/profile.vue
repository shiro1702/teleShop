<template>
  <div class="profile-page">
    <h1>Профиль</h1>

    <div v-if="!user" class="card">
      <p>Вы ещё не вошли на сайт.</p>
      <p class="hint">
        Используйте кнопку «Войти через Telegram» в шапке, чтобы авторизоваться.
      </p>
    </div>

    <div v-else class="card">
      <h2>Текущий пользователь</h2>
      <dl class="info">
        <div>
          <dt>User ID</dt>
          <dd>{{ userId }}</dd>
        </div>
        <div v-if="telegramId !== null">
          <dt>Telegram ID</dt>
          <dd>{{ telegramId }}</dd>
        </div>
        <div v-else>
          <dt>Telegram</dt>
          <dd>Ещё не привязан</dd>
        </div>
      </dl>
      <p class="hint">
        Telegram‑аккаунт привязывается через бота и страницу привязки, после чего заказы с сайта будут
        уведомлять вас в Telegram.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSupabaseUser, useSupabaseClient } from '#imports';

const user = useSupabaseUser();

const userId = computed<string | null>(() => {
  const raw = (user.value as any)?.id;
  return typeof raw === 'string' ? raw : null;
});

const telegramId = computed<number | null>(() => {
  const raw = (user.value as any)?.user_metadata?.telegram_id;
  return typeof raw === 'number' ? raw : null;
});
</script>

<style scoped>
.profile-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
}

.card {
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 1.5rem;
}

.card h2 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.info {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.info dt {
  font-weight: 500;
  color: #4b5563;
}

.info dd {
  margin: 0;
  color: #111827;
}

.hint {
  font-size: 0.85rem;
  color: #6b7280;
}
</style>

