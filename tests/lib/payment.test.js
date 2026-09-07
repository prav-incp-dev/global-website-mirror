import { test } from 'vitest'
import { PaymentStatus } from '@/generated/prisma/enums'
import { serializePayment } from '@/lib/payment'

describe('payment helpers', () => {
  test('serializePayment correctly serializes a payment with order', ({ expect }) => {
    const recentDate = new Date().toISOString()
    const payment = {
      id: 1,
      uid: 'ON-1234-01',
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
      uid: 'ON-1234-01',
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
    })
  })

  test('serializePayment returns null quantity when order is missing', ({ expect }) => {
    const payment = {
      id: 2,
      uid: 'ON-5678-02',
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
    expect(result.uid).toBe('ON-5678-02')
  })
})
