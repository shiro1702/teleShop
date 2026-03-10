<template>
  <div v-if="botName" ref="container" class="inline-flex items-center justify-center"></div>
</template>

<script setup lang="ts">
const runtimeConfig = useRuntimeConfig()
const botName = computed(() => runtimeConfig.public.telegramBotName as string)
const container = ref<HTMLElement | null>(null)

const emit = defineEmits<{
  (e: 'logged-in', user: any): void
}>()

onMounted(() => {
  if (!botName.value || !container.value) return

  ;(window as any).onTelegramAuth = async (user: any) => {
    try {
      await $fetch('/api/auth/telegram', {
        method: 'POST',
        body: user,
      })
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

