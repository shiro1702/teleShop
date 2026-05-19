import { describe, expect, it } from 'vitest'
import { parseMessengerStorageValue } from '~/composables/useMessengerStorage'

describe('parseMessengerStorageValue', () => {
  it('returns string as-is', () => {
    expect(parseMessengerStorageValue('{"a":1}')).toBe('{"a":1}')
  })

  it('reads MAX DeviceStorage object shape', () => {
    expect(parseMessengerStorageValue({ status: 'ok', value: '[]' })).toBe('[]')
  })

  it('returns null for empty', () => {
    expect(parseMessengerStorageValue(null)).toBeNull()
    expect(parseMessengerStorageValue({ value: null })).toBeNull()
  })
})
