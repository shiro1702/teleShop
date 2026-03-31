<template>
  <div class="p-4 text-sm text-gray-600">Переадресация на канбан…</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

definePageMeta({ layout: 'dashboard' })

const router = useRouter()
const route = useRoute()

onMounted(() => {
  void router.replace({
    path: '/dashboard/orders/kanban',
    query: route.query,
  })
})
</script>
