import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../helpers'
import { PaymentStatus, OrderStatus } from '@/generated/prisma/enums'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('getPayments', () => {
  const createTestCompany = async (app) => {
    return app.prisma.company.create({
      data: { name: `Test Company ${Date.now()}` },
    })
  }

  const createTestUser = async (app, companyId, overrides = {}) => {
    return app.prisma.user.create({
      data: {
        email: `user-${Date.now()}-${Math.random()}@test.com`,
        password: 'hash',
        role: 'Candidate',
        firstName: 'Test',
        lastName: 'User',
        phone: `+7${Date.now()}${Math.floor(Math.random() * 100)}`,
        companyId,
        ...overrides,
      },
    })
  }

  const createTestOrder = async (app, userId, overrides = {}) => {
    return app.prisma.order.create({
      data: {
        userId,
        quantity: 1,
        totalAmount: 100,
        status: OrderStatus.Paid,
        ...overrides,
      },
    })
  }

  const createTestPayment = async (app, userId, companyId, overrides = {}) => {
    const order = await createTestOrder(app, userId)
    return app.prisma.payment.create({
      data: {
        userId,
        companyId,
        orderId: order.id,
        amount: 100,
        txHash: `txhash-${Date.now()}-${Math.random()}`,
        uid: `uid-${Date.now()}-${Math.random()}`,
        status: PaymentStatus.Completed,
        tokenContract: 'test-contract',
        chainId: 1,
        tokenDecimals: 18,
        toWallet: 'test-wallet',
        ...overrides,
      },
    })
  }

  it('returns all payments for a given company', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    await createTestPayment(app, user.id, company.id, { amount: 150, status: PaymentStatus.Completed })
    await createTestPayment(app, user.id, company.id, { amount: 200, status: PaymentStatus.Completed })

    const result = await app.admin.getPayments(adminUser, 1, 20, '')

    expect(result.payments.length).toBeGreaterThanOrEqual(2)
    expect(result.total).toBeGreaterThanOrEqual(2)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('returns paginated results', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    for (let i = 0; i < 5; i++) {
      await createTestPayment(app, user.id, company.id, { amount: 100 + i })
    }

    const page1 = await app.admin.getPayments(adminUser, 1, 2)

    expect(page1.payments).toHaveLength(2)
    expect(page1.total).toBe(5)
    expect(page1.page).toBe(1)
    expect(page1.limit).toBe(2)
    expect(page1.totalPages).toBe(3)

    const page2 = await app.admin.getPayments(adminUser, 2, 2)

    expect(page2.payments).toHaveLength(2)
    expect(page2.page).toBe(2)

    const page3 = await app.admin.getPayments(adminUser, 3, 2)

    expect(page3.payments).toHaveLength(1)
    expect(page3.page).toBe(3)
  })

  it('filters payments by query (txHash, uid, user firstName, user lastName)', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user1 = await createTestUser(app, company.id, { firstName: 'John', lastName: 'Doe' })
    const user2 = await createTestUser(app, company.id, { firstName: 'Jane', lastName: 'Smith' })

    await createTestPayment(app, user1.id, company.id, { txHash: 'abc123def', uid: 'payment1', amount: 100 })
    await createTestPayment(app, user2.id, company.id, { txHash: 'ghi456jkl', uid: 'payment2', amount: 200 })
    await createTestPayment(app, user1.id, company.id, {
      txHash: 'mno789pqr',
      uid: 'payment3',
      amount: 300,
      status: PaymentStatus.ToRefund,
    })

    const resultTxHash = await app.admin.getPayments(adminUser, 1, 20, 'abc123def')
    expect(resultTxHash.payments).toHaveLength(1)
    expect(resultTxHash.payments[0].txHash).toBe('abc123def')

    const resultUid = await app.admin.getPayments(adminUser, 1, 20, 'payment2')
    expect(resultUid.payments).toHaveLength(1)
    expect(resultUid.payments[0].uid).toBe('payment2')

    const resultFirstName = await app.admin.getPayments(adminUser, 1, 20, 'John')
    expect(resultFirstName.payments).toHaveLength(2)
    expect(resultFirstName.payments[0].userName).toBe('John Doe')

    const resultLastName = await app.admin.getPayments(adminUser, 1, 20, 'Smith')
    expect(resultLastName.payments).toHaveLength(1)
    expect(resultLastName.payments[0].userName).toBe('Jane Smith')
  })

  it('filters payments by toRefundOnly status', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    await createTestPayment(app, user.id, company.id, { amount: 100, status: PaymentStatus.Completed })
    await createTestPayment(app, user.id, company.id, { amount: 200, status: PaymentStatus.ToRefund })
    await createTestPayment(app, user.id, company.id, { amount: 300, status: PaymentStatus.Completed })

    const result = await app.admin.getPayments(adminUser, 1, 20, '', true)

    expect(result.payments).toHaveLength(1)
    expect(result.payments[0].status).toBe(PaymentStatus.ToRefund)
  })

  it('excludes canceled payments from results', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    await createTestPayment(app, user.id, company.id, { amount: 100, status: PaymentStatus.Completed })
    await createTestPayment(app, user.id, company.id, { amount: 200, status: PaymentStatus.Canceled })

    const result = await app.admin.getPayments(adminUser, 1, 20, '')

    expect(result.payments).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.payments[0].status).toBe(PaymentStatus.Completed)
  })
  it('sorts payments by amount ascending by default', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    await createTestPayment(app, user.id, company.id, { amount: 100 })
    await createTestPayment(app, user.id, company.id, { amount: 300 })
    await createTestPayment(app, user.id, company.id, { amount: 200 })

    const result = await app.admin.getPayments(adminUser, 1, 20, '', false, 'amount')

    expect(result.payments).toHaveLength(3)
    expect(result.payments[0].amount).toBe(100)
    expect(result.payments[1].amount).toBe(200)
    expect(result.payments[2].amount).toBe(300)
  })

  it('sorts payments by status ascending', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    await createTestPayment(app, user.id, company.id, { status: PaymentStatus.ToRefund })
    await createTestPayment(app, user.id, company.id, { status: PaymentStatus.Completed })

    const result = await app.admin.getPayments(adminUser, 1, 20, '', false, 'status')

    expect(result.payments).toHaveLength(2)
    expect(result.payments[0].status).toBe(PaymentStatus.Completed)
    expect(result.payments[1].status).toBe(PaymentStatus.ToRefund)
  })

  it('sorts payments by id descending by default', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    const payment1 = await createTestPayment(app, user.id, company.id, { amount: 100 })
    const payment2 = await createTestPayment(app, user.id, company.id, { amount: 200 })
    const payment3 = await createTestPayment(app, user.id, company.id, { amount: 300 })

    const result = await app.admin.getPayments(adminUser, 1, 20, '', false, 'id')

    expect(result.payments).toHaveLength(3)
    expect(result.payments[0].id).toBe(payment3.id)
    expect(result.payments[1].id).toBe(payment2.id)
    expect(result.payments[2].id).toBe(payment1.id)
  })

  it('maps user name correctly', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const userWithFirstNameLastName = await createTestUser(app, company.id, {
      firstName: 'Alice',
      lastName: 'Wonderland',
    })
    const userWithOnlyFirstName = await createTestUser(app, company.id, { firstName: 'Charlie', lastName: '' })

    await createTestPayment(app, userWithFirstNameLastName.id, company.id, { amount: 100 })
    await createTestPayment(app, userWithOnlyFirstName.id, company.id, { amount: 200 })

    const result = await app.admin.getPayments(adminUser, 1, 20, '')

    const paymentAlice = result.payments.find((p) => p.amount === 100)
    expect(paymentAlice.userName).toBe('Alice Wonderland')

    const paymentCharlie = result.payments.find((p) => p.amount === 200)
    expect(paymentCharlie.userName).toBe('Charlie')
  })

  it('maps fromWallet correctly', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    const fromWallet = '0x1234567890abcdef1234567890abcdef12345678'

    await createTestPayment(app, user.id, company.id, { amount: 100, fromWallet })

    const result = await app.admin.getPayments(adminUser, 1, 20, '')

    expect(result.payments[0].fromWallet).toBe(fromWallet)
  })
})
