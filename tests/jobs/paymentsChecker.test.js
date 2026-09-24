import { describe, it, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import { createApp } from '../helpers'
import { checkPayments } from '../../src/jobs/paymentsChecker.js'
import { HOURS24, MINUTES15 } from '../../src/lib/constants.js'
import { verifyPaymentOnChain } from '../../src/lib/payment.js'
import { OrderStatus, PaymentStatus, UserRole } from '../../src/generated/prisma/client'

// Mock only the on-chain verification; keep the other payment helpers intact.
vi.mock('../../src/lib/payment.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, verifyPaymentOnChain: vi.fn() }
})

describe('checkPayments', () => {
  const baseUser = {
    password: 'hash',
    firstName: 'John',
    lastName: 'Smith',
  }

  const silentLogger = { info: vi.fn() }

  beforeEach(() => {
    vi.mocked(verifyPaymentOnChain).mockReset()
    silentLogger.info.mockClear()
  })

  const createUser = async (app, { email, phone, memberId, ...rest } = {}) => {
    const company = await app.prisma.company.create({
      data: {
        name: `CheckPayments Co ${Date.now()} ${Math.random().toString(36).slice(2, 6)}`,
        wallet: `0x${'11'.repeat(20)}`,
      },
    })
    return app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Candidate',
        companyId: company.id,
        email: email ?? `checkpayments-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
        phone: phone ?? `+1999999${String(Date.now()).slice(-4)}${Math.random().toString(36).slice(2, 4)}`,
        memberId: memberId ?? `DOM-00000000-${String(Date.now()).slice(-4)}`,
        ...rest,
      },
    })
  }

  const createPayment = async (
    app,
    user,
    { status, txHash, uid = null, createdAt = new Date(), quantity = 1 } = {},
  ) => {
    // txHash is @unique — generate a unique one unless the caller explicitly
    // passes null (payment without txHash) or a specific value.
    const resolvedTxHash = txHash === undefined ? `0x${crypto.randomBytes(32).toString('hex')}` : txHash
    const orderStatus =
      status === PaymentStatus.Completed
        ? OrderStatus.Paid
        : status === PaymentStatus.Canceled
          ? OrderStatus.Canceled
          : OrderStatus.Pending
    const order = await app.prisma.order.create({
      data: {
        userId: user.id,
        quantity,
        totalAmount: 1200,
        status: orderStatus,
        payment: {
          create: {
            userId: user.id,
            companyId: user.companyId,
            amount: 1200,
            tokenSymbol: 'USDT',
            tokenContract: '0x3333333333333333333333333333333333333333',
            tokenDecimals: 18,
            chainId: 97,
            fromWallet: null,
            toWallet: `0x${'22'.repeat(20)}`,
            status,
            txHash: resolvedTxHash,
            uid,
            createdAt,
          },
        },
      },
      include: { payment: true },
    })

    // The prismaCleaner only auto-tracks top-level creates, so register the
    // nested Payment explicitly to keep the shared test DB free of orphans.
    const set = app.prismaCleaner.records.get('Payment') || new Set()
    set.add(order.payment.id)
    app.prismaCleaner.records.set('Payment', set)

    return order.payment
  }

  it('cancels pending payment without txHash and its order', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app)
    const payment = await createPayment(app, user, { status: PaymentStatus.Pending, txHash: null })

    await checkPayments(app.prisma, silentLogger)

    const updatedPayment = await app.prisma.payment.findUnique({ where: { id: payment.id } })
    const updatedOrder = await app.prisma.order.findUnique({ where: { id: payment.orderId } })

    expect(updatedPayment.status).toBe(PaymentStatus.Canceled)
    expect(updatedOrder.status).toBe(OrderStatus.Canceled)
  })

  it('cancels only the pending payment without txHash, leaving the verifyable one to verify path', async ({
    expect,
  }) => {
    const app = await createApp()
    const user = await createUser(app)
    const noTxHash = await createPayment(app, user, { status: PaymentStatus.Pending, txHash: null })
    const withTxHash = await createPayment(app, user, {
      status: PaymentStatus.Pending,
      quantity: 2,
      fromWallet: '0x2222222222222222222222222222222222222222',
      createdAt: new Date(Date.now() - 2 * MINUTES15),
    })
    vi.mocked(verifyPaymentOnChain).mockRejectedValueOnce(new Error('Transaction not confirmed on chain'))

    await checkPayments(app.prisma, silentLogger)

    const updatedNoTx = await app.prisma.payment.findUnique({ where: { id: noTxHash.id } })
    const updatedWithTx = await app.prisma.payment.findUnique({ where: { id: withTxHash.id } })

    expect(updatedNoTx.status).toBe(PaymentStatus.Canceled)
    expect(updatedWithTx.status).toBe(PaymentStatus.Failed)
  })

  it('verifies pending payment with txHash and marks it Completed/Paid', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app)
    const payment = await createPayment(app, user, {
      status: PaymentStatus.Pending,
      quantity: 2,
      fromWallet: '0x2222222222222222222222222222222222222222',
      createdAt: new Date(Date.now() - 2 * MINUTES15),
    })
    vi.mocked(verifyPaymentOnChain).mockResolvedValueOnce({})

    await checkPayments(app.prisma, silentLogger)

    const updatedPayment = await app.prisma.payment.findUnique({ where: { id: payment.id } })
    const updatedOrder = await app.prisma.order.findUnique({ where: { id: payment.orderId } })

    expect(updatedPayment.status).toBe(PaymentStatus.Completed)
    expect(updatedOrder.status).toBe(OrderStatus.Paid)

    // Must have received the full record needed to verify on chain
    expect(verifyPaymentOnChain).toHaveBeenCalledWith(
      expect.objectContaining({
        id: payment.id,
        txHash: payment.txHash,
        tokenContract: payment.tokenContract,
        tokenDecimals: payment.tokenDecimals,
        fromWallet: payment.fromWallet,
        toWallet: payment.toWallet,
        amount: expect.anything(),
      }),
    )
  })

  it('marks payment as Failed when on-chain verification rejects', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app)
    const payment = await createPayment(app, user, {
      status: PaymentStatus.Pending,
      quantity: 2,
      fromWallet: '0x2222222222222222222222222222222222222222',
      createdAt: new Date(Date.now() - 2 * MINUTES15),
    })
    vi.mocked(verifyPaymentOnChain).mockRejectedValueOnce(new Error('Transaction not confirmed on chain'))

    await checkPayments(app.prisma, silentLogger)

    const updatedPayment = await app.prisma.payment.findUnique({ where: { id: payment.id } })
    const updatedOrder = await app.prisma.order.findUnique({ where: { id: payment.orderId } })

    expect(updatedPayment.status).toBe(PaymentStatus.Failed)
    expect(updatedOrder.status).toBe(OrderStatus.Pending) // order untouched on failure
  })

  it('does not verify pending payment with txHash created less than 15 minutes ago', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app)
    const freshPayment = await createPayment(app, user, {
      status: PaymentStatus.Pending,
      fromWallet: '0x2222222222222222222222222222222222222222',
      // createdAt defaults to now — less than 15 minutes old, skipped by verify query
    })

    await checkPayments(app.prisma, silentLogger)

    expect(verifyPaymentOnChain).not.toHaveBeenCalled()

    const updated = await app.prisma.payment.findUnique({ where: { id: freshPayment.id } })
    expect(updated.status).toBe(PaymentStatus.Pending)
  })

  it('assigns uid to paid payment older than 24h with no uid and promotes candidate to consultant', async ({
    expect,
  }) => {
    const app = await createApp()
    const user = await createUser(app, { memberId: 'DOM-00000000-1234' })
    const oldPayment = await createPayment(app, user, {
      status: PaymentStatus.Completed,
      quantity: 2,
      createdAt: new Date(Date.now() - 2 * HOURS24),
    })

    await checkPayments(app.prisma, silentLogger)

    const updated = await app.prisma.payment.findUnique({ where: { id: oldPayment.id } })
    const updatedUser = await app.prisma.user.findUnique({ where: { id: user.id } })

    expect(updated.uid).toBe('ON-1234-01')
    expect(updatedUser.role).toBe(UserRole.Consultant)
    expect(updatedUser.level).toBe(1)
  })

  it('does not assign uid to paid payment created within 24h', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app, { memberId: 'DOM-00000000-1234' })
    const freshPayment = await createPayment(app, user, {
      status: PaymentStatus.Completed,
      createdAt: new Date(),
    })

    await checkPayments(app.prisma, silentLogger)

    const updated = await app.prisma.payment.findUnique({ where: { id: freshPayment.id } })
    const updatedUser = await app.prisma.user.findUnique({ where: { id: user.id } })

    expect(updated.uid).toBeNull()
    expect(updatedUser.role).toBe(UserRole.Candidate)
    expect(updatedUser.level).toBe(0)
  })

  it('does not assign uid to a payment with zero quantity', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app, { memberId: 'DOM-00000000-9876' })
    const oldPayment = await createPayment(app, user, {
      status: PaymentStatus.Completed,
      quantity: 0,
      createdAt: new Date(Date.now() - 2 * HOURS24),
    })

    await checkPayments(app.prisma, silentLogger)

    const updated = await app.prisma.payment.findUnique({ where: { id: oldPayment.id } })
    const updatedUser = await app.prisma.user.findUnique({ where: { id: user.id } })

    expect(updated.finalized).toBe(true)
    expect(updated.uid).toBeNull()
    expect(updatedUser.role).toBe(UserRole.Consultant)
    expect(updatedUser.level).toBe(1)
  })

  it('assigns uid to a payment with single quantity', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app, { memberId: 'DOM-00000000-5555' })
    const oldPayment = await createPayment(app, user, {
      status: PaymentStatus.Completed,
      quantity: 1,
      createdAt: new Date(Date.now() - 2 * HOURS24),
    })

    await checkPayments(app.prisma, silentLogger)

    const updated = await app.prisma.payment.findUnique({ where: { id: oldPayment.id } })

    expect(updated.finalized).toBe(true)
    expect(updated.uid).toBe('ON-5555-01')
  })

  it('assigns uid to consultant payment without changing role or level', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app, { memberId: 'DOM-00000000-4321', role: UserRole.Consultant, level: 5 })
    const oldPayment = await createPayment(app, user, {
      status: PaymentStatus.Completed,
      quantity: 2,
      createdAt: new Date(Date.now() - 2 * HOURS24),
    })

    await checkPayments(app.prisma, silentLogger)

    const updated = await app.prisma.payment.findUnique({ where: { id: oldPayment.id } })
    const updatedUser = await app.prisma.user.findUnique({ where: { id: user.id } })

    expect(updated.uid).toBe('ON-4321-01')
    expect(updatedUser.role).toBe(UserRole.Consultant)
    expect(updatedUser.level).toBe(5)
  })

  it('continues uid numbering from the user highest assigned uid', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app, { memberId: 'DOM-00000000-9999' })
    await createPayment(app, user, {
      status: PaymentStatus.Completed,
      uid: 'ON-9999-01',
      createdAt: new Date(Date.now() - 5 * HOURS24),
    })
    await createPayment(app, user, {
      status: PaymentStatus.Completed,
      uid: 'ON-9999-11',
      createdAt: new Date(Date.now() - 4 * HOURS24),
    })
    const newPayment = await createPayment(app, user, {
      status: PaymentStatus.Completed,
      quantity: 2,
      createdAt: new Date(Date.now() - 2 * HOURS24),
    })

    await checkPayments(app.prisma, silentLogger)

    const updated = await app.prisma.payment.findUnique({ where: { id: newPayment.id } })
    expect(updated.uid).toBe('ON-9999-12')
  })

  it('assigns sequential uid numbers to multiple payments finalized in the same run', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app, { memberId: 'DOM-00000000-7777' })
    await createPayment(app, user, {
      status: PaymentStatus.Completed,
      uid: 'ON-7777-03',
      createdAt: new Date(Date.now() - 5 * HOURS24),
    })
    const first = await createPayment(app, user, {
      status: PaymentStatus.Completed,
      quantity: 2,
      createdAt: new Date(Date.now() - 3 * HOURS24),
    })
    const second = await createPayment(app, user, {
      status: PaymentStatus.Completed,
      quantity: 2,
      createdAt: new Date(Date.now() - 2 * HOURS24),
    })

    await checkPayments(app.prisma, silentLogger)

    const firstUpdated = await app.prisma.payment.findUnique({ where: { id: first.id } })
    const secondUpdated = await app.prisma.payment.findUnique({ where: { id: second.id } })
    expect(firstUpdated.uid).toBe('ON-7777-04')
    expect(secondUpdated.uid).toBe('ON-7777-05')
  })

  it('logs summary counts at the end', async ({ expect }) => {
    const app = await createApp()
    const user = await createUser(app, { memberId: 'DOM-00000000-5678' })

    await createPayment(app, user, { status: PaymentStatus.Pending, txHash: null })
    await createPayment(app, user, {
      status: PaymentStatus.Pending,
      createdAt: new Date(Date.now() - 2 * MINUTES15),
    })
    await createPayment(app, user, {
      status: PaymentStatus.Completed,
      createdAt: new Date(Date.now() - 2 * HOURS24),
    })

    vi.mocked(verifyPaymentOnChain).mockRejectedValueOnce(new Error('Transaction not confirmed on chain'))

    await checkPayments(app.prisma, silentLogger)

    expect(silentLogger.info).toHaveBeenCalledWith('1 payments canceled, 1 payments verified, 1 payments finalized')
  })
})
