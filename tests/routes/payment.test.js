import { beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'
import { buildBackendApp } from '../../backend.js'
import { PaymentStatus, UserRole } from '../../src/generated/prisma/client'
import { PAYMENT_WINDOW_MS } from '@/plugins/payment'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

vi.mock('viem', () => {
  const getTransactionReceipt = vi.fn()

  return {
    createPublicClient: vi.fn(() => ({
      getTransactionReceipt,
    })),
    http: vi.fn(() => 'mock-transport'),
    getAddress: vi.fn((addr) => addr?.toLowerCase()),
    parseEventLogs: vi.fn(),
    parseUnits: vi.fn(),
    getTransactionReceipt,
  }
})

const mockGetTransactionReceipt = async () => {
  const { getTransactionReceipt } = await import('viem')
  return getTransactionReceipt
}

const createApp = async (authOverrides = {}, prismaOverrides = {}) => {
  const app = await buildBackendApp({
    logger: false,
    auth: {
      enableCsrf: false,
    },
  })

  onTestFinished(async () => {
    await app.close()
  })

  const defaultPrisma = {
    order: {
      create: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  }

  app.prisma = {
    ...defaultPrisma,
    ...prismaOverrides,
  }

  const defaultAuth = {
    getUser: vi.fn().mockResolvedValue(null),
  }

  app.auth.getUser = authOverrides.getUser || defaultAuth.getUser

  return { app, auth: app.auth }
}

const candidateUser = {
  id: 2,
  role: UserRole.Candidate,
  company: {
    id: 1,
    primaryWallet: '0x1111111111111111111111111111111111111111',
  },
}

describe('payments routes', () => {
  // --- GET /api/payments ---

  it('GET /api/payments returns 403 when user is not authenticated', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(null),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/payments',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('GET /api/payments returns 403 when user is Admin', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue({ id: 1, role: UserRole.Admin }),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/payments',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('GET /api/payments returns empty list when user has no payments', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/payments',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true, payments: [] })
  })

  it('GET /api/payments returns serialized payments', async () => {
    const now = new Date('2026-07-30T10:00:00.000Z')
    vi.spyOn(Date, 'now').mockReturnValue(now.getTime() + 1000)
    const mockPayment = {
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      amount: 1200,
      status: PaymentStatus.Completed,
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      fromWallet: '0x2222222222222222222222222222222222222222',
      toWallet: candidateUser.company.primaryWallet,
      chainId: 97,
      tokenSymbol: 'USDT',
      tokenContract: '0x3333333333333333333333333333333333333333',
      tokenDecimals: 18,
      cancelRequestedAt: null,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
      order: { id: 7, quantity: 1 },
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([mockPayment]),
        },
      },
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/payments',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.payments).toHaveLength(1)
    expect(body.payments[0]).toEqual({
      id: 11,
      orderId: 7,
      quantity: 1,
      amountUsd: 1200,
      status: PaymentStatus.Completed,
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      fromWallet: '0x2222222222222222222222222222222222222222',
      toWallet: candidateUser.company.primaryWallet,
      chainId: 97,
      tokenSymbol: 'USDT',
      tokenContract: '0x3333333333333333333333333333333333333333',
      tokenDecimals: 18,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      cancelRequestedAt: null,
      canceledAt: null,
      canCancel: true,
    })
  })

  it('GET /api/payments does not return other users payments', async () => {
    const now = new Date('2026-07-30T10:00:00.000Z')
    const otherPayment = {
      id: 99,
      orderId: 77,
      userId: 999,
      amount: 1200,
      status: PaymentStatus.Completed,
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      fromWallet: '0x2222222222222222222222222222222222222222',
      toWallet: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      chainId: 97,
      tokenSymbol: 'USDT',
      tokenContract: '0x3333333333333333333333333333333333333333',
      tokenDecimals: 18,
      cancelRequestedAt: null,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
      order: { id: 77, quantity: 1 },
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([otherPayment]),
        },
      },
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/payments',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().payments).toHaveLength(1)
    expect(app.prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: candidateUser.id },
      }),
    )
  })

  // --- POST /api/payments/init ---

  it('POST /api/payments/init returns 403 when user is not authenticated', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(null),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
        chainId: 97,
        tokenContract: '0x3333333333333333333333333333333333333333',
        tokenDecimals: 18,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('POST /api/payments/init returns 403 when user is Admin', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue({ id: 1, role: UserRole.Admin }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
        chainId: 97,
        tokenContract: '0x3333333333333333333333333333333333333333',
        tokenDecimals: 18,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('POST /api/payments/init returns 409 when company wallet is missing', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue({
        ...candidateUser,
        company: { id: 1, primaryWallet: null },
      }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
        chainId: 97,
        tokenContract: '0x3333333333333333333333333333333333333333',
        tokenDecimals: 18,
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'У компании не указан кошелек для приема платежей' })
  })

  it('POST /api/payments/init creates pending order and payment', async () => {
    const createdOrder = {
      id: 7,
      payment: {
        id: 11,
      },
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        order: {
          create: vi.fn().mockResolvedValue(createdOrder),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
        chainId: 97,
        tokenContract: '0x3333333333333333333333333333333333333333',
        tokenDecimals: 18,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      paymentId: 11,
      orderId: 7,
      amountUsd: 1200,
    })
    expect(app.prisma.order.create).toHaveBeenCalledTimes(1)
  })

  it('POST /api/payments/init returns 500 on unexpected error', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        order: {
          create: vi.fn().mockRejectedValue(new Error('db unavailable')),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
        chainId: 97,
        tokenContract: '0x3333333333333333333333333333333333333333',
        tokenDecimals: 18,
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка создания платежа' })
  })

  // --- POST /api/payments/:id/attach-tx ---

  it('POST /api/payments/:id/attach-tx returns 403 when user is not authenticated', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(null),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/attach-tx',
      payload: {
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        fromWallet: '0x2222222222222222222222222222222222222222',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('POST /api/payments/:id/attach-tx returns 403 when user is Admin', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue({ id: 1, role: UserRole.Admin }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/attach-tx',
      payload: {
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        fromWallet: '0x2222222222222222222222222222222222222222',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('POST /api/payments/:id/attach-tx returns 404 when payment not found', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/99999/attach-tx',
      payload: {
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        fromWallet: '0x2222222222222222222222222222222222222222',
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
  })

  it('POST /api/payments/:id/attach-tx returns 404 when payment belongs to another user', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: 999,
            status: PaymentStatus.Pending,
            txHash: null,
            order: { id: 7, quantity: 1 },
          }),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/attach-tx',
      payload: {
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        fromWallet: '0x2222222222222222222222222222222222222222',
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
  })

  it('POST /api/payments/:id/attach-tx returns 409 when payment is not Pending', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Completed,
            txHash: null,
            order: { id: 7, quantity: 1 },
          }),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/attach-tx',
      payload: {
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        fromWallet: '0x2222222222222222222222222222222222222222',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Платеж уже не в ожидании' })
  })

  it('POST /api/payments/:id/attach-tx returns 409 when txHash already set', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Pending,
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            order: { id: 7, quantity: 1 },
          }),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/attach-tx',
      payload: {
        txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        fromWallet: '0x2222222222222222222222222222222222222222',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция уже привязана к платежу' })
  })

  it('POST /api/payments/:id/attach-tx updates payment with txHash and fromWallet', async () => {
    const now = new Date('2026-07-30T10:00:00.000Z')
    const updatedPayment = {
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      amount: 1200,
      status: PaymentStatus.Pending,
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      fromWallet: '0x2222222222222222222222222222222222222222',
      toWallet: candidateUser.company.primaryWallet,
      chainId: 97,
      tokenSymbol: 'USDT',
      tokenContract: '0x3333333333333333333333333333333333333333',
      tokenDecimals: 18,
      cancelRequestedAt: null,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
      order: { id: 7, quantity: 1 },
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Pending,
            txHash: null,
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn().mockResolvedValue(updatedPayment),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/attach-tx',
      payload: {
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        fromWallet: '0x2222222222222222222222222222222222222222',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.txHash).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(body.fromWallet).toBe('0x2222222222222222222222222222222222222222')
    expect(app.prisma.payment.update).toHaveBeenCalledTimes(1)
  })

  it('POST /api/payments/:id/attach-tx returns 409 on duplicate txHash', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Pending,
            txHash: null,
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn().mockRejectedValue({ code: 'P2002' }),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/attach-tx',
      payload: {
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        fromWallet: '0x2222222222222222222222222222222222222222',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция уже сохранена' })
  })

  it('POST /api/payments/:id/attach-tx returns 500 on unexpected error', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Pending,
            txHash: null,
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn().mockRejectedValue(new Error('db unavailable')),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/attach-tx',
      payload: {
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        fromWallet: '0x2222222222222222222222222222222222222222',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка привязки транзакции' })
  })

  // --- POST /api/payments/:id/verify ---

  it('POST /api/payments/:id/verify returns 403 when user is not authenticated', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(null),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('POST /api/payments/:id/verify returns 403 when user is Admin', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue({ id: 1, role: UserRole.Admin }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('POST /api/payments/:id/verify returns 404 when payment not found', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/99999/verify',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
  })

  it('POST /api/payments/:id/verify returns 409 when payment is not Pending', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Completed,
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            order: { id: 7, quantity: 1 },
          }),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Платеж уже не в ожидании' })
  })

  it('POST /api/payments/:id/verify returns 409 when no txHash attached', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Pending,
            txHash: null,
            order: { id: 7, quantity: 1 },
          }),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция ещё не привязана к платежу' })
  })

  const pendingPayment = {
    id: 11,
    orderId: 7,
    userId: candidateUser.id,
    amount: 1200,
    status: PaymentStatus.Pending,
    txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    fromWallet: '0x2222222222222222222222222222222222222222',
    toWallet: '0x1111111111111111111111111111111111111111',
    tokenContract: '0x3333333333333333333333333333333333333333',
    tokenDecimals: 18,
    order: { id: 7, quantity: 1 },
  }

  it('POST /api/payments/:id/verify returns 409 when receipt is null', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockResolvedValueOnce(null)

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(pendingPayment),
          update: vi.fn().mockResolvedValue({}),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция не была подтверждена сетью' })
  })

  const buildReceipt = (overrides = {}) => {
    return {
      status: 'success',
      to: '0x3333333333333333333333333333333333333333',
      from: '0x2222222222222222222222222222222222222222',
      logs: [],
      ...overrides,
    }
  }

  const setupVerifyMocks = async (overrides = {}) => {
    const viMod = await import('viem')
    viMod.getTransactionReceipt.mockResolvedValueOnce(buildReceipt(overrides))
    viMod.parseEventLogs.mockReturnValueOnce([
      {
        eventName: 'Transfer',
        args: {
          from: '0x2222222222222222222222222222222222222222',
          to: '0x1111111111111111111111111111111111111111',
          value: 1200000000000000000000n,
        },
      },
    ])
    viMod.parseUnits.mockReturnValueOnce(1200000000000000000000n)
  }

  it('POST /api/payments/:id/verify uses fallback RPC URL when env var is unset', async () => {
    vi.stubEnv('VITE_BSC_TESTNET_RPC_URL', '')
    await setupVerifyMocks()

    const now = new Date('2026-07-30T10:00:00.000Z')
    const completedPayment = {
      ...pendingPayment,
      status: PaymentStatus.Completed,
      chainId: 97,
      tokenSymbol: 'USDT',
      cancelRequestedAt: null,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(pendingPayment),
          update: vi.fn().mockResolvedValue(completedPayment),
        },
        $transaction: vi.fn().mockResolvedValue([completedPayment]),
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe(PaymentStatus.Completed)
  })

  it('POST /api/payments/:id/verify completes payment on success receipt', async () => {
    await setupVerifyMocks()

    const now = new Date('2026-07-30T10:00:00.000Z')
    const completedPayment = {
      ...pendingPayment,
      status: PaymentStatus.Completed,
      chainId: 97,
      tokenSymbol: 'USDT',
      cancelRequestedAt: null,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(pendingPayment),
          update: vi.fn().mockResolvedValue(completedPayment),
        },
        $transaction: vi.fn().mockResolvedValue([completedPayment]),
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.status).toBe(PaymentStatus.Completed)
  })

  it('POST /api/payments/:id/verify returns 409 when token contract does not match', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockResolvedValueOnce(buildReceipt({ to: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }))

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Pending,
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция не была подтверждена сетью' })
  })

  it('POST /api/payments/:id/verify returns 409 when sender does not match', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockResolvedValueOnce(buildReceipt({ from: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }))

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Pending,
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция не была подтверждена сетью' })
  })

  it('POST /api/payments/:id/verify returns 409 when transfer details do not match', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockResolvedValueOnce(buildReceipt())

    const viMod = await import('viem')
    viMod.parseEventLogs.mockReturnValueOnce([])
    viMod.parseUnits.mockReturnValueOnce(1200000000000000000000n)

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Pending,
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция не была подтверждена сетью' })
  })

  it('POST /api/payments/:id/verify returns 409 on failed receipt', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockRejectedValueOnce(new Error('Transaction not confirmed on chain'))

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Pending,
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция не была подтверждена сетью' })
  })

  it('POST /api/payments/:id/verify returns 500 on unexpected error', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockRejectedValueOnce(new Error('RPC timeout'))

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Pending,
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn(),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка верификации платежа' })
  })

  // --- POST /api/payments/:id/cancel ---

  it('POST /api/payments/:id/cancel returns 403 when user is not authenticated', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(null),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('POST /api/payments/:id/cancel returns 409 for too old payment', async () => {
    const oldDate = new Date(Date.now() - PAYMENT_WINDOW_MS - 1000)
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            status: PaymentStatus.Completed,
            createdAt: oldDate,
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn(),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Запрос на отмену можно оставить только в течение 24 часов' })
    expect(app.prisma.payment.update).not.toHaveBeenCalled()
  })

  it('POST /api/payments/:id/cancel marks payment as ToCancel', async () => {
    const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const updatedAt = new Date('2026-07-30T12:00:00.000Z')

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            amount: 1200,
            status: PaymentStatus.Completed,
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            fromWallet: '0x2222222222222222222222222222222222222222',
            toWallet: candidateUser.company.primaryWallet,
            chainId: 97,
            tokenSymbol: 'USDT',
            tokenContract: '0x3333333333333333333333333333333333333333',
            tokenDecimals: 18,
            cancelRequestedAt: null,
            canceledAt: null,
            createdAt,
            updatedAt: createdAt,
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: candidateUser.id,
            amount: 1200,
            status: PaymentStatus.ToCancel,
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            fromWallet: '0x2222222222222222222222222222222222222222',
            toWallet: candidateUser.company.primaryWallet,
            chainId: 97,
            tokenSymbol: 'USDT',
            tokenContract: '0x3333333333333333333333333333333333333333',
            tokenDecimals: 18,
            cancelRequestedAt: updatedAt,
            canceledAt: null,
            createdAt,
            updatedAt,
            order: { id: 7, quantity: 1 },
          }),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().success).toBe(true)
    expect(response.json().payment.status).toBe(PaymentStatus.ToCancel)
    expect(response.json().payment.canCancel).toBe(false)
    expect(app.prisma.payment.update).toHaveBeenCalledTimes(1)
  })

  it('POST /api/payments/:id/cancel returns 403 when user is Admin', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue({ id: 1, role: UserRole.Admin }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('POST /api/payments/:id/cancel returns 404 when payment not found', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/99999/cancel',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
    expect(app.prisma.payment.update).not.toHaveBeenCalled()
  })

  it('POST /api/payments/:id/cancel returns 404 when payment belongs to another user', async () => {
    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(candidateUser),
      },
      {
        payment: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            orderId: 7,
            userId: 999,
            status: PaymentStatus.Completed,
            createdAt: new Date(),
            order: { id: 7, quantity: 1 },
          }),
          update: vi.fn(),
        },
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
    expect(app.prisma.payment.update).not.toHaveBeenCalled()
  })
})
