import { test, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { PaymentStatus } from '@/generated/prisma/enums'
import paymentPlugin from '@/plugins/payment'

describe('payment plugin', () => {
  let fastifyInstance

  beforeAll(async () => {
    fastifyInstance = Fastify()
    fastifyInstance.decorate('prisma', {
      payment: {
        findMany: vi.fn(),
      },
    })
    await fastifyInstance.register(paymentPlugin)
  })

  afterAll(async () => {
    await fastifyInstance.close()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('getPayments returns empty array when user has no payments', async ({ expect }) => {
    fastifyInstance.prisma.payment.findMany.mockResolvedValue([])

    const user = { id: 1 }
    const result = await fastifyInstance.payment.getPayments(user)

    expect(result).toEqual([])
    expect(fastifyInstance.prisma.payment.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  test('getPayments returns serialized payments when user has payments', async ({ expect }) => {
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
        cancelRequestedAt: null,
        canceledAt: null,
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
        cancelRequestedAt: null,
        canceledAt: null,
        order: null,
      },
    ]

    fastifyInstance.prisma.payment.findMany.mockResolvedValue(mockPayments)

    const user = { id: 1 }
    const result = await fastifyInstance.payment.getPayments(user)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[0].amountUsd).toBe(100.5)
    expect(result[0].quantity).toBe(2)
    expect(result[1].id).toBe(2)
    expect(result[1].amountUsd).toBe(200)
    expect(result[1].quantity).toBeNull()

    expect(fastifyInstance.prisma.payment.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    })
  })
})
