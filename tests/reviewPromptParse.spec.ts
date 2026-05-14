import { describe, expect, it } from 'vitest'
import { parseMaxReviewRateStartPayload, parseReviewTokenCallback } from '../server/utils/reviewPromptParse'

describe('parseReviewTokenCallback', () => {
  it('parses rate', () => {
    const r = parseReviewTokenCallback('rt_abcdef012345_4')
    expect(r).toEqual({ ok: true, token: 'abcdef012345', action: 'rate', stars: 4 })
  })
  it('parses edit', () => {
    expect(parseReviewTokenCallback('rt_abcdef012345_e')).toEqual({
      ok: true,
      token: 'abcdef012345',
      action: 'edit',
    })
  })
  it('rejects bad token length', () => {
    expect(parseReviewTokenCallback('rt_abc_1').ok).toBe(false)
  })
})

describe('parseMaxReviewRateStartPayload', () => {
  const oid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  it('parses order and stars', () => {
    expect(parseMaxReviewRateStartPayload(`reviewrate_${oid}_5`)).toEqual({ orderId: oid, stars: 5 })
  })
  it('rejects bad uuid', () => {
    expect(parseMaxReviewRateStartPayload('reviewrate_not-uuid_3')).toBeNull()
  })
})
