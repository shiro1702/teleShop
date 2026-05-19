import { describe, expect, it } from 'vitest'
import {
  buildBranchCancelCallback,
  buildBranchMenuCallback,
  buildBranchPickCallback,
  buildManagerOrderInlineKeyboard,
  parseBranchCallback,
  shouldNotifyCustomerOfStatus,
} from '../server/utils/orderChatFlowPure'

const ORDER_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('orderChatFlow callbacks', () => {
  it('parses branch menu and pick callbacks within telegram 64-byte limit', () => {
    const menu = buildBranchMenuCallback(ORDER_ID)
    expect(menu.length).toBeLessThanOrEqual(64)
    expect(parseBranchCallback(menu)).toEqual({ kind: 'menu', orderId: ORDER_ID })

    const pick = buildBranchPickCallback(3, ORDER_ID)
    expect(pick.length).toBeLessThanOrEqual(64)
    expect(parseBranchCallback(pick)).toEqual({ kind: 'pick', branchIndex: 3, orderId: ORDER_ID })

    const cancel = buildBranchCancelCallback(ORDER_ID)
    expect(parseBranchCallback(cancel)).toEqual({ kind: 'cancel', orderId: ORDER_ID })
  })

  it('builds pickup and delivery keyboards', () => {
    const delivery = buildManagerOrderInlineKeyboard({
      orderId: ORDER_ID,
      fulfillmentType: 'delivery',
      orderStatus: 'in_progress',
      branchPickerEnabled: true,
    })
    expect(delivery.inline_keyboard.some((row) => row.some((b) => b.callback_data === `courier__${ORDER_ID}`))).toBe(true)

    const pickup = buildManagerOrderInlineKeyboard({
      orderId: ORDER_ID,
      fulfillmentType: 'pickup',
      orderStatus: 'in_progress',
      branchPickerEnabled: false,
    })
    expect(pickup.inline_keyboard.some((row) => row.some((b) => b.callback_data === `pickup__${ORDER_ID}`))).toBe(true)
  })

  it('does not notify customer for internal new status', () => {
    expect(shouldNotifyCustomerOfStatus('new')).toBe(false)
    expect(shouldNotifyCustomerOfStatus('in_progress')).toBe(true)
    expect(shouldNotifyCustomerOfStatus('ready_for_pickup')).toBe(true)
  })
})
