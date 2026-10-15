import { OrderStatus, PaymentStatus, UserRole } from '../generated/prisma/client'
import { HOURS24, MINUTES15 } from '../lib/constants.js'
import { verifyPaymentOnChain } from '../lib/payment.js'

async function cancelPayments(prisma, payments = []) {
  if (payments.length === 0) return

  const paymentIds = payments.map((p) => p.id)
  const orderIds = payments.map((p) => p.orderId)

  return await prisma.$transaction([
    prisma.payment.updateMany({
      where: { id: { in: paymentIds } },
      data: { status: PaymentStatus.Canceled },
    }),
    prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: OrderStatus.Canceled },
    }),
  ])
}

const DEFINITIVE_VERIFICATION_ERRORS = [
  'Transaction reverted',
  'Token contract mismatch',
  'Sender mismatch',
  'Transfer details do not match expected payment parameters',
]

async function verifyPayments(prisma, payments = []) {
  if (payments.length === 0) return

  for (const payment of payments) {
    try {
      await verifyPaymentOnChain(payment)

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.Completed },
          include: { order: true },
        }),
        prisma.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.Paid },
        }),
      ])
    } catch (err) {
      // Транзиентные ошибки (например, транзакция ещё не подтверждена)
      // не переводим в Failed — платёж остаётся Pending для повторной проверки.
      if (DEFINITIVE_VERIFICATION_ERRORS.includes(err.message)) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.Failed },
        })
      }
    }
  }
}

async function getUID(prisma, payment) {
  const memberId = payment.user.memberId
  const suffix = memberId.slice(-4)
  const lastPayment = await prisma.payment.findFirst({
    where: {
      userId: payment.userId,
      uid: { not: null },
    },
    orderBy: { uid: 'desc' },
    select: { uid: true },
  })

  const lastNumber = lastPayment ? Number(lastPayment.uid.split('-').pop()) : 0
  return `ON-${suffix}-${String(lastNumber + 1).padStart(2, '0')}`
}

async function finalizePayments(prisma, payments = [], log = console) {
  if (payments.length === 0) return

  for (const payment of payments) {
    const quantity = payment.order?.quantity ?? 0
    const uid = quantity > 0 ? await getUID(prisma, payment) : null

    try {
      const updates = [
        prisma.payment.update({
          where: { id: payment.id },
          data: { uid, finalized: true },
        }),
      ]

      if (payment.user.role === UserRole.Candidate) {
        updates.push(
          prisma.user.update({
            where: { id: payment.userId },
            data: { role: UserRole.Consultant, level: 1 },
          }),
        )
      }

      await prisma.$transaction(updates)
    } catch {
      log.info(`Failed to assign uniq payment id to ${payment.id}`)
    }
  }
}

export async function checkPayments(prisma, log = console) {
  const paymentsToCancel = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.Pending,
      txHash: null,
      createdAt: { lt: new Date(Date.now() - HOURS24) },
    },
    select: {
      id: true,
      orderId: true,
    },
  })

  await cancelPayments(prisma, paymentsToCancel)

  const fifteenMinutesAgo = new Date(Date.now() - MINUTES15)

  const paymentsToVerify = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.Pending,
      txHash: { not: null },
      createdAt: { lt: fifteenMinutesAgo },
    },
    select: {
      id: true,
      orderId: true,
      txHash: true,
      tokenContract: true,
      tokenDecimals: true,
      fromWallet: true,
      toWallet: true,
      amount: true,
    },
  })

  await verifyPayments(prisma, paymentsToVerify)

  const companies = await prisma.company.findMany({
    select: {
      id: true,
      settings: {
        select: { general: true },
        take: 1,
      },
    },
  })

  const paymentsToFinalize = []
  for (const company of companies) {
    const refundMinutes = Number(company.settings[0]?.general?.refundMinutes || 0)
    const intervalMs = refundMinutes > 0 ? refundMinutes * 60 * 1000 : HOURS24
    const cutoff = new Date(Date.now() - intervalMs)

    const companyPayments = await prisma.payment.findMany({
      where: {
        companyId: company.id,
        status: PaymentStatus.Completed,
        uid: null,
        createdAt: { lt: cutoff },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        user: true,
        order: {
          select: { quantity: true },
        },
      },
    })

    paymentsToFinalize.push(...companyPayments)
  }

  await finalizePayments(prisma, paymentsToFinalize, log)

  log.info(
    `${paymentsToCancel.length} payments canceled, ${paymentsToVerify.length} payments verified, ${paymentsToFinalize.length} payments finalized`,
  )
}
