/**
 * Point-in-polygon (ray casting). Coordinates: [lon, lat] per GeoJSON.
 * Uses the first ring of the first polygon in `polygons`.
 */
export function pointInPolygon(point: [number, number], polygons: number[][][]): boolean {
  const [x, y] = point
  const polygon = polygons[0]
  if (!polygon?.length) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi

    if (intersect) inside = !inside
  }

  return inside
}

export function extractPolygonCoordinatesFromGeoJson(raw: unknown): number[][][] | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.type === 'Feature') {
    const geom = r.geometry as { type?: string; coordinates?: number[][][] } | undefined
    if (geom?.type === 'Polygon' && Array.isArray(geom.coordinates)) {
      return geom.coordinates as number[][][]
    }
    return null
  }
  if (r.type === 'Polygon') {
    const coords = r.coordinates
    return Array.isArray(coords) ? (coords as number[][][]) : null
  }
  const geom = r.geometry as { type?: string; coordinates?: number[][][] } | undefined
  if (geom?.type === 'Polygon' && Array.isArray(geom.coordinates)) {
    return geom.coordinates as number[][][]
  }
  return null
}
