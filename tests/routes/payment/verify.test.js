import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { PaymentStatus } from '../../../src/generated/prisma/client'
import { adminUser, candidateUser, FROM_WALLET, RECIPIENT_WALLET, TOKEN_CONTRACT, TX_HASH } from './fixtures.js'

const getTransactionReceipt = vi.fn()
const mockGetTransactionReceipt = async () => getTransactionReceipt

vi.mock('viem', () => {
  return {
    getAddress: vi.fn((addr) => addr?.toLowerCase()),
    parseEventLogs: vi.fn(),
    parseUnits: vi.fn(),
  }
})

vi.mock('../../../src/lib/chain.js', () => ({
  getPublicClient: vi.fn(() => ({ getTransactionReceipt })),
  getWalletClient: vi.fn(),
  ensureChain: vi.fn(),
  rpcUrl: 'https://mock-rpc.example.com',
  chainId: 97,
  usdtAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
  usdtDecimals: 18,
  erc20Abi: [],
}))

describe('POST /api/payments/:id/verify', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 403 when user is Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 404 when payment not found', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/99999/verify',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
  })

  it('returns 409 when payment is not Pending', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      status: PaymentStatus.Completed,
      txHash: TX_HASH,
      order: { id: 7, quantity: 1 },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Платеж уже не в ожидании' })
  })

  it('returns 409 when no txHash attached', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      status: PaymentStatus.Pending,
      txHash: null,
      order: { id: 7, quantity: 1 },
    })

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
    txHash: TX_HASH,
    fromWallet: FROM_WALLET,
    toWallet: RECIPIENT_WALLET,
    tokenContract: TOKEN_CONTRACT,
    tokenDecimals: 18,
    order: { id: 7, quantity: 1 },
  }

  it('returns 409 when receipt is null', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockResolvedValueOnce(null)

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue(pendingPayment)
    vi.spyOn(app.prisma.payment, 'update').mockResolvedValue({})

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
      to: TOKEN_CONTRACT,
      from: FROM_WALLET,
      logs: [],
      ...overrides,
    }
  }

  const setupVerifyMocks = async (overrides = {}) => {
    getTransactionReceipt.mockResolvedValueOnce(buildReceipt(overrides))
    const viMod = await import('viem')
    viMod.parseEventLogs.mockReturnValueOnce([
      {
        eventName: 'Transfer',
        args: {
          from: FROM_WALLET,
          to: RECIPIENT_WALLET,
          value: 1200000000000000000000n,
        },
      },
    ])
    viMod.parseUnits.mockReturnValueOnce(1200000000000000000000n)
  }

  it('uses fallback RPC URL when env var is unset', async () => {
    vi.stubEnv('VITE_BSC_RPC_URL', '')
    await setupVerifyMocks()

    const now = new Date('2026-07-30T10:00:00.000Z')
    const completedPayment = {
      ...pendingPayment,
      status: PaymentStatus.Completed,
      chainId: 97,
      tokenSymbol: 'USDT',
      refundRequestedAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue(pendingPayment)
    vi.spyOn(app.prisma.payment, 'update').mockResolvedValue({})
    vi.spyOn(app.prisma, '$transaction').mockResolvedValue([completedPayment])

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe(PaymentStatus.Completed)
  })

  it('completes payment on success receipt', async () => {
    await setupVerifyMocks()

    const now = new Date('2026-07-30T10:00:00.000Z')
    const completedPayment = {
      ...pendingPayment,
      status: PaymentStatus.Completed,
      chainId: 97,
      tokenSymbol: 'USDT',
      refundRequestedAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue(pendingPayment)
    vi.spyOn(app.prisma.payment, 'update').mockResolvedValue({})
    vi.spyOn(app.prisma, '$transaction').mockResolvedValue([completedPayment])

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.status).toBe(PaymentStatus.Completed)
  })

  it('returns 409 when token contract does not match', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockResolvedValueOnce(buildReceipt({ to: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }))

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      status: PaymentStatus.Pending,
      txHash: TX_HASH,
      order: { id: 7, quantity: 1 },
    })
    vi.spyOn(app.prisma.payment, 'update').mockResolvedValue({})

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция не была подтверждена сетью' })
  })

  it('returns 409 when sender does not match', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockResolvedValueOnce(buildReceipt({ from: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }))

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      status: PaymentStatus.Pending,
      txHash: TX_HASH,
      order: { id: 7, quantity: 1 },
    })
    vi.spyOn(app.prisma.payment, 'update').mockResolvedValue({})

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция не была подтверждена сетью' })
  })

  it('returns 409 when transfer details do not match', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockResolvedValueOnce(buildReceipt())

    const viMod = await import('viem')
    viMod.parseEventLogs.mockReturnValueOnce([])
    viMod.parseUnits.mockReturnValueOnce(1200000000000000000000n)

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      status: PaymentStatus.Pending,
      txHash: TX_HASH,
      order: { id: 7, quantity: 1 },
    })
    vi.spyOn(app.prisma.payment, 'update').mockResolvedValue({})

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция не была подтверждена сетью' })
  })

  it('returns 409 on failed receipt', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockRejectedValueOnce(new Error('Transaction not confirmed on chain'))

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      status: PaymentStatus.Pending,
      txHash: TX_HASH,
      order: { id: 7, quantity: 1 },
    })
    vi.spyOn(app.prisma.payment, 'update').mockResolvedValue({})

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция не была подтверждена сетью' })
  })

  it('returns 500 on unexpected error', async () => {
    const getTransactionReceipt = await mockGetTransactionReceipt()
    getTransactionReceipt.mockRejectedValueOnce(new Error('RPC timeout'))

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      status: PaymentStatus.Pending,
      txHash: TX_HASH,
      order: { id: 7, quantity: 1 },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/verify',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка верификации платежа' })
  })
})
