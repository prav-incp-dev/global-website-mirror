import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { OrderStatus, PaymentStatus, UserRole } from '../../../src/generated/prisma/client'

const createCompany = async (app, name) => {
  return app.prisma.company.create({
    data: { name },
  })
}

const createUser = async (app, companyId, overrides = {}) => {
  return app.prisma.user.create({
    data: {
      email: `complete-user-${Date.now()}-${Math.random()}@test.com`,
      password: 'hashed',
      role: UserRole.Candidate,
      firstName: 'Pay',
      lastName: 'User',
      phone: `+375295${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      level: 1,
      levelConfirmed: true,
      companyId,
      ...overrides,
    },
  })
}

const createFailedPayment = async (app, { user, company, status = PaymentStatus.Failed }) => {
  const order = await app.prisma.order.create({
    data: {
      userId: user.id,
      quantity: 1,
      totalAmount: 1200,
      status: OrderStatus.Pending,
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

describe('POST /api/admin/payments/:id/complete', () => {
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
      url: '/api/admin/payments/1/complete',
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
      url: '/api/admin/payments/1/complete',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when id is not a positive integer', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/abc/complete',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when payment not found', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/999999/complete',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
  })

  it('returns 403 when payment belongs to another company', async () => {
    const app = await createApp()
    const companyA = await createCompany(app, 'Complete Company A')
    const companyB = await createCompany(app, 'Complete Company B')

    const user = await createUser(app, companyB.id)
    const { payment } = await createFailedPayment(app, { user, company: companyB })

    const adminUser = createAdminUser()
    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/complete`,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 409 when payment is not Failed and changes nothing', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Complete Not Failed Company')
    const user = await createUser(app, company.id)

    for (const status of [PaymentStatus.Pending, PaymentStatus.Completed, PaymentStatus.ToRefund]) {
      const { payment } = await createFailedPayment(app, { user, company, status })

      const adminUser = createAdminUser()
      adminUser.company.id = company.id
      vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

      const response = await app.inject({
        method: 'POST',
        url: `/api/admin/payments/${payment.id}/complete`,
      })

      expect(response.statusCode).toBe(409)
      expect(response.json()).toEqual({ error: 'Зачесть можно только платеж со статусом «Ошибка»' })

      const unchanged = await app.prisma.payment.findUnique({ where: { id: payment.id } })
      expect(unchanged.status).toBe(status)
    }
  })

  it('completes a failed payment and marks the order as Paid', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Complete Success Company')
    const user = await createUser(app, company.id)

    const { order, payment } = await createFailedPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/complete`,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.payment.status).toBe(PaymentStatus.Completed)
    expect(body.payment.id).toBe(payment.id)

    const updatedPayment = await app.prisma.payment.findUnique({ where: { id: payment.id } })
    expect(updatedPayment.status).toBe(PaymentStatus.Completed)

    const updatedOrder = await app.prisma.order.findUnique({ where: { id: order.id } })
    expect(updatedOrder.status).toBe(OrderStatus.Paid)
  })

  it('returns 500 on unexpected database error', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Complete Error Company')
    const user = await createUser(app, company.id)
    const { payment } = await createFailedPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.payment, 'findUnique').mockRejectedValue(new Error('db unavailable'))

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/complete`,
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка зачтения платежа' })
  })
})
