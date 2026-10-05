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

  const SPLIT_TX_HASH = '0xsplitTransactionHash1234567890abcdef'

  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/1/confirm-split',
      payload: { split: { wages: [{ wallet: '0xAddress', amount: 100 }], promotions: [] }, txHash: '0xTest' },
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
      payload: { split: { wages: [{ wallet: '0xAddress', amount: 100 }], promotions: [] }, txHash: '0xTest' },
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
      payload: { split: { wages: [{ wallet: '0xAddress', amount: 100 }], promotions: [] }, txHash: '0xTest' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when wages is missing from body', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/1/confirm-split',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when wages is empty array', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/1/confirm-split',
      payload: { split: { wages: [], promotions: [] }, txHash: '0xTest' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when split item is missing wallet or amount', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/1/confirm-split',
      payload: { split: { wages: [{ amount: 100 }], promotions: [] }, txHash: '0xTest' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when payment does not exist', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/999999/confirm-split',
      payload: { split: { wages: [{ wallet: '0xAddress', amount: 100 }], promotions: [] }, txHash: '0xTest' },
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
      payload: { split: { wages: [{ wallet: '0xAddress', amount: 100 }], promotions: [] }, txHash: '0xTest' },
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
        payload: { split: { wages: [{ wallet: '0xAddress', amount: 100 }], promotions: [] }, txHash: '0xTest' },
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
      payload: { split: { wages: [{ wallet: '0xAddress', amount: 100 }], promotions: [] }, txHash: '0xTest' },
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
      payload: { split: { wages: [{ wallet: '0xAddress', amount: 100 }], promotions: [] }, txHash: '0xTest' },
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
      payload: { split: { wages: [{ wallet: '0xAddress', amount: 100 }], promotions: [] }, txHash: '0xTest' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Не задан распределительный счет' })
  })

  it('should successfully confirm split, create wages with onLevel, level history records, and update user levels', async () => {
    const app = await createApp()
    const company = await createCompany(app)
    const user = await createUser(app, company.id)
    const consultant1 = await createConsultantWithWallet(app, company.id, '0xConsultantWallet1', { level: 1 })
    const consultant2 = await createConsultantWithWallet(app, company.id, '0xConsultantWallet2', { level: 3 })
    const { payment } = await createCompletedPayment(app, { user, company })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const wages = [
      { wallet: company.serviceWallet, amount: 10, onLevel: 0 },
      { wallet: consultant1.wallet, amount: 100, userId: consultant1.id, score: 5, groupScore: 2, onLevel: 1 },
      { wallet: consultant2.wallet, amount: 200, userId: consultant2.id, score: 10, groupScore: 5, onLevel: 3 },
    ]

    const promotions = [
      { userId: consultant1.id, oldLevel: 1, newLevel: 2 },
      { userId: consultant2.id, oldLevel: 3, newLevel: 4 },
      { userId: consultant1.id, oldLevel: 2, newLevel: 3 }, // Second promotion for consultant1
    ]

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/confirm-split`,
      payload: { split: { wages, promotions }, txHash: SPLIT_TX_HASH },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ success: true })

    // Verify Wages
    const createdWages = await app.prisma.wage.findMany({
      where: { paymentId: payment.id },
      orderBy: { id: 'asc' },
    })

    expect(createdWages).toHaveLength(wages.length)
    expect(createdWages[0].txHash).toBe(SPLIT_TX_HASH)
    expect(createdWages[1].txHash).toBe(SPLIT_TX_HASH)
    expect(createdWages[2].txHash).toBe(SPLIT_TX_HASH)

    expect(createdWages[0].toWallet).toBe(company.serviceWallet)
    expect(createdWages[0].userId).toBeNull()
    expect(Number(createdWages[0].amount)).toBe(10)
    expect(createdWages[0].onLevel).toBe(0) // Assert onLevel

    expect(createdWages[1].toWallet).toBe(consultant1.wallet)
    expect(createdWages[1].userId).toBe(consultant1.id)
    expect(Number(createdWages[1].amount)).toBe(100)
    expect(createdWages[1].score).toBe(5)
    expect(createdWages[1].groupScore).toBe(2)
    expect(createdWages[1].onLevel).toBe(1) // Assert onLevel

    expect(createdWages[2].toWallet).toBe(consultant2.wallet)
    expect(createdWages[2].userId).toBe(consultant2.id)
    expect(Number(createdWages[2].amount)).toBe(200)
    expect(createdWages[2].score).toBe(10)
    expect(createdWages[2].groupScore).toBe(5)
    expect(createdWages[2].onLevel).toBe(3) // Assert onLevel

    // Verify Payment Status Update
    const updatedPayment = await app.prisma.payment.findUnique({ where: { id: payment.id } })
    expect(updatedPayment.status).toBe(PaymentStatus.Splitted)

    // Verify User Locking
    const updatedConsultant1 = await app.prisma.user.findUnique({ where: { id: consultant1.id } })
    expect(updatedConsultant1.isLocked).toBe(true)
    const updatedConsultant2 = await app.prisma.user.findUnique({ where: { id: consultant2.id } })
    expect(updatedConsultant2.isLocked).toBe(true)

    // Verify Level History Records
    const levelHistories = await app.prisma.levelHistory.findMany({
      where: {
        userId: { in: [consultant1.id, consultant2.id] },
      },
      orderBy: { createdAt: 'asc' },
    })
    expect(levelHistories).toHaveLength(promotions.length)

    expect(levelHistories[0].userId).toBe(consultant1.id)
    expect(levelHistories[0].oldLevel).toBe(1)
    expect(levelHistories[0].newLevel).toBe(2)

    expect(levelHistories[1].userId).toBe(consultant2.id)
    expect(levelHistories[1].oldLevel).toBe(3)
    expect(levelHistories[1].newLevel).toBe(4)

    expect(levelHistories[2].userId).toBe(consultant1.id)
    expect(levelHistories[2].oldLevel).toBe(2)
    expect(levelHistories[2].newLevel).toBe(3)

    // Verify User Level Updates (considering max newLevel)
    const finalConsultant1 = await app.prisma.user.findUnique({ where: { id: consultant1.id } })
    expect(finalConsultant1.level).toBe(3) // Max of 2 and 3 for consultant1
    const finalConsultant2 = await app.prisma.user.findUnique({ where: { id: consultant2.id } })
    expect(finalConsultant2.level).toBe(4) // Max of 4 for consultant2
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
    const wages = [
      { wallet: company.serviceWallet, amount: 12, onLevel: 0 },
      { wallet: '0xUnlinkedWallet', amount: 588, onLevel: 0 },
      { wallet: company.cumulativeWallet, amount: 600, onLevel: 0 },
    ]

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/payments/${payment.id}/confirm-split`,
      payload: { split: { wages, promotions: [] }, txHash: '0xTest' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ success: true })

    const updatedConsultant = await app.prisma.user.findUnique({ where: { id: consultant.id } })
    expect(updatedConsultant.isLocked).toBe(false)
  })
})
