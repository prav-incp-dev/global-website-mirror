import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { OrderStatus, PaymentStatus, UserRole } from '../../../src/generated/prisma/client'

const createCompany = async (app, overrides = {}) => {
  const suffix = `${Date.now()}-${Math.random()}`
  return app.prisma.company.create({
    data: {
      name: `Split Company ${suffix}`,
      serviceWallet: `0xServiceWallet-${suffix}`,
      cumulativeWallet: `0xCumulativeWallet-${suffix}`,
      ...overrides,
    },
  })
}

const createUser = async (app, companyId, overrides = {}) => {
  return app.prisma.user.create({
    data: {
      email: `split-user-${Date.now()}-${Math.random()}@test.com`,
      password: 'hashed',
      role: UserRole.Candidate,
      firstName: 'Split',
      lastName: 'User',
      phone: `+375296${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      level: 1,
      levelConfirmed: true,
      companyId,
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

describe('GET /api/admin/payments/:id/calculate-split', () => {
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
      method: 'GET',
      url: '/api/admin/payments/1/calculate-split',
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
      method: 'GET',
      url: '/api/admin/payments/1/calculate-split',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when id is not a positive integer', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/payments/abc/calculate-split',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when payment not found', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/payments/999999/calculate-split',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
  })

  it('returns 403 when payment belongs to another company', async () => {
    const app = await createApp()
    const companyA = await createCompany(app)
    const companyB = await createCompany(app)

    const user = await createUser(app, companyB.id)
    const { payment } = await createCompletedPayment(app, { user, company: companyB })

    const adminUser = createAdminUser()
    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/payments/${payment.id}/calculate-split`,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 409 when payment is not Completed', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const user = await createUser(app, company.id)

    for (const status of [PaymentStatus.Pending, PaymentStatus.Failed, PaymentStatus.ToRefund]) {
      const { payment } = await createCompletedPayment(app, { user, company, status })

      const adminUser = createAdminUser()
      adminUser.company.id = company.id
      vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/payments/${payment.id}/calculate-split`,
      })

      expect(response.statusCode).toBe(409)
      expect(response.json()).toEqual({ error: 'Рассчитать сплит можно только для завершенного платежа' })
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
      method: 'GET',
      url: `/api/admin/payments/${payment.id}/calculate-split`,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Не указан сервисный кошелек компании' })
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
      method: 'GET',
      url: `/api/admin/payments/${payment.id}/calculate-split`,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Не указан накопительный кошелек компании' })
  })

  it('returns 200 and calls calculateSplit with the payment', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const user = await createUser(app, company.id)
    const { payment } = await createCompletedPayment(app, { user, company })

    const mockResult = { '0xServiceWallet': 12, '0xCumulativeWallet': 1188 }
    const calculateSplitSpy = vi.spyOn(app.admin, 'calculateSplit').mockResolvedValue(mockResult)

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/payments/${payment.id}/calculate-split`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true, split: mockResult })

    expect(calculateSplitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: payment.id, companyId: company.id, status: PaymentStatus.Completed }),
    )
  })
})
