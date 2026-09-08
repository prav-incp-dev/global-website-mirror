import { beforeAll, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'
import { createApp } from '../../helpers'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('getToRefundCount', () => {
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
        parentId: null,
        ...overrides,
      },
    })
  }

  const createTestPayment = async (app, user, overrides = {}) => {
    const order = await app.prisma.order.create({
      data: {
        userId: user.id,
        quantity: 1,
        totalAmount: 1200,
      },
    })

    const payment = await app.prisma.payment.create({
      data: {
        orderId: order.id,
        userId: user.id,
        companyId: user.companyId,
        amount: 1200,
        tokenSymbol: 'USDT',
        tokenContract: '0x3333333333333333333333333333333333333333',
        tokenDecimals: 18,
        chainId: 97,
        toWallet: `0x${'22'.repeat(20)}`,
        // txHash is @unique — generate a unique one unless the caller overrides it
        txHash: `0x${crypto.randomBytes(32).toString('hex')}`,
        ...overrides,
      },
    })

    return payment
  }

  it('returns the count of ToRefund payments', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    await createTestPayment(app, user, { status: 'ToRefund' })
    await createTestPayment(app, user, { status: 'ToRefund' })
    await createTestPayment(app, user, { status: 'Completed' })
    await createTestPayment(app, user, { status: 'Pending' })

    const count = await app.admin.getToRefundCount(adminUser)

    expect(count).toBe(2)
  })

  it('returns 0 when there are no ToRefund payments', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    await createTestPayment(app, user, { status: 'Completed' })
    await createTestPayment(app, user, { status: 'Pending' })

    const count = await app.admin.getToRefundCount(adminUser)

    expect(count).toBe(0)
  })

  it('does not count payments from other companies', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const otherCompany = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    const user = await createTestUser(app, company.id)
    const otherUser = await createTestUser(app, otherCompany.id)

    await createTestPayment(app, user, { status: 'ToRefund' })
    await createTestPayment(app, otherUser, { status: 'ToRefund' })

    const count = await app.admin.getToRefundCount(adminUser)

    expect(count).toBe(1)
  })

  // GET_TO_REFUND_ANCHOR_2
  it('filters by user firstName (case-insensitive)', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    const john = await createTestUser(app, company.id, {
      email: 'john-count@test.com',
      firstName: 'John',
      lastName: 'Doe',
    })
    const johnny = await createTestUser(app, company.id, {
      email: 'johnny-count@test.com',
      firstName: 'Johnny',
      lastName: 'Smith',
    })
    const jane = await createTestUser(app, company.id, {
      email: 'jane-count@test.com',
      firstName: 'Jane',
      lastName: 'Doe',
    })

    await createTestPayment(app, john, { status: 'ToRefund' })
    await createTestPayment(app, johnny, { status: 'ToRefund' })
    await createTestPayment(app, jane, { status: 'ToRefund' })

    const count = await app.admin.getToRefundCount(adminUser, 'John')

    expect(count).toBe(2)
  })

  it('filters by user lastName (case-insensitive) only among ToRefund payments', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    const alice = await createTestUser(app, company.id, {
      email: 'alice-count@test.com',
      firstName: 'Alice',
      lastName: 'Smith',
    })
    const bob = await createTestUser(app, company.id, {
      email: 'bob-count@test.com',
      firstName: 'Bob',
      lastName: 'Smith',
    })

    // Alice: ToRefund (should match), Bob: Completed (should be excluded)
    await createTestPayment(app, alice, { status: 'ToRefund' })
    await createTestPayment(app, bob, { status: 'Completed' })

    const count = await app.admin.getToRefundCount(adminUser, 'SMITH')

    expect(count).toBe(1)
  })

  it('filters by txHash (case-insensitive)', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    await createTestPayment(app, user, {
      status: 'ToRefund',
      txHash: `0x${'ab'.repeat(32)}`,
    })
    await createTestPayment(app, user, {
      status: 'ToRefund',
      txHash: `0x${'cd'.repeat(32)}`,
    })

    const count = await app.admin.getToRefundCount(adminUser, '0xABAB')

    expect(count).toBe(1)
  })

  it('filters by uid (case-insensitive)', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    await createTestPayment(app, user, {
      status: 'ToRefund',
      uid: 'ON-1234-01',
    })
    await createTestPayment(app, user, {
      status: 'ToRefund',
      uid: 'ON-5678-02',
    })

    const count = await app.admin.getToRefundCount(adminUser, 'on-1234-01')

    expect(count).toBe(1)
  })

  it('returns 0 when search query matches no ToRefund payments', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }
    const user = await createTestUser(app, company.id)

    await createTestPayment(app, user, {
      status: 'ToRefund',
      uid: 'ON-1234-01',
    })

    const count = await app.admin.getToRefundCount(adminUser, 'Nonexistent')

    expect(count).toBe(0)
  })
})
