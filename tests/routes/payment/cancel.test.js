import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { OrderStatus, PaymentStatus } from '../../../src/generated/prisma/client'
import { adminUser, candidateUser, TOKEN_CONTRACT, TX_HASH } from './fixtures.js'

vi.mock('../../../src/lib/chain.js', () => ({
  getPublicClient: vi.fn(() => ({ getTransactionReceipt: vi.fn() })),
  getWalletClient: vi.fn(),
  ensureChain: vi.fn(),
  rpcUrl: 'https://mock-rpc.example.com',
  chainId: 97,
  usdtAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
  usdtDecimals: 18,
  erc20Abi: [],
}))

describe('POST /api/payments/:id/cancel', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 403 when user is Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 404 when payment not found', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue(null)
    vi.spyOn(app.prisma.payment, 'update')

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/99999/cancel',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
    expect(app.prisma.payment.update).not.toHaveBeenCalled()
  })

  it('returns 404 when payment belongs to another user', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: 999,
      status: PaymentStatus.Pending,
      txHash: null,
      order: { id: 7, quantity: 1 },
    })
    vi.spyOn(app.prisma.payment, 'update')

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
    expect(app.prisma.payment.update).not.toHaveBeenCalled()
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
    vi.spyOn(app.prisma.payment, 'update')

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Платеж уже не в ожидании' })
    expect(app.prisma.payment.update).not.toHaveBeenCalled()
  })

  it('returns 409 when txHash already set', async () => {
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
    vi.spyOn(app.prisma.payment, 'update')

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Транзакция уже привязана к платежу' })
    expect(app.prisma.payment.update).not.toHaveBeenCalled()
  })

  it('marks pending payment as Canceled and order as Canceled', async () => {
    const now = new Date('2026-07-30T10:00:00.000Z')
    const canceledPayment = {
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      amount: 1200,
      status: PaymentStatus.Canceled,
      txHash: null,
      fromWallet: null,
      toWallet: candidateUser.company.wallet,
      chainId: 97,
      tokenSymbol: 'USDT',
      tokenContract: TOKEN_CONTRACT,
      tokenDecimals: 18,
      refundRequestedAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
      order: { id: 7, quantity: 1 },
    }

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
    vi.spyOn(app.prisma.payment, 'update').mockResolvedValue({})
    vi.spyOn(app.prisma.order, 'update').mockResolvedValue({})
    vi.spyOn(app.prisma, '$transaction').mockResolvedValue([canceledPayment])

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/cancel',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().success).toBe(true)
    expect(response.json().payment.status).toBe(PaymentStatus.Canceled)
    expect(app.prisma.payment.update).toHaveBeenCalledTimes(1)
    expect(app.prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { status: PaymentStatus.Canceled },
      include: { order: true },
    })
    expect(app.prisma.order.update).toHaveBeenCalledTimes(1)
    expect(app.prisma.order.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: OrderStatus.Canceled },
    })
    expect(app.prisma.$transaction).toHaveBeenCalledTimes(1)
  })
})
