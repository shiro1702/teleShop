<template>
  <div class="relative z-0">
    <div ref="mapEl" class="h-64 w-full rounded-lg border border-gray-200 bg-gray-100" />
    <p class="pointer-events-none absolute bottom-1 right-2 z-[500] rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-gray-600 shadow-sm">
      © OpenStreetMap
    </p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DeliveryZoneFeature } from '~/utils/deliveryZones'

type BranchMapItem = {
  id: string
  name: string
  address: string
  lat?: number | null
  lon?: number | null
}

const props = withDefaults(defineProps<{
  branches: BranchMapItem[]
  allZones: Record<string, DeliveryZoneFeature[]>
  selectedBranchId?: string | null
  allowManualSelect?: boolean
  clientLat?: number | null
  clientLon?: number | null
  clientAddress?: string | null
}>(), {
  selectedBranchId: null,
  allowManualSelect: false,
  clientLat: null,
  clientLon: null,
  clientAddress: null,
})

const emit = defineEmits<{
  selectBranch: [branchId: string]
}>()

const mapEl = ref<HTMLElement | null>(null)
let L: typeof import('leaflet') | null = null
let map: import('leaflet').Map | null = null
let layers: import('leaflet').Layer[] = []
let destroyed = false

function normalizeCoord(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function zoneColor(branchId: string, activeId: string | null) {
  if (branchId === activeId) return '#2563eb'
  return '#6b7280'
}

function clearLayers() {
  if (!map) return
  for (const layer of layers) {
    map.removeLayer(layer)
  }
  layers = []
}

function draw() {
  if (!L || !map) return
  clearLayers()
  const bounds: Array<[number, number]> = []
  const selectedBounds: Array<[number, number]> = []
  const activeBranchId = props.selectedBranchId || null

  for (const branch of props.branches) {
    const zones = props.allZones[branch.id] || []
    for (const zone of zones) {
      const ring = zone.geometry?.coordinates?.[0]
      if (!Array.isArray(ring) || !ring.length) continue
      const polygonLatLng = ring.map(([lon, lat]) => [lat, lon] as [number, number])
      polygonLatLng.forEach((x) => bounds.push(x))
      if (branch.id === activeBranchId) {
        polygonLatLng.forEach((x) => selectedBounds.push(x))
      }
      const poly = L.polygon(polygonLatLng, {
        color: zoneColor(branch.id, activeBranchId),
        fillColor: zoneColor(branch.id, activeBranchId),
        fillOpacity: branch.id === activeBranchId ? 0.2 : 0.08,
        weight: branch.id === activeBranchId ? 2 : 1,
      }).addTo(map)
      poly.bindPopup(`${branch.name}: ${zone.properties.name}`)
      layers.push(poly)
    }

    const branchLat = normalizeCoord(branch.lat)
    const branchLon = normalizeCoord(branch.lon)
    if (branchLat != null && branchLon != null) {
      const marker = L.marker([branchLat, branchLon]).addTo(map)
      marker.bindPopup(`<strong>${branch.name}</strong><br/>${branch.address}`)
      if (props.allowManualSelect) {
        marker.on('click', () => emit('selectBranch', branch.id))
      }
      bounds.push([branchLat, branchLon])
      if (branch.id === activeBranchId) {
        selectedBounds.push([branchLat, branchLon])
      }
      layers.push(marker)
    }
  }

  if (typeof props.clientLat === 'number' && typeof props.clientLon === 'number') {
    const clientMarker = L.circleMarker([props.clientLat, props.clientLon], {
      radius: 7,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map)
    const addressLabel = props.clientAddress?.trim() || 'Адрес клиента'
    clientMarker.bindPopup(`<strong>Клиент</strong><br/>${addressLabel}`)
    bounds.push([props.clientLat, props.clientLon])
    layers.push(clientMarker)
  }

  if (selectedBounds.length > 0) {
    map.fitBounds(L.latLngBounds(selectedBounds), { padding: [24, 24], maxZoom: 15 })
  } else if (bounds.length > 0) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 14 })
  } else {
    map.setView([51.8335, 107.584], 12)
  }
}

async function init() {
  const targetEl = mapEl.value
  if (!targetEl || !targetEl.isConnected || destroyed) return
  if (!L) {
    L = (await import('leaflet')).default
    await import('leaflet/dist/leaflet.css')
    const { default: iconUrl } = await import('leaflet/dist/images/marker-icon.png?url')
    const { default: iconRetinaUrl } = await import('leaflet/dist/images/marker-icon-2x.png?url')
    const { default: shadowUrl } = await import('leaflet/dist/images/marker-shadow.png?url')
    const DefaultIcon = L.Icon.Default as typeof L.Icon.Default & { prototype: { _getIconUrl?: string } }
    delete (DefaultIcon.prototype as { _getIconUrl?: unknown })._getIconUrl
    DefaultIcon.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })
  }
  if (destroyed || !targetEl.isConnected || mapEl.value !== targetEl) return
  if (map) map.remove()
  map = L.map(targetEl, { scrollWheelZoom: true, attributionControl: true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)
  draw()
}

onMounted(() => {
  destroyed = false
  void nextTick(() => init())
})

watch(
  () => [props.branches, props.allZones, props.selectedBranchId, props.allowManualSelect, props.clientLat, props.clientLon, props.clientAddress] as const,
  () => draw(),
  { deep: true },
)

onBeforeUnmount(() => {
  destroyed = true
  clearLayers()
  if (map) map.remove()
  map = null
})
</script>
