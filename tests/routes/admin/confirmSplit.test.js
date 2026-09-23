import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { OrderStatus, PaymentStatus, UserRole } from '../../../src/generated/prisma/client'

const createCompany = async (app, overrides = {}) => {
  const suffix = `${Date.now()}-${Math.random()}`
  return app.prisma.company.create({
    data: {
      name: `Confirm Split Company ${suffix}`,
      wallet: `0xDistribWallet-${suffix}`,
      serviceWallet: `0xServiceWallet-${suffix}`,
      cumulativeWallet: `0xCumulativeWallet-${suffix}`,
      ...overrides,
    },
  })
}

const createUser = async (app, companyId, overrides = {}) => {
  return app.prisma.user.create({
    data: {
      email: `confirm-split-user-${Date.now()}-${Math.random()}@test.com`,
      password: 'hashed',
      role: UserRole.Candidate,
      firstName: 'Confirm',
      lastName: 'User',
      phone: `+375296${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      level: 1,
      levelConfirmed: true,
      companyId,
      ...overrides,
    },
  })
}

const createConsultantWithWallet = async (app, companyId, wallet, overrides = {}) => {
  return app.prisma.user.create({
    data: {
      email: `consultant-${Date.now()}-${Math.random()}@test.com`,
      password: 'hashed',
      role: UserRole.Consultant,
      firstName: 'Consultant',
      lastName: 'Wallet',
      phone: `+375297${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      level: 1,
      levelConfirmed: true,
      companyId,
      wallet,
      ...overrides,
    },
  })
}

const createCompletedPayment = async (app, { user, company, status = PaymentStatus.Completed }) => {
  const order = await app.prisma.order.create({
    data: {
      userId: user.id,
      quantity: 1,
      totalAmount: 1200,
      status: OrderStatus.Paid,
    },
  })

  const payment = await app.prisma.payment.create({
    data: {
      userId: user.id,
      companyId: company.id,
      orderId: order.id,
      amount: 1200,
      tokenSymbol: 'USDT',
      tokenContract: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
      tokenDecimals: 18,
      chainId: 97,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      fromWallet: '0x1111111111111111111111111111111111111111',
      toWallet: '0x2222222222222222222222222222222222222222',
      status,
    },
  })

  return { order, payment }
}

describe('POST /api/admin/payments/:id/confirm-split', () => {
  const createAdminUser = () => ({
    id: 1,
    email: 'admin@test.com',
    role: UserRole.Admin,
    company: { id: 1 },
  })

  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/1/confirm-split',
      payload: { splits: [{ wallet: '0xAddress', amount: 100 }] },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 403 when user is not Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({
      id: 1,
      email: 'candidate@test.com',
      role: UserRole.Candidate,
      company: { id: 1 },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/1/confirm-split',
      payload: { splits: [{ wallet: '0xAddress', amount: 100 }] },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when id is not a positive integer', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/abc/confirm-split',
      payload: { splits: [{ wallet: '0xAddress', amount: 100 }] },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when splits is missing from body', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/1/confirm-split',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when splits is empty array', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/1/confirm-split',
      payload: { splits: [] },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when split item is missing wallet or amount', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/1/confirm-split',
      payload: { splits: [{ amount: 100 }] },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when payment does not exist', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/999999/confirm-split',
      payload: { splits: [{ wallet: '0xAddress', amount: 100 }] },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
  })

  it('returns 403 when payment belongs to another company', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const otherCompany = await createCompany(app, {
      name: `Other Company ${Date.now()}-${Math.random()}`,
    })
    const user = await createUser(app, otherCompany.id)
    const { payment } = await createCompletedPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = otherCompany.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/confirm-split`,
      payload: { splits: [{ wallet: '0xAddress', amount: 100 }] },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 409 when payment is not Completed', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const user = await createUser(app, company.id)

    for (const status of [
      PaymentStatus.Pending,
      PaymentStatus.Failed,
      PaymentStatus.ToRefund,
      PaymentStatus.Splitted,
    ]) {
      const { payment } = await createCompletedPayment(app, { user, company, status })

      const adminUser = createAdminUser()
      adminUser.company.id = company.id
      vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

      const response = await app.inject({
        method: 'POST',
        url: `/api/admin/payments/${payment.id}/confirm-split`,
        payload: { splits: [{ wallet: '0xAddress', amount: 100 }] },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json()).toEqual({ error: 'Подтвердить сплит можно только для завершенного платежа' })
    }
  })

  it('returns 400 when company serviceWallet is not set', async () => {
    const app = await createApp()
    const company = await createCompany(app, { serviceWallet: null })
    const user = await createUser(app, company.id)
    const { payment } = await createCompletedPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/confirm-split`,
      payload: { splits: [{ wallet: '0xAddress', amount: 100 }] },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Не задан cчет на обслуживание системы' })
  })

  it('returns 400 when company cumulativeWallet is not set', async () => {
    const app = await createApp()
    const company = await createCompany(app, { cumulativeWallet: null })
    const user = await createUser(app, company.id)
    const { payment } = await createCompletedPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/confirm-split`,
      payload: { splits: [{ wallet: '0xAddress', amount: 100 }] },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Не задан накопительный счет' })
  })

  it('returns 400 when company wallet is not set', async () => {
    const app = await createApp()
    const company = await createCompany(app, { wallet: null })
    const user = await createUser(app, company.id)
    const { payment } = await createCompletedPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/confirm-split`,
      payload: { splits: [{ wallet: '0xAddress', amount: 100 }] },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Не задан распределительный счет' })
  })

  it('returns 200 and creates wages with userId, score and groupScore', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const user = await createUser(app, company.id)
    const consultant = await createConsultantWithWallet(app, company.id, '0xConsultantWallet123')
    const { payment } = await createCompletedPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    // Send split items in the new array format with userId, score, groupScore
    const splits = [
      { wallet: company.serviceWallet, amount: 12 },
      { wallet: '0xConsultantWallet123', amount: 588, userId: consultant.id, score: 1, groupScore: 0 },
      { wallet: company.cumulativeWallet, amount: 600 },
    ]

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/confirm-split`,
      payload: { splits },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ success: true, wagesCount: 3 })

    const wages = await app.prisma.wage.findMany({
      where: { paymentId: payment.id },
      orderBy: { id: 'asc' },
    })

    expect(wages).toHaveLength(3)

    // Service wallet — no user, no scores
    expect(wages[0].toWallet).toBe(company.serviceWallet)
    expect(wages[0].fromWallet).toBe(company.wallet)
    expect(wages[0].userId).toBeNull()
    expect(Number(wages[0].amount)).toBe(12)
    expect(wages[0].score).toBe(0)
    expect(wages[0].groupScore).toBe(0)
    expect(wages[0].description).toBe('Начисление по распределению платежа')

    // Consultant wallet — has user, score=1, groupScore=0
    expect(wages[1].toWallet).toBe('0xConsultantWallet123')
    expect(wages[1].fromWallet).toBe(company.wallet)
    expect(wages[1].userId).toBe(consultant.id)
    expect(Number(wages[1].amount)).toBe(588)
    expect(wages[1].score).toBe(1)
    expect(wages[1].groupScore).toBe(0)
    expect(wages[1].description).toBe('Начисление по распределению платежа')

    // Cumulative wallet — no user, no scores
    expect(wages[2].toWallet).toBe(company.cumulativeWallet)
    expect(wages[2].fromWallet).toBe(company.wallet)
    expect(wages[2].userId).toBeNull()
    expect(Number(wages[2].amount)).toBe(600)
    expect(wages[2].score).toBe(0)
    expect(wages[2].groupScore).toBe(0)
    expect(wages[2].description).toBe('Начисление по распределению платежа')

    const updated = await app.prisma.payment.findUnique({ where: { id: payment.id } })
    expect(updated.status).toBe(PaymentStatus.Splitted)

    // Verify user who received a wage was flagged for level review
    const updatedConsultant = await app.prisma.user.findUnique({ where: { id: consultant.id } })
    expect(updatedConsultant.toReviewLevel).toBe(true)
  })

  it('does not flag users when split items have no userId', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const consultant = await createConsultantWithWallet(app, company.id, '0xUnlinkedWallet')
    const user = await createUser(app, company.id)
    const { payment } = await createCompletedPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    // Split items without userId (wallets only) — no one should be flagged
    const splits = [
      { wallet: company.serviceWallet, amount: 12 },
      { wallet: '0xUnlinkedWallet', amount: 588 },
      { wallet: company.cumulativeWallet, amount: 600 },
    ]

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/confirm-split`,
      payload: { splits },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ success: true, wagesCount: 3 })

    const updatedConsultant = await app.prisma.user.findUnique({ where: { id: consultant.id } })
    expect(updatedConsultant.toReviewLevel).toBe(false)
  })
})
