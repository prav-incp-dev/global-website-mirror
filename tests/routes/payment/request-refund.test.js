import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { PaymentStatus } from '../../../src/generated/prisma/client'
import { adminUser, candidateUser, FROM_WALLET, TOKEN_CONTRACT, TX_HASH } from './fixtures.js'

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

describe('POST /api/payments/:id/request-refund', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/request-refund',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 409 when payment is finalized', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      status: PaymentStatus.Completed,
      uid: 'ON-1234-01',
      finalized: true,
      createdAt: new Date(),
      order: { id: 7, quantity: 1 },
    })
    vi.spyOn(app.prisma.payment, 'update')

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/request-refund',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Платеж уже обработан и не может быть отменен' })
    expect(app.prisma.payment.update).not.toHaveBeenCalled()
  })

  it('marks payment as ToRefund', async () => {
    const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const updatedAt = new Date('2026-07-30T12:00:00.000Z')

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      uid: null,
      finalized: false,
      amount: 1200,
      status: PaymentStatus.Completed,
      txHash: TX_HASH,
      fromWallet: FROM_WALLET,
      toWallet: candidateUser.company.wallet,
      chainId: 97,
      tokenSymbol: 'USDT',
      tokenContract: TOKEN_CONTRACT,
      tokenDecimals: 18,
      refundRequestedAt: null,
      refundedAt: null,
      createdAt,
      updatedAt: createdAt,
      order: { id: 7, quantity: 1 },
    })
    vi.spyOn(app.prisma.payment, 'update').mockResolvedValue({
      id: 11,
      orderId: 7,
      userId: candidateUser.id,
      amount: 1200,
      status: PaymentStatus.ToRefund,
      txHash: TX_HASH,
      fromWallet: FROM_WALLET,
      toWallet: candidateUser.company.wallet,
      chainId: 97,
      tokenSymbol: 'USDT',
      tokenContract: TOKEN_CONTRACT,
      tokenDecimals: 18,
      refundRequestedAt: updatedAt,
      refundedAt: null,
      createdAt,
      updatedAt,
      order: { id: 7, quantity: 1 },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/request-refund',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().success).toBe(true)
    expect(response.json().payment.status).toBe(PaymentStatus.ToRefund)
    expect(app.prisma.payment.update).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/request-refund',
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
      url: '/api/payments/99999/request-refund',
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
      status: PaymentStatus.Completed,
      createdAt: new Date(),
      order: { id: 7, quantity: 1 },
    })
    vi.spyOn(app.prisma.payment, 'update')

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/11/request-refund',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
    expect(app.prisma.payment.update).not.toHaveBeenCalled()
  })
})
