<template>
  <div class="relative flex flex-col">
    <div
      ref="mapEl"
      class="min-h-[220px] w-full flex-1 rounded-b-lg bg-gray-100"
      :class="aspectClass"
    />
    <p
      v-if="statusMessage"
      class="absolute left-2 right-2 top-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900 shadow-sm"
    >
      {{ statusMessage }}
    </p>
    <p class="pointer-events-none absolute bottom-1 right-2 z-[500] rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-gray-600 shadow-sm">
      © OpenStreetMap
    </p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MapPointInput, MapPointResolved } from '~/composables/useGeocodedMarkers'
import { geocodeMarkers } from '~/composables/useGeocodedMarkers'

const props = withDefaults(
  defineProps<{
    markers: MapPointInput[]
    cityName?: string
    /** Tailwind aspect class for map box */
    aspectClass?: string
  }>(),
  { aspectClass: 'aspect-[16/10]' },
)

const mapEl = ref<HTMLElement | null>(null)
const statusMessage = ref<string | null>(null)
const geocodeFailedCount = ref(0)

let L: typeof import('leaflet') | null = null
let map: import('leaflet').Map | null = null
let clusterLayer: import('leaflet').Layer | null = null

function destroyMap() {
  if (map) {
    map.remove()
    map = null
  }
  clusterLayer = null
}

async function fixDefaultIcons(Leaflet: typeof import('leaflet')) {
  const { default: iconUrl } = await import('leaflet/dist/images/marker-icon.png?url')
  const { default: iconRetinaUrl } = await import('leaflet/dist/images/marker-icon-2x.png?url')
  const { default: shadowUrl } = await import('leaflet/dist/images/marker-shadow.png?url')
  const DefaultIcon = Leaflet.Icon.Default as typeof Leaflet.Icon.Default & {
    prototype: { _getIconUrl?: string }
  }
  delete (DefaultIcon.prototype as { _getIconUrl?: unknown })._getIconUrl
  DefaultIcon.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })
}

async function buildCluster(Leaflet: typeof import('leaflet'), resolved: MapPointResolved[]) {
  const Lm = Leaflet as typeof Leaflet & { markerClusterGroup: (opts?: object) => import('leaflet').LayerGroup }
  const group = Lm.markerClusterGroup({
    maxClusterRadius: 56,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
  })

  for (const p of resolved) {
    const m = Leaflet.marker([p.lat, p.lon])
    const popupHtml = [
      `<strong class="font-semibold">${escapeHtml(p.title)}</strong>`,
      p.subtitle ? `<div class="text-xs text-gray-600">${escapeHtml(p.subtitle)}</div>` : '',
      `<div class="mt-1 text-xs">${escapeHtml(p.address)}</div>`,
      `<a class="mt-1 inline-block text-xs text-blue-600 underline" href="${osmDirectionsUrl(p.lat, p.lon)}" target="_blank" rel="noopener noreferrer">Маршрут</a>`,
    ].filter(Boolean).join('')
    m.bindPopup(popupHtml)
    group.addLayer(m)
  }
  return group as import('leaflet').Layer
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function osmDirectionsUrl(lat: number, lon: number) {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${lat}%2C${lon}`
}

async function rebuild() {
  destroyMap()
  statusMessage.value = null
  geocodeFailedCount.value = 0

  if (!mapEl.value) return
  if (!props.markers.length) {
    statusMessage.value = 'Нет адресов для карты.'
    return
  }

  if (!L) {
    L = (await import('leaflet')).default
    await import('leaflet/dist/leaflet.css')
    await import('leaflet.markercluster')
    await import('leaflet.markercluster/dist/MarkerCluster.css')
    await import('leaflet.markercluster/dist/MarkerCluster.Default.css')
    await fixDefaultIcons(L)
  }

  statusMessage.value = 'Геокодирование адресов…'

  const { resolved, failed } = await geocodeMarkers(props.markers, props.cityName, 3)
  geocodeFailedCount.value = failed

  if (!resolved.length) {
    statusMessage.value = failed
      ? 'Не удалось отобразить точки на карте (адреса не найдены).'
      : 'Нет точек для карты.'
    return
  }

  statusMessage.value = failed > 0
    ? `На карте: ${resolved.length} из ${props.markers.length} адресов.`
    : null

  map = L.map(mapEl.value, {
    scrollWheelZoom: true,
    attributionControl: true,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  clusterLayer = await buildCluster(L, resolved)
  clusterLayer.addTo(map)

  const bounds = L.latLngBounds(resolved.map((p) => [p.lat, p.lon]))
  map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 })
}

const debounceMs = 320
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRebuild() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void rebuild()
  }, debounceMs)
}

onMounted(() => {
  void nextTick(() => scheduleRebuild())
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  destroyMap()
  L = null
})

watch(
  () => [props.markers, props.cityName] as const,
  () => scheduleRebuild(),
  { deep: true },
)
</script>

<style scoped>
:deep(.leaflet-control-attribution .leaflet-attribution-flag) {
  display: none !important;
}
</style>
