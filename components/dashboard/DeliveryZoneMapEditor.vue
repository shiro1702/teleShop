<template>
  <div
    class="relative z-0 isolate"
    :class="{ 'pointer-events-none opacity-60': disabled }"
  >
    <div
      ref="mapEl"
      class="min-h-[320px] w-full rounded-lg border border-gray-200 bg-gray-100"
    />
    <p class="pointer-events-none absolute bottom-1 right-2 z-[500] rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-gray-600 shadow-sm">
      © OpenStreetMap
    </p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { extractPolygonCoordinatesFromGeoJson } from '~/utils/geoPolygon'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    /** JSON для восстановления после полного удаления фигуры с карты */
    defaultPolygonJson?: string
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  warn: [message: string]
}>()

const mapEl = ref<HTMLElement | null>(null)

let L: typeof import('leaflet') | null = null
let map: import('leaflet').Map | null = null
let drawnItems: import('leaflet').FeatureGroup | null = null
let drawControl: import('leaflet').Control.Draw | null = null

const lastEmitted = ref('')

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

function defaultFallbackJson(): string {
  return props.defaultPolygonJson ?? '{"type":"Polygon","coordinates":[[[107.6,51.84],[107.62,51.84],[107.62,51.82],[107.6,51.82],[107.6,51.84]]]}'
}

function ringToPolygon(coords: number[][][]): { type: 'Polygon'; coordinates: number[][][] } {
  return { type: 'Polygon', coordinates: coords }
}

/** Один внешний контур без дыр; иначе null — в т.ч. MultiPolygon. */
function parseMvpPolygonFromText(text: string): { normalized: string; coords: number[][][] } | null {
  try {
    let parsed = JSON.parse(text) as unknown
    // Некоторые записи могут храниться как JSON-строка внутри JSON.
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed) as unknown
    }
    const coords = extractPolygonCoordinatesFromGeoJson(parsed)
    if (!coords || coords.length > 1) return null
    return {
      normalized: JSON.stringify(ringToPolygon(coords), null, 2),
      coords,
    }
  } catch {
    return null
  }
}

function serializeLayers(): string | null {
  if (!L || !drawnItems) return null
  const layers = drawnItems.getLayers()
  if (layers.length === 0) return null

  const layer = layers[0] as import('leaflet').Layer & { toGeoJSON: () => GeoJSON.Feature }
  const gj = layer.toGeoJSON()
  const geom = gj.geometry
  if (!geom || geom.type !== 'Polygon') {
    emit('warn', 'На карте должна быть одна фигура типа Polygon.')
    return null
  }
  const coords = geom.coordinates as number[][][]
  if (coords.length > 1) {
    emit('warn', 'Полигон с дырками не поддерживается в редакторе — задайте зону вручную в JSON.')
    return null
  }
  return JSON.stringify(ringToPolygon(coords), null, 2)
}

function emitFromMap() {
  const str = serializeLayers()
  if (str === null) return
  lastEmitted.value = str
  emit('update:modelValue', str)
}

function syncFromMap() {
  emitFromMap()
}

function emitEmptyOrDefault() {
  emit('warn', 'На карте нет полигона — подставлен полигон по умолчанию. При необходимости отредактируйте JSON.')
  const fallback = defaultFallbackJson()
  lastEmitted.value = fallback
  emit('update:modelValue', fallback)
}

function destroyMap() {
  if (map) {
    map.remove()
    map = null
  }
  drawnItems = null
  drawControl = null
}

function loadFromModelValue(text: string) {
  if (!L || !map || !drawnItems) return

  const parsed = parseMvpPolygonFromText(text)
  if (parsed === null) {
    emit('warn', 'Нужен Polygon или Feature с Polygon (без MultiPolygon и без дыр). Упростите GeoJSON или правьте вручную.')
    return
  }
  if (parsed.normalized === lastEmitted.value) return

  const { coords } = parsed
  drawnItems.clearLayers()
  const poly = ringToPolygon(coords)
  const gj = L.geoJSON(poly as GeoJSON.GeoJSON)
  gj.eachLayer((layer) => {
    drawnItems!.addLayer(layer)
  })

  try {
    const b = drawnItems.getBounds()
    if (b.isValid()) {
      map.fitBounds(b, { padding: [28, 28], maxZoom: 16 })
    }
  } catch {
    // ignore
  }

  lastEmitted.value = parsed.normalized
}

async function initMap() {
  if (!mapEl.value) return

  L = (await import('leaflet')).default
  await import('leaflet-draw')
  await import('leaflet/dist/leaflet.css')
  await import('leaflet-draw/dist/leaflet.draw.css')
  await fixDefaultIcons(L)

  const Lm = L

  map = Lm.map(mapEl.value, {
    scrollWheelZoom: true,
    attributionControl: true,
  })

  Lm.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  drawnItems = new Lm.FeatureGroup()
  drawnItems.addTo(map)

  drawControl = new Lm.Control.Draw({
    position: 'topleft',
    draw: {
      polygon: {
        allowIntersection: false,
        showArea: false,
      },
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false,
      circlemarker: false,
    },
    edit: {
      featureGroup: drawnItems,
      remove: true,
    },
  })
  map.addControl(drawControl)

  const Ev = Lm.Draw.Event

  map.on(Ev.CREATED, (e: import('leaflet').LeafletEvent & { layer: import('leaflet').Layer }) => {
    drawnItems!.clearLayers()
    drawnItems!.addLayer(e.layer)
    emitFromMap()
  })

  map.on(Ev.EDITED, () => {
    emitFromMap()
  })

  map.on(Ev.DELETED, () => {
    if (drawnItems!.getLayers().length === 0) {
      emitEmptyOrDefault()
    } else {
      emitFromMap()
    }
  })

  loadFromModelValue(props.modelValue)
  if (drawnItems!.getLayers().length === 0) {
    try {
      const parsed = JSON.parse(defaultFallbackJson()) as { coordinates?: number[][][] }
      const ring = parsed.coordinates?.[0]
      if (ring?.length) {
        const latlngs = ring.map(([lng, lat]) => Lm.latLng(lat, lng))
        const b = Lm.latLngBounds(latlngs)
        map.fitBounds(b, { padding: [28, 28], maxZoom: 14 })
      }
    } catch {
      map.setView([51.83, 107.61], 12)
    }
  }

  applyMapInteractionDisabled(props.disabled)
}

function applyMapInteractionDisabled(disabled: boolean) {
  if (!map) return
  if (disabled) {
    map.dragging.disable()
    map.doubleClickZoom.disable()
    map.scrollWheelZoom.disable()
    if (map.touchZoom) map.touchZoom.disable()
  } else {
    map.dragging.enable()
    map.doubleClickZoom.enable()
    map.scrollWheelZoom.enable()
    if (map.touchZoom) map.touchZoom.enable()
  }
}

onMounted(() => {
  void nextTick(() => {
    void initMap()
  })
})

onBeforeUnmount(() => {
  destroyMap()
  L = null
})

watch(
  () => props.modelValue,
  (v: string) => {
    void nextTick(() => {
      loadFromModelValue(v)
    })
  },
)

watch(
  () => props.disabled,
  (disabled: boolean) => {
    applyMapInteractionDisabled(disabled)
  },
)

defineExpose({
  syncFromMap,
})
</script>
