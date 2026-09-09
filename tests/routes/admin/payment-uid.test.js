import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { OrderStatus, UserRole } from '../../../src/generated/prisma/client'

const createCompany = async (app, name) => {
  return app.prisma.company.create({
    data: { name },
  })
}

const createUser = async (app, companyId, overrides = {}) => {
  return app.prisma.user.create({
    data: {
      email: `uid-user-${Date.now()}-${Math.random()}@test.com`,
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

const createPayment = async (app, { user, company, overrides = {} }) => {
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
      ...overrides,
    },
  })

  return { order, payment }
}

describe('PATCH /api/admin/payments/:id', () => {
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
      method: 'PATCH',
      url: '/api/admin/payments/1',
      payload: { uid: 'ON-1234-01' },
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
      method: 'PATCH',
      url: '/api/admin/payments/1',
      payload: { uid: 'ON-1234-01' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when id is not a positive integer', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/admin/payments/abc',
      payload: { uid: 'ON-1234-01' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when uid is missing from body', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/admin/payments/1',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when uid is empty', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    for (const uid of ['', '   ']) {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/payments/1',
        payload: { uid },
      })

      expect(response.statusCode).toBe(400)
    }
  })

  it('returns 400 when uid does not match ON-XXXX-XX format', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    for (const uid of ['1234-01', 'on-1234-01', 'ON-12345-01', 'ON-1234-A1', 'ON-1234-1', 'ON-1234-']) {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/payments/1',
        payload: { uid },
      })

      expect(response.statusCode).toBe(400)
    }
  })

  it('returns 404 when payment not found', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/admin/payments/999999',
      payload: { uid: 'ON-1234-01' },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Платеж не найден' })
  })

  it('returns 403 when payment belongs to another company', async () => {
    const app = await createApp()
    const companyA = await createCompany(app, 'Uid Company A')
    const companyB = await createCompany(app, 'Uid Company B')

    const user = await createUser(app, companyB.id)
    const { payment } = await createPayment(app, { user, company: companyB })

    const adminUser = createAdminUser()
    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/payments/${payment.id}`,
      payload: { uid: 'ON-1234-01' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 409 when uid is already used by another payment', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Uid Duplicate Company')
    const user = await createUser(app, company.id)

    await createPayment(app, { user, company, overrides: { uid: 'ON-1111-01' } })
    const { payment: target } = await createPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/payments/${target.id}`,
      payload: { uid: 'ON-1111-01' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Такой номер платежа уже есть в системе' })
  })

  it('updates the uid and returns the serialized payment', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Uid Success Company')
    const user = await createUser(app, company.id)
    const { payment } = await createPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/payments/${payment.id}`,
      payload: { uid: 'ON-1234-99' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.payment.id).toBe(payment.id)
    expect(body.payment.uid).toBe('ON-1234-99')

    const updated = await app.prisma.payment.findUnique({ where: { id: payment.id } })
    expect(updated.uid).toBe('ON-1234-99')
  })

  it('returns 500 on unexpected database error', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Uid Error Company')
    const user = await createUser(app, company.id)
    const { payment } = await createPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.payment, 'update').mockRejectedValue(new Error('db unavailable'))

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/payments/${payment.id}`,
      payload: { uid: 'ON-1234-01' },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления номера платежа' })
  })
})
