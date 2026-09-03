import { describe, it, vi } from 'vitest'
import { createApp } from '../helpers'
import { PaymentStatus } from '@/generated/prisma/enums'

describe('payment plugin', () => {
  it('getPayments returns empty array when user has no payments', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(app.prisma.payment, 'findMany').mockResolvedValue([])

    const user = { id: 1 }
    const result = await app.payment.getPayments(user)

    expect(result).toEqual([])
    expect(app.prisma.payment.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('getPayments returns serialized payments when user has payments', async ({ expect }) => {
    const app = await createApp()

    const mockPayments = [
      {
        id: 1,
        orderId: 10,
        amount: '100.50',
        status: PaymentStatus.Completed,
        txHash: '0xabc',
        fromWallet: '0xfrom',
        toWallet: '0xto',
        chainId: 97,
        tokenSymbol: 'USDT',
        tokenContract: '0xtoken',
        tokenDecimals: 18,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        refundRequestedAt: null,
        refundedAt: null,
        order: { quantity: 2 },
      },
      {
        id: 2,
        orderId: null,
        amount: '200',
        status: PaymentStatus.Failed,
        txHash: null,
        fromWallet: '0xfrom2',
        toWallet: null,
        chainId: 97,
        tokenSymbol: 'USDT',
        tokenContract: null,
        tokenDecimals: 18,
        createdAt: new Date(Date.now() - 100000).toISOString(),
        updatedAt: new Date(Date.now() - 100000).toISOString(),
        refundRequestedAt: null,
        refundedAt: null,
        order: null,
      },
    ]

    vi.spyOn(app.prisma.payment, 'findMany').mockResolvedValue(mockPayments)

    const user = { id: 1 }
    const result = await app.payment.getPayments(user)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[0].amountUsd).toBe(100.5)
    expect(result[0].quantity).toBe(2)
    expect(result[1].id).toBe(2)
    expect(result[1].amountUsd).toBe(200)
    expect(result[1].quantity).toBeNull()

    expect(app.prisma.payment.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    })
  })
})
