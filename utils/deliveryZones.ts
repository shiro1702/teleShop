// Простая конфигурация зон доставки в формате GeoJSON

export interface DeliveryZoneProperties {
  slug: string
  name: string
  minOrderAmount: number
  deliveryCost: number
  freeDeliveryThreshold: number
}

export interface DeliveryZoneFeature {
  type: 'Feature'
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  properties: DeliveryZoneProperties
}

const DELIVERY_ZONES: DeliveryZoneFeature[] = [
  {
    type: 'Feature',
    properties: {
      slug: 'center',
      name: 'Центр',
      minOrderAmount: 1000,
      deliveryCost: 0,
      freeDeliveryThreshold: 1500,
    },
    // Условный квадрат вокруг точки (55.75, 37.6)
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [37.58, 55.76],
          [37.62, 55.76],
          [37.62, 55.74],
          [37.58, 55.74],
          [37.58, 55.76],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    properties: {
      slug: 'outer',
      name: 'Внешняя зона',
      minOrderAmount: 1500,
      deliveryCost: 200,
      freeDeliveryThreshold: 2500,
    },
    // Кольцо чуть шире вокруг центра
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [37.54, 55.78],
          [37.66, 55.78],
          [37.66, 55.72],
          [37.54, 55.72],
          [37.54, 55.78],
        ],
      ],
    },
  },
]

export function getDeliveryZones(): DeliveryZoneFeature[] {
  return DELIVERY_ZONES
}

