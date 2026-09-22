import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { OrderStatus, PaymentStatus } from '../../../src/generated/prisma/client'

const createCompany = async (app, overrides = {}) => {
  return app.prisma.company.create({
    data: {
      name: `Test Company ${Date.now()}`,
      wallet: '0x1111111111111111111111111111111111111111',
      serviceWallet: '0x2222222222222222222222222222222222222222',
      cumulativeWallet: '0x3333333333333333333333333333333333333333',
      ...overrides,
    },
  })
}

const createUser = async (app, overrides = {}) => {
  return app.prisma.user.create({
    data: {
      email: `user-${Date.now()}@test.com`,
      password: 'hashed',
      role: 'Consultant',
      firstName: 'Test',
      lastName: 'User',
      phone: `+375291${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      level: 1,
      levelConfirmed: true,
      ...overrides,
    },
  })
}

const createPayment = async (app, overrides = {}) => {
  const order = await app.prisma.order.create({
    data: {
      userId: overrides.userId,
      quantity: 1,
      totalAmount: 500,
      status: OrderStatus.Paid,
    },
  })

  return app.prisma.payment.create({
    data: {
      orderId: order.id,
      userId: overrides.userId,
      companyId: overrides.companyId,
      amount: 500,
      tokenSymbol: 'USDT',
      tokenContract: '0xTokenContract',
      tokenDecimals: 18,
      chainId: 56,
      txHash: `0x${String(Math.random()).slice(2, 10)}...`,
      fromWallet: '0xFromWallet',
      toWallet: '0xToWallet',
      status: PaymentStatus.Completed,
      ...overrides,
    },
  })
}

const createWage = async (app, overrides = {}) => {
  return app.prisma.wage.create({
    data: {
      amount: 100,
      score: 10,
      groupScore: 5,
      description: 'Test wage',
      ...overrides,
    },
  })
}

describe('GET /api/admin/company/wages/export', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/company/wages/export?fromDate=2025-01-01&toDate=2025-12-31&wallet=0x2222222222222222222222222222222222222222',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is not Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      role: 'Candidate',
      company: { id: 1 },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/company/wages/export?fromDate=2025-01-01&toDate=2025-12-31&wallet=0x2222222222222222222222222222222222222222',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when fromDate is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({
      id: 1,
      role: 'Admin',
      company: { id: 1 },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/company/wages/export?toDate=2025-12-31&wallet=0x2222222222222222222222222222222222222222',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when toDate is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({
      id: 1,
      role: 'Admin',
      company: { id: 1 },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/company/wages/export?fromDate=2025-01-01&wallet=0x2222222222222222222222222222222222222222',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when wallet is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({
      id: 1,
      role: 'Admin',
      company: { id: 1 },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/company/wages/export?fromDate=2025-01-01&toDate=2025-12-31',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns CSV with correct headers and data', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: company.id },
    }
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const user = await createUser(app, { companyId: company.id })
    const payment = await createPayment(app, {
      userId: user.id,
      companyId: company.id,
    })

    await createWage(app, {
      companyId: company.id,
      userId: user.id,
      paymentId: payment.id,
      fromWallet: company.serviceWallet,
      amount: 150.50,
      createdAt: new Date('2025-06-15T10:00:00Z'),
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/company/wages/export?fromDate=2025-01-01&toDate=2025-12-31&wallet=${company.serviceWallet}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="wages-${company.serviceWallet.slice(0, 8)}-2025-01-01-2025-12-31.csv"`,
    )

    const body = response.body
    expect(body.startsWith('\uFEFF')).toBe(true)

    const lines = body.replace('\uFEFF', '').split('\n')
    expect(lines[0]).toBe('Дата,Сумма,Пользователь,Кошелек отправителя,Хэш транзакции')
    expect(lines[1]).toBe(`2025-06-15,150.50,Test User,${company.serviceWallet},${payment.txHash}`)
    expect(lines[2]).toBe('')
  })

  it('returns CSV with only header row when no wages match the wallet', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: company.id },
    }
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const user = await createUser(app, { companyId: company.id })
    const payment = await createPayment(app, {
      userId: user.id,
      companyId: company.id,
    })
    await createWage(app, {
      companyId: company.id,
      userId: user.id,
      paymentId: payment.id,
      fromWallet: '0xffffffffffffffffffffffffffffffffffffffff',
    })

    const otherWallet = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/company/wages/export?fromDate=2025-01-01&toDate=2025-12-31&wallet=${otherWallet}`,
    })

    expect(response.statusCode).toBe(200)

    const body = response.body
    expect(body.startsWith('\uFEFF')).toBe(true)

    const lines = body.replace('\uFEFF', '').split('\n')
    expect(lines[0]).toBe('Дата,Сумма,Пользователь,Кошелек отправителя,Хэш транзакции')
    expect(lines[1]).toBe('')
  })

  it('filters wages by date range', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: company.id },
    }
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const user = await createUser(app, { companyId: company.id })
    const payment = await createPayment(app, {
      userId: user.id,
      companyId: company.id,
    })

    await createWage(app, {
      companyId: company.id,
      userId: user.id,
      paymentId: payment.id,
      fromWallet: company.serviceWallet,
      amount: 100,
      createdAt: new Date('2025-06-15T10:00:00Z'),
    })

    await createWage(app, {
      companyId: company.id,
      userId: user.id,
      paymentId: payment.id,
      fromWallet: company.serviceWallet,
      amount: 200,
      createdAt: new Date('2024-11-15T10:00:00Z'),
    })

    await createWage(app, {
      companyId: company.id,
      userId: user.id,
      paymentId: payment.id,
      fromWallet: company.serviceWallet,
      amount: 300,
      createdAt: new Date('2026-01-15T10:00:00Z'),
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/company/wages/export?fromDate=2025-01-01&toDate=2025-12-31&wallet=${company.serviceWallet}`,
    })

    expect(response.statusCode).toBe(200)

    const lines = response.body.replace('\uFEFF', '').split('\n')
    expect(lines[0]).toBe('Дата,Сумма,Пользователь,Кошелек отправителя,Хэш транзакции')
    expect(lines[1]).toBe(`2025-06-15,100.00,Test User,${company.serviceWallet},${payment.txHash}`)
    expect(lines[2]).toBe('')
  })

  it('handles wage without associated user gracefully', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: company.id },
    }
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const wageUser = await createUser(app, { companyId: company.id })
    const payment = await createPayment(app, {
      userId: wageUser.id,
      companyId: company.id,
    })

    // Create a wage with null userId (no associated user) but valid paymentId
    await createWage(app, {
      companyId: company.id,
      userId: null,
      paymentId: payment.id,
      fromWallet: company.serviceWallet,
      amount: 75,
      createdAt: new Date('2025-06-15T10:00:00Z'),
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/company/wages/export?fromDate=2025-01-01&toDate=2025-12-31&wallet=${company.serviceWallet}`,
    })

    expect(response.statusCode).toBe(200)

    const lines = response.body.replace('\uFEFF', '').split('\n')
    expect(lines[0]).toBe('Дата,Сумма,Пользователь,Кошелек отправителя,Хэш транзакции')
    expect(lines[1]).toBe(`2025-06-15,75.00,—,${company.serviceWallet},${payment.txHash}`)
    expect(lines[2]).toBe('')
  })

  it('handles wage without associated payment gracefully', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: company.id },
    }
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const user = await createUser(app, { companyId: company.id })

    await createWage(app, {
      companyId: company.id,
      userId: user.id,
      paymentId: null,
      fromWallet: company.serviceWallet,
      amount: 50,
      createdAt: new Date('2025-06-15T10:00:00Z'),
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/company/wages/export?fromDate=2025-01-01&toDate=2025-12-31&wallet=${company.serviceWallet}`,
    })

    expect(response.statusCode).toBe(200)

    const lines = response.body.replace('\uFEFF', '').split('\n')
    expect(lines[0]).toBe('Дата,Сумма,Пользователь,Кошелек отправителя,Хэш транзакции')
    expect(lines[1]).toBe(`2025-06-15,50.00,Test User,${company.serviceWallet},—`)
    expect(lines[2]).toBe('')
  })
})