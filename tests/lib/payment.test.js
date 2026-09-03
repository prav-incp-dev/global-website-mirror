import { test } from 'vitest'
import { PaymentStatus } from '@/generated/prisma/enums'
import { PAYMENT_WINDOW_MS, canRequestRefund, serializePayment } from '@/lib/payment'

describe('payment helpers', () => {
  test('canRequestRefund returns false when status is not Completed', ({ expect }) => {
    const payment = { status: PaymentStatus.Pending, createdAt: new Date().toISOString() }
    expect(canRequestRefund(payment)).toBe(false)
  })

  test('canRequestRefund returns false when createdAt is outside 24h window', ({ expect }) => {
    const oldDate = new Date(Date.now() - PAYMENT_WINDOW_MS - 1000).toISOString()
    const payment = { status: PaymentStatus.Completed, createdAt: oldDate }
    expect(canRequestRefund(payment)).toBe(false)
  })

  test('canRequestRefund returns true when status is Completed and within 24h window', ({ expect }) => {
    const recentDate = new Date(Date.now() - 1000).toISOString()
    const payment = { status: PaymentStatus.Completed, createdAt: recentDate }
    expect(canRequestRefund(payment)).toBe(true)
  })

  test('serializePayment correctly serializes a payment with order', ({ expect }) => {
    const recentDate = new Date().toISOString()
    const payment = {
      id: 1,
      orderId: 10,
      amount: '100.50',
      status: PaymentStatus.Completed,
      txHash: '0xabc123',
      fromWallet: '0xfrom',
      toWallet: '0xto',
      chainId: 97,
      tokenSymbol: 'USDT',
      tokenContract: '0xtoken',
      tokenDecimals: 18,
      createdAt: recentDate,
      updatedAt: new Date('2025-01-02').toISOString(),
      refundRequestedAt: null,
      refundedAt: null,
      order: { quantity: 3 },
    }

    const result = serializePayment(payment)

    expect(result).toEqual({
      id: 1,
      orderId: 10,
      quantity: 3,
      amountUsd: 100.5,
      status: PaymentStatus.Completed,
      txHash: '0xabc123',
      fromWallet: '0xfrom',
      toWallet: '0xto',
      chainId: 97,
      tokenSymbol: 'USDT',
      tokenContract: '0xtoken',
      tokenDecimals: 18,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      refundRequestedAt: null,
      refundedAt: null,
      canRequestRefund: true,
    })
  })

  test('serializePayment returns null quantity when order is missing', ({ expect }) => {
    const payment = {
      id: 2,
      orderId: null,
      amount: '50',
      status: PaymentStatus.Pending,
      txHash: null,
      fromWallet: '0xfrom',
      toWallet: null,
      chainId: 97,
      tokenSymbol: 'USDT',
      tokenContract: null,
      tokenDecimals: 18,
      createdAt: new Date('2025-01-01').toISOString(),
      updatedAt: new Date('2025-01-02').toISOString(),
      refundRequestedAt: null,
      refundedAt: null,
      order: null,
    }

    const result = serializePayment(payment)

    expect(result.quantity).toBeNull()
    expect(result.canRequestRefund).toBe(false)
  })
})
