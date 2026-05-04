/** Pure helpers for review aggregates (used by server aggregation + unit tests). */

export function averageRatingsFromRows(rows: Array<{ rating: number | null | undefined }>): {
  average: number | null
  count: number
} {
  const sampleCount = rows.length
  if (!sampleCount) return { average: null, count: 0 }
  const sum = rows.reduce((acc, x) => acc + Number(x.rating || 0), 0)
  return {
    average: Number((sum / sampleCount).toFixed(2)),
    count: sampleCount,
  }
}
