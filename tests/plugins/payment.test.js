import { test, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { PaymentStatus } from '@/generated/prisma/enums'
import paymentPlugin, { PAYMENT_WINDOW_MS, canCancelPayment, serializePayment } from '@/plugins/payment'

describe('payment helpers', () => {
  test('canCancelPayment returns false when status is not Completed', ({ expect }) => {
    const payment = { status: PaymentStatus.Pending, createdAt: new Date().toISOString() }
    expect(canCancelPayment(payment)).toBe(false)
  })

  test('canCancelPayment returns false when createdAt is outside 24h window', ({ expect }) => {
    const oldDate = new Date(Date.now() - PAYMENT_WINDOW_MS - 1000).toISOString()
    const payment = { status: PaymentStatus.Completed, createdAt: oldDate }
    expect(canCancelPayment(payment)).toBe(false)
  })

  test('canCancelPayment returns true when status is Completed and within 24h window', ({ expect }) => {
    const recentDate = new Date(Date.now() - 1000).toISOString()
    const payment = { status: PaymentStatus.Completed, createdAt: recentDate }
    expect(canCancelPayment(payment)).toBe(true)
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
      cancelRequestedAt: null,
      canceledAt: null,
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
      cancelRequestedAt: null,
      canceledAt: null,
      canCancel: true,
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
      cancelRequestedAt: null,
      canceledAt: null,
      order: null,
    }

    const result = serializePayment(payment)

    expect(result.quantity).toBeNull()
    expect(result.canCancel).toBe(false)
  })
})

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
