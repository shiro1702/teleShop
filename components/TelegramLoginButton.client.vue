<template>
  <div ref="container" class="inline-flex items-center justify-center"></div>
</template>

<script setup lang="ts">
const runtimeConfig = useRuntimeConfig()
const botName = computed(() => runtimeConfig.public.telegramBotName as string)
const container = ref<HTMLElement | null>(null)

const emit = defineEmits<{
  (e: 'logged-in', user: any): void
}>()

onMounted(async () => {
  console.log('[Auth][WEB] TelegramLoginButton mounted, botName =', botName.value)
  await nextTick()

  if (!botName.value) {
    console.warn('[Auth][WEB] TelegramLoginButton: botName is missing, widget will not render')
    return
  }

  if (!container.value) {
    console.warn('[Auth][WEB] TelegramLoginButton: container ref is missing after mount, widget will not render')
    return
  }

  ;(window as any).onTelegramAuth = async (user: any) => {
    console.log('[Auth][WEB] onTelegramAuth called with user:', user)
    try {
      await $fetch('/api/auth/telegram', {
        method: 'POST',
        body: user,
      })
      console.log('[Auth][WEB] /api/auth/telegram succeeded')
      emit('logged-in', user)
    } catch (e) {
      console.error('Telegram auth failed', e)
    }
  }

  const script = document.createElement('script')
  script.src = 'https://telegram.org/js/telegram-widget.js?22'
  script.async = true
  script.setAttribute('data-telegram-login', botName.value)
  script.setAttribute('data-size', 'medium')
  script.setAttribute('data-request-access', 'write')
  script.setAttribute('data-userpic', 'false')
  script.setAttribute('data-onauth', 'onTelegramAuth(user)')

  container.value.innerHTML = ''
  container.value.appendChild(script)
})
</script>