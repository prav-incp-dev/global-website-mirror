import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../helpers'
import { PaymentStatus, OrderStatus } from '@/generated/prisma/enums'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('calculateSplit', () => {
  const createTestCompany = async (app, overrides = {}) => {
    return app.prisma.company.create({
      data: {
        name: `Distribute Company ${Date.now()}-${Math.random()}`,
        serviceWallet: '0xServiceWallet',
        cumulativeWallet: '0xCumulativeWallet',
        ...overrides,
      },
    })
  }

  const createTestSetting = async (app, companyId, levels) => {
    return app.prisma.setting.create({
      data: {
        companyId,
        general: { staleDays: 30, orphantDays: 40, refundFee: 5 },
        levels,
        prices: { 0: 100, 1: 1200 },
      },
    })
  }

  const createTestUser = async (app, companyId, overrides = {}) => {
    return app.prisma.user.create({
      data: {
        email: `distribute-${Date.now()}-${Math.random()}@test.com`,
        password: 'hash',
        role: 'Consultant',
        firstName: 'Test',
        lastName: 'User',
        phone: `+7${Date.now()}${Math.floor(Math.random() * 100)}`,
        companyId,
        level: 1,
        ...overrides,
      },
    })
  }

  const createTestPayment = async (app, userId, companyId, overrides = {}, orderOverrides = {}) => {
    const order = await app.prisma.order.create({
      data: {
        userId,
        quantity: 1,
        totalAmount: 1200,
        status: OrderStatus.Paid,
        ...orderOverrides,
      },
    })

    const payment = await app.prisma.payment.create({
      data: {
        userId,
        companyId,
        orderId: order.id,
        amount: 1200,
        status: PaymentStatus.Completed,
        tokenContract: 'test-contract',
        chainId: 1,
        tokenDecimals: 18,
        toWallet: 'test-wallet',
        ...overrides,
      },
    })

    return app.prisma.payment.findUnique({
      where: { id: payment.id },
      include: { user: true, order: true, company: true },
    })
  }

  it('distributes a payment to ancestors and company wallets', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    await createTestSetting(app, company.id, {
      1: { percent: 20, personal: 3, general: 3, confirm: 0 },
      2: { percent: 30, personal: 3, general: 10, confirm: 2 },
      7: { percent: 58, personal: 0, general: 750, confirm: 7 },
    })

    const bob = await createTestUser(app, company.id, { level: 7, wallet: '0xBobWallet' })
    const john = await createTestUser(app, company.id, { level: 2, parentId: bob.id, wallet: '0xJohnWallet' })
    const mary = await createTestUser(app, company.id, { level: 1, parentId: john.id, wallet: '0xMaryWallet' })

    const payment = await createTestPayment(app, mary.id, company.id)

    const result = await app.admin.calculateSplit(payment)

    expect(result).toEqual([
      { wallet: '0xServiceWallet', amount: 12 },
      { wallet: '0xJohnWallet', amount: 360, userId: john.id, score: 1, groupScore: 0 },
      { wallet: '0xBobWallet', amount: 336, userId: bob.id, score: 0, groupScore: 1 },
      { wallet: '0xCumulativeWallet', amount: 492 },
    ])
  })

  it('returns only company wallets when the user has no ancestors', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    await createTestSetting(app, company.id, {
      1: { percent: 20, personal: 3, general: 3, confirm: 0 },
      2: { percent: 30, personal: 3, general: 10, confirm: 2 },
      7: { percent: 58, personal: 0, general: 750, confirm: 7 },
    })

    const user = await createTestUser(app, company.id, { level: 1 })

    const payment = await createTestPayment(app, user.id, company.id)

    const result = await app.admin.calculateSplit(payment)

    expect(result).toEqual([
      { wallet: '0xServiceWallet', amount: 12 },
      { wallet: '0xCumulativeWallet', amount: 1188 },
    ])
  })

  it('skips ancestor without wallet and adds ancestor with negative percent at zero amount', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    await createTestSetting(app, company.id, {
      1: { percent: 20, personal: 3, general: 3, confirm: 0 },
      2: { percent: 30, personal: 3, general: 10, confirm: 2 },
      7: { percent: 58, personal: 0, general: 750, confirm: 7 },
    })

    // Bob (level 1) has no wallet — gets skipped entirely
    const bob = await createTestUser(app, company.id, { level: 1, wallet: null })
    const john = await createTestUser(app, company.id, { level: 2, parentId: bob.id, wallet: '0xJohnWallet' })
    const mary = await createTestUser(app, company.id, { level: 1, parentId: john.id })

    const payment = await createTestPayment(app, mary.id, company.id)

    const result = await app.admin.calculateSplit(payment)

    // Bob has no wallet so he is skipped.
    // John gets 30% - 0% = 30% → 360, immediate parent → score 1
    // Bob (level 1, 20%) would get 20% - 30% = -10% → amount 0, but since he has no wallet, he's skipped
    // Wait — Bob is the parent of John, so after John, currentUser=John, parentId=Bob
    // But Bob has no wallet, so splitToUser returns 0 and nothing is pushed
    expect(result).toEqual([
      { wallet: '0xServiceWallet', amount: 12 },
      { wallet: '0xJohnWallet', amount: 360, userId: john.id, score: 1, groupScore: 0 },
      { wallet: '0xCumulativeWallet', amount: 828 },
    ])
  })

  it('handles fractional percentages and amounts with two-decimal precision', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    await createTestSetting(app, company.id, {
      1: { percent: 8.25, personal: 3, general: 3, confirm: 0 },
      2: { percent: 15.5, personal: 3, general: 10, confirm: 2 },
      5: { percent: 30, personal: 0, general: 750, confirm: 5 },
    })

    const charlie = await createTestUser(app, company.id, { level: 5, wallet: '0xCharlieWallet' })
    const bob = await createTestUser(app, company.id, { level: 2, parentId: charlie.id, wallet: '0xBobWallet' })
    const alice = await createTestUser(app, company.id, { level: 1, parentId: bob.id, wallet: '0xAliceWallet' })

    const payment = await createTestPayment(app, alice.id, company.id, { amount: 100 })

    const result = await app.admin.calculateSplit(payment)

    // Service: 100 / 100 = 1
    // Bob (level 2, 15.5%) gets 15.5% - 0% = 15.5 → 15.5, immediate parent → score 1
    // Charlie (level 5, 30%) gets 30% - 15.5% = 14.5% → 14.5, groupScore 1
    // Cumulative: 100 - 1 - 15.5 - 14.5 = 69
    expect(result).toEqual([
      { wallet: '0xServiceWallet', amount: 1 },
      { wallet: '0xBobWallet', amount: 15.5, userId: bob.id, score: 1, groupScore: 0 },
      { wallet: '0xCharlieWallet', amount: 14.5, userId: charlie.id, score: 0, groupScore: 1 },
      { wallet: '0xCumulativeWallet', amount: 69 },
    ])
  })

  it('distributes a zero-quantity order only to company wallets even with ancestors', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    await createTestSetting(app, company.id, {
      2: { percent: 30, personal: 3, general: 10, confirm: 2 },
      7: { percent: 58, personal: 0, general: 750, confirm: 7 },
    })

    const bob = await createTestUser(app, company.id, { level: 7, wallet: '0xBobWallet' })
    const john = await createTestUser(app, company.id, { level: 2, parentId: bob.id, wallet: '0xJohnWallet' })
    const mary = await createTestUser(app, company.id, { level: 1, parentId: john.id })

    const order = await app.prisma.order.create({
      data: {
        userId: mary.id,
        quantity: 0,
        totalAmount: 1200,
        status: OrderStatus.Paid,
      },
    })

    const payment = await app.prisma.payment.create({
      data: {
        userId: mary.id,
        companyId: company.id,
        orderId: order.id,
        amount: 1200,
        status: PaymentStatus.Completed,
        tokenContract: 'test-contract',
        chainId: 1,
        tokenDecimals: 18,
        toWallet: 'test-wallet',
      },
    })

    const paymentWithIncludes = await app.prisma.payment.findUnique({
      where: { id: payment.id },
      include: { user: true, order: true, company: true },
    })

    const result = await app.admin.calculateSplit(paymentWithIncludes)

    expect(result).toEqual([
      { wallet: '0xServiceWallet', amount: 12 },
      { wallet: '0xCumulativeWallet', amount: 1188 },
    ])
  })

  it('gives full percent to higher level ancestor and zero amount with groupScore to lower level ancestor', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    await createTestSetting(app, company.id, {
      1: { percent: 20, personal: 3, general: 3, confirm: 0 },
      3: { percent: 39, personal: 3, general: 10, confirm: 2 },
      9: { percent: 59.5, personal: 0, general: 750, confirm: 7 },
    })

    // Hierarchy: Mary → Bob (level 9) → Charlie (level 3)
    const charlie = await createTestUser(app, company.id, { level: 3, wallet: '0xCharlieWallet' })
    const bob = await createTestUser(app, company.id, { level: 9, parentId: charlie.id, wallet: '0xBobWallet' })
    const mary = await createTestUser(app, company.id, { level: 1, parentId: bob.id })

    const payment = await createTestPayment(app, mary.id, company.id)

    const result = await app.admin.calculateSplit(payment)

    // Service: 1200 / 100 = 12
    // Bob (level 9, 59.5%) gets 59.5% - 0% = 59.5% → 714, immediate parent → score 1
    // Charlie (level 3, 39%) gets 39% - 59.5% = -20.5% → amount 0, groupScore 1
    // Cumulative: 1200 - 12 - 714 - 0 = 474
    expect(result).toEqual([
      { wallet: '0xServiceWallet', amount: 12 },
      { wallet: '0xBobWallet', amount: 714, userId: bob.id, score: 1, groupScore: 0 },
      { wallet: '0xCharlieWallet', amount: 0, userId: charlie.id, score: 0, groupScore: 1 },
      { wallet: '0xCumulativeWallet', amount: 474 },
    ])
  })

  it('assigns personal and group scores equal to order quantity', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    await createTestSetting(app, company.id, {
      1: { percent: 20, personal: 3, general: 3, confirm: 0 },
      2: { percent: 30, personal: 3, general: 10, confirm: 2 },
      7: { percent: 58, personal: 0, general: 750, confirm: 7 },
    })

    const bob = await createTestUser(app, company.id, { level: 7, wallet: '0xBobWallet' })
    const john = await createTestUser(app, company.id, { level: 2, parentId: bob.id, wallet: '0xJohnWallet' })
    const mary = await createTestUser(app, company.id, { level: 1, parentId: john.id, wallet: '0xMaryWallet' })

    // Order quantity = 5; scores should be 5 instead of 1
    const payment = await createTestPayment(app, mary.id, company.id, {}, { quantity: 5 })

    const result = await app.admin.calculateSplit(payment)

    expect(result).toEqual([
      { wallet: '0xServiceWallet', amount: 12 },
      { wallet: '0xJohnWallet', amount: 360, userId: john.id, score: 5, groupScore: 0 },
      { wallet: '0xBobWallet', amount: 336, userId: bob.id, score: 0, groupScore: 5 },
      { wallet: '0xCumulativeWallet', amount: 492 },
    ])
  })
})
