import { OrderStatus, PaymentStatus, UserRole } from '../generated/prisma/client'
import { HOURS24, verifyPaymentOnChain } from '../lib/payment.js'

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
    } catch {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.Failed },
      })
    }
  }
}

async function finalizePayment(prisma, payments = [], log = console) {
  if (payments.length === 0) return

  for (const payment of payments) {
    const memberId = payment.user.memberId
    const suffix = memberId.slice(-4)
    const rank = await prisma.payment.count({
      where: {
        userId: payment.userId,
        status: PaymentStatus.Completed,
        id: { lt: payment.id },
      },
    })
    const uid = `ON-${suffix}-${String(rank + 1).padStart(2, '0')}`

    try {
      const updates = [
        prisma.payment.update({
          where: { id: payment.id },
          data: { uid },
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
    },
    select: {
      id: true,
      orderId: true,
    },
  })

  await cancelPayments(prisma, paymentsToCancel)

  const paymentsToVerify = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.Pending,
      txHash: { not: null },
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

  const twentyFourHoursAgo = new Date(Date.now() - HOURS24)

  const paymentsToFinalize = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.Completed,
      uid: null,
      createdAt: { lt: twentyFourHoursAgo },
    },
    include: {
      user: true,
    },
  })

  await finalizePayment(prisma, paymentsToFinalize, log)

  log.info(
    `${paymentsToCancel.length} payments canceled, ${paymentsToVerify.length} payments verified, ${paymentsToFinalize.length} payments finalized`,
  )
}
