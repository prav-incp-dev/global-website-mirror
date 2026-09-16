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

  const createTestPayment = async (app, userId, companyId, overrides = {}) => {
    const order = await app.prisma.order.create({
      data: {
        userId,
        quantity: 1,
        totalAmount: 1200,
        status: OrderStatus.Paid,
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

    expect(result).toEqual({
      '0xServiceWallet': 12,
      '0xJohnWallet': 360,
      '0xBobWallet': 336,
      '0xCumulativeWallet': 492,
    })
  })

  it('returns only company wallets when the user has no ancestors', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    await createTestSetting(app, company.id, {
      1: { percent: 20, personal: 3, general: 3, confirm: 0 },
    })
    const user = await createTestUser(app, company.id)
    const payment = await createTestPayment(app, user.id, company.id)

    const result = await app.admin.calculateSplit(payment)

    expect(result).toEqual({
      '0xServiceWallet': 12,
      '0xCumulativeWallet': 1188,
    })
  })

  it('keeps the commission of a wallet-less ancestor in the cumulative wallet', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    await createTestSetting(app, company.id, {
      2: { percent: 30, personal: 3, general: 10, confirm: 2 },
      7: { percent: 58, personal: 0, general: 750, confirm: 7 },
    })

    const bob = await createTestUser(app, company.id, { level: 7, wallet: '0xBobWallet' })
    const john = await createTestUser(app, company.id, { level: 2, parentId: bob.id })
    const mary = await createTestUser(app, company.id, { level: 1, parentId: john.id })
    const payment = await createTestPayment(app, mary.id, company.id)

    const result = await app.admin.calculateSplit(payment)

    // John (30%) has no wallet, Bob keeps 58 - 30 = 28%
    expect(result).toEqual({
      '0xServiceWallet': 12,
      '0xBobWallet': 336,
      '0xCumulativeWallet': 852,
    })
  })

  it('does not pay ancestors when their level percent is not higher than the previous one', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    await createTestSetting(app, company.id, {
      1: { percent: 20, personal: 3, general: 3, confirm: 0 },
      2: { percent: 30, personal: 3, general: 10, confirm: 2 },
    })

    const bob = await createTestUser(app, company.id, { level: 1, wallet: '0xBobWallet' })
    const john = await createTestUser(app, company.id, { level: 2, parentId: bob.id, wallet: '0xJohnWallet' })
    const mary = await createTestUser(app, company.id, { level: 1, parentId: john.id })
    const payment = await createTestPayment(app, mary.id, company.id)

    const result = await app.admin.calculateSplit(payment)

    // Bob would get 20 - 30 = -10% so nothing goes to him
    expect(result).toEqual({
      '0xServiceWallet': 12,
      '0xJohnWallet': 360,
      '0xCumulativeWallet': 828,
    })
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
    // Bob (level 2, 15.5%) gets 15.5% - 0% = 15.5 → 15.5
    // Charlie (level 5, 30%) gets 30% - 15.5% = 14.5% → 14.5
    // Cumulative: 100 - 1 - 15.5 - 14.5 = 69
    expect(result).toEqual({
      '0xServiceWallet': 1,
      '0xBobWallet': 15.5,
      '0xCharlieWallet': 14.5,
      '0xCumulativeWallet': 69,
    })
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

    expect(result).toEqual({
      '0xServiceWallet': 12,
      '0xCumulativeWallet': 1188,
    })
  })
})
