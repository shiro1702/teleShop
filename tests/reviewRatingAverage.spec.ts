import { describe, expect, it } from 'vitest'
import { averageRatingsFromRows } from '../utils/reviewRatingAverage'

describe('averageRatingsFromRows', () => {
  it('returns null when empty', () => {
    expect(averageRatingsFromRows([])).toEqual({ average: null, count: 0 })
  })

  it('averages last-N style rows (simple mean)', () => {
    const rows = [{ rating: 5 }, { rating: 4 }, { rating: 5 }]
    expect(averageRatingsFromRows(rows)).toEqual({ average: 4.67, count: 3 })
  })

  it('treats null rating as 0', () => {
    expect(averageRatingsFromRows([{ rating: null }, { rating: 4 }])).toEqual({ average: 2, count: 2 })
  })
})
