import { PaymentStatus, UserRole } from '../generated/prisma/client'
import { canCancelPayment, serializePayment, verifyPaymentOnChain } from '../lib/payment'
import { PRICE_MAP } from '../lib/pricing'
import { usdtAddress, usdtDecimals, chainId } from '../lib/chain.js'

export default async (fastify) => {
  fastify.post('/api/payments/init', {
    schema: {
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'integer', minimum: 0, maximum: 5 },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role === UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      if (!user.company?.wallet) {
        return reply.code(409).send({ error: 'У компании не указан кошелек для приема платежей' })
      }

      const { quantity } = req.body
      const amountUsd = PRICE_MAP[quantity]

      try {
        const createdOrder = await fastify.prisma.order.create({
          data: {
            userId: user.id,
            quantity,
            totalAmount: amountUsd,
            status: 'Pending',
            payment: {
              create: {
                userId: user.id,
                companyId: user.company.id,
                amount: amountUsd,
                tokenSymbol: 'USDT',
                tokenContract: usdtAddress,
                tokenDecimals: usdtDecimals,
                chainId,
                toWallet: user.company.wallet,
                status: PaymentStatus.Pending,
              },
            },
          },
          include: {
            payment: true,
          },
        })

        return reply.send({
          paymentId: createdOrder.payment.id,
          orderId: createdOrder.id,
          amountUsd,
        })
      } catch {
        return reply.code(500).send({ error: 'Ошибка создания платежа' })
      }
    },
  })

  fastify.post('/api/payments/:id/attach-tx', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer', minimum: 1 },
        },
      },
      body: {
        type: 'object',
        required: ['txHash', 'fromWallet'],
        properties: {
          txHash: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
          fromWallet: { type: 'string', format: 'wallet' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role === UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const payment = await fastify.prisma.payment.findUnique({
        where: { id: req.params.id },
        include: { order: true },
      })

      if (!payment || payment.userId !== user.id) {
        return reply.code(404).send({ error: 'Платеж не найден' })
      }

      if (payment.status !== PaymentStatus.Pending) {
        return reply.code(409).send({ error: 'Платеж уже не в ожидании' })
      }

      if (payment.txHash !== null) {
        return reply.code(409).send({ error: 'Транзакция уже привязана к платежу' })
      }

      try {
        const updatedPayment = await fastify.prisma.payment.update({
          where: { id: payment.id },
          data: {
            txHash: req.body.txHash,
            fromWallet: req.body.fromWallet,
          },
          include: { order: true },
        })

        return reply.send(serializePayment(updatedPayment))
      } catch (err) {
        if (err.code === 'P2002') {
          return reply.code(409).send({ error: 'Транзакция уже сохранена' })
        }

        return reply.code(500).send({ error: 'Ошибка привязки транзакции' })
      }
    },
  })

  fastify.post('/api/payments/:id/verify', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer', minimum: 1 },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role === UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const payment = await fastify.prisma.payment.findUnique({
        where: { id: req.params.id },
        include: { order: true },
      })

      if (!payment || payment.userId !== user.id) {
        return reply.code(404).send({ error: 'Платеж не найден' })
      }

      if (payment.status !== PaymentStatus.Pending) {
        return reply.code(409).send({ error: 'Платеж уже не в ожидании' })
      }

      if (!payment.txHash) {
        return reply.code(409).send({ error: 'Транзакция ещё не привязана к платежу' })
      }

      try {
        await verifyPaymentOnChain(payment)

        const [updatedPayment] = await fastify.prisma.$transaction([
          fastify.prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.Completed },
            include: { order: true },
          }),
          fastify.prisma.order.update({
            where: { id: payment.orderId },
            data: { status: 'Paid' },
          }),
        ])

        return reply.send(serializePayment(updatedPayment))
      } catch (err) {
        const verificationErrors = [
          'Transaction not confirmed on chain',
          'Token contract mismatch',
          'Sender mismatch',
          'Transfer details do not match expected payment parameters',
        ]

        if (verificationErrors.includes(err.message)) {
          await fastify.prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.Failed },
          })

          return reply.code(409).send({ error: 'Транзакция не была подтверждена сетью' })
        }

        return reply.code(500).send({ error: 'Ошибка верификации платежа' })
      }
    },
  })

  fastify.get('/api/payments', {
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role === UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const payments = await fastify.prisma.payment.findMany({
        where: { userId: user.id },
        include: {
          order: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return reply.send({
        success: true,
        payments: payments.map(serializePayment),
      })
    },
  })

  fastify.post('/api/payments/:id/cancel', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer', minimum: 1 },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role === UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const payment = await fastify.prisma.payment.findUnique({
        where: { id: req.params.id },
        include: {
          order: true,
        },
      })

      if (!payment || payment.userId !== user.id) {
        return reply.code(404).send({ error: 'Платеж не найден' })
      }

      if (!canCancelPayment(payment)) {
        return reply.code(409).send({ error: 'Запрос на отмену можно оставить только в течение 24 часов' })
      }

      const updatedPayment = await fastify.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.ToCancel,
          cancelRequestedAt: new Date(),
        },
        include: {
          order: true,
        },
      })

      return reply.send({
        success: true,
        payment: serializePayment(updatedPayment),
      })
    },
  })
}
