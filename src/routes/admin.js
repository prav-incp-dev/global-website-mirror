import { stringify } from 'csv-stringify/sync'
import bcrypt from 'bcryptjs'
import { OrderStatus, PaymentStatus, UserRole } from '../generated/prisma/client'
import { serializePayment, verifyPaymentOnChain } from '../lib/payment'
import { encryptSecret, decryptSecret } from '../lib/crypto.js'
import { sendPaymentUnconfirmedEmail, sendTestEmail, setEmailSettings } from '../services/emailService.js'
import { PAGE_LIMIT, MIN_LEVEL, MAX_LEVEL, CLIENT_WAGES_LIMIT } from '../lib/constants.js'
import { userName } from '../../src/lib/user'
import { uniqConstraintLabel } from '../lib/prismaHelpers.js'

export default async (fastify) => {
  const emailTestRateLimit = new Map()

  fastify.put('/api/admin/profile', {
    schema: {
      body: {
        type: 'object',
        required: ['firstName', 'lastName'],
        properties: {
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { firstName, lastName } = req.body

      try {
        const updatedUser = await fastify.prisma.user.update({
          where: { id: user.id },
          data: {
            firstName,
            lastName,
          },
        })

        return reply.send({
          success: true,
          profile: {
            id: updatedUser.id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
          },
        })
      } catch {
        return reply.code(500).send({ error: 'Ошибка обновления профиля' })
      }
    },
  })

  fastify.put('/api/admin/company', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          wallet: {
            anyOf: [
              { type: 'string', format: 'wallet' },
              { type: 'string', maxLength: 0 },
            ],
          },
          serviceWallet: {
            anyOf: [
              { type: 'string', format: 'wallet' },
              { type: 'string', maxLength: 0 },
            ],
          },
          cumulativeWallet: {
            anyOf: [
              { type: 'string', format: 'wallet' },
              { type: 'string', maxLength: 0 },
            ],
          },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { name, wallet, serviceWallet, cumulativeWallet } = req.body

      try {
        const company = await fastify.prisma.company.update({
          where: { id: user.company.id },
          data: {
            name,
            wallet: wallet || null,
            serviceWallet: serviceWallet || null,
            cumulativeWallet: cumulativeWallet || null,
          },
        })

        return reply.send({
          success: true,
          company: {
            id: company.id,
            name: company.name,
            wallet: company.wallet,
            serviceWallet: company.serviceWallet,
            cumulativeWallet: company.cumulativeWallet,
          },
        })
      } catch (err) {
        if (err.code === 'P2002') {
          const uniqFields = {
            name: 'Такое имя компании',
            wallet: 'Такой распределительный счет',
            serviceWallet: 'Такой счет на обслуживание',
            cumulativeWallet: 'Такой накопительный счет',
          }

          return reply.code(409).send({ error: `${uniqConstraintLabel(err.message, uniqFields)} уже есть в системе` })
        }
        return reply.code(500).send({ error: 'Ошибка обновления компании' })
      }
    },
  })

  fastify.get('/api/admin/clients', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: PAGE_LIMIT },
          query: { type: 'string' },
          orphansOnly: { type: 'boolean', default: false },
          sortBy: { type: 'string', enum: ['id', 'name', 'level', 'role', 'score'], default: 'id' },
          fromLevel: { type: 'integer', minimum: MIN_LEVEL, maximum: MAX_LEVEL, default: MIN_LEVEL },
          toLevel: { type: 'integer', minimum: MIN_LEVEL, maximum: MAX_LEVEL, default: MAX_LEVEL },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const {
        page = 1,
        limit = PAGE_LIMIT,
        query = '',
        orphansOnly = false,
        sortBy = 'id',
        fromLevel,
        toLevel,
      } = req.query
      const [result, orphansCount] = await Promise.all([
        fastify.admin.getClients(user, page, limit, query, orphansOnly, sortBy, fromLevel, toLevel),
        fastify.admin.getOrphansCount(user, query, fromLevel, toLevel),
      ])
      return reply.send({ ...result, orphansCount })
    },
  })

  fastify.get('/api/admin/clients/export', {
    schema: {
      querystring: {
        type: 'object',
        required: ['fromDate', 'toDate'],
        properties: {
          fromDate: { type: 'string' },
          toDate: { type: 'string' },
          query: { type: 'string', default: '' },
          orphansOnly: { type: 'boolean', default: false },
          sortBy: { type: 'string', enum: ['id', 'name', 'level', 'role', 'score'], default: 'id' },
          fromLevel: { type: 'integer', default: MIN_LEVEL },
          toLevel: { type: 'integer', default: MAX_LEVEL },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { fromDate, toDate, query, orphansOnly, sortBy, fromLevel, toLevel } = req.query

      // Fetch all clients with level history date and wage scores in a single query
      const clients = await fastify.admin.exportClients(
        user,
        fromDate,
        toDate,
        query,
        orphansOnly,
        sortBy,
        fromLevel,
        toLevel,
      )

      // Build CSV with BOM for Excel
      const csv = stringify(clients, {
        header: true,
        columns: [
          { key: 'name', header: 'Имя' },
          { key: 'email', header: 'Почта' },
          { key: 'memberId', header: 'Номер пайщика' },
          { key: 'level', header: 'Уровень' },
          { key: 'levelDate', header: 'Дата получения уровня' },
          { key: 'wageScore', header: 'Личные единицы за период' },
          { key: 'wageGroupScore', header: 'Групповые единицы за период' },
          { key: 'totalScore', header: 'Общие единицы за период' },
          { key: 'parentName', header: 'Родитель' },
          { key: 'parentEmail', header: 'Почта родителя' },
        ],
        bom: true,
      })

      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="clients-${fromDate}-${toDate}.csv"`)
      return reply.send(csv)
    },
  })

  fastify.get('/api/admin/company/wages/export', {
    schema: {
      querystring: {
        type: 'object',
        required: ['fromDate', 'toDate', 'wallet'],
        properties: {
          fromDate: { type: 'string' },
          toDate: { type: 'string' },
          wallet: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { fromDate, toDate, wallet } = req.query

      const wages = await fastify.prisma.wage.findMany({
        where: {
          companyId: user.company.id,
          toWallet: wallet,
          createdAt: {
            gte: new Date(fromDate),
            lte: new Date(toDate + 'T23:59:59.999Z'),
          },
        },
        include: {
          payment: {
            select: {
              txHash: true,
              fromWallet: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      const rows = wages.map((w) => ({
        date: new Date(w.createdAt).toLocaleDateString('ru-RU'),
        amount: Number(w.amount).toFixed(2),
        userName: w.payment?.user ? userName(w.payment.user) : '—',
        fromWallet: w.fromWallet || '—',
        txHash: w.txHash || '—',
      }))

      const csv = stringify(rows, {
        header: true,
        columns: [
          { key: 'date', header: 'Дата' },
          { key: 'amount', header: 'Сумма' },
          { key: 'userName', header: 'Пользователь' },
          { key: 'fromWallet', header: 'Кошелек отправителя' },
          { key: 'txHash', header: 'Хэш транзакции' },
        ],
        bom: true,
      })

      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header(
        'Content-Disposition',
        `attachment; filename="wages-${wallet.slice(0, 8)}-${fromDate}-${toDate}.csv"`,
      )
      return reply.send(csv)
    },
  })

  fastify.get('/api/admin/payments', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: PAGE_LIMIT },
          query: { type: 'string' },
          toRefundOnly: { type: 'boolean', default: false },
          unconfirmedOnly: { type: 'boolean', default: false },
          sortBy: { type: 'string', enum: ['id', 'amount', 'status'], default: 'id' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const {
        page = 1,
        limit = PAGE_LIMIT,
        query = '',
        toRefundOnly = false,
        sortBy = 'id',
        unconfirmedOnly = false,
      } = req.query
      const [result, toRefundCount, unconfirmedCount] = await Promise.all([
        fastify.admin.getPayments(user, page, limit, query, toRefundOnly, sortBy, unconfirmedOnly),
        fastify.admin.getToRefundCount(user, query),
        fastify.admin.getUnconfirmedCount(user, query),
      ])
      return reply.send({ ...result, toRefundCount, unconfirmedCount })
    },
  })

  fastify.post('/api/admin/payments/:id/complete', {
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
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      try {
        const payment = await fastify.prisma.payment.findUnique({
          where: { id: req.params.id },
          include: { order: true },
        })

        if (!payment) {
          return reply.code(404).send({ error: 'Платеж не найден' })
        }

        if (payment.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        const completable = [PaymentStatus.Pending, PaymentStatus.Unconfirmed, PaymentStatus.Failed]
        if (!completable.includes(payment.status)) {
          return reply
            .code(409)
            .send({ error: 'Зачесть можно только платёж в статусе «В обработке», «Не подтверждён» или «Ошибка»' })
        }

        const [updatedPayment] = await fastify.prisma.$transaction([
          fastify.prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.Completed },
            include: { order: true },
          }),
          fastify.prisma.order.update({
            where: { id: payment.orderId },
            data: { status: OrderStatus.Paid },
          }),
        ])

        return reply.send({ success: true, payment: serializePayment(updatedPayment) })
      } catch {
        return reply.code(500).send({ error: 'Ошибка зачтения платежа' })
      }
    },
  })

  fastify.get('/api/admin/payments/:id/calculate-split', {
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
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      try {
        const payment = await fastify.prisma.payment.findUnique({
          where: { id: req.params.id },
          include: { user: true, order: true, company: true },
        })

        if (!payment) {
          return reply.code(404).send({ error: 'Платеж не найден' })
        }

        if (payment.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        if (payment.status !== PaymentStatus.Completed) {
          return reply.code(409).send({ error: 'Рассчитать сплит можно только для завершенного платежа' })
        }

        if (!payment.company.serviceWallet) {
          return reply.code(400).send({ error: 'Не задан cчет на обслуживание системы' })
        }

        if (!payment.company.cumulativeWallet) {
          return reply.code(400).send({ error: 'Не задан накопительный счет' })
        }

        const split = await fastify.admin.calculateSplit(payment)

        return reply.send({ success: true, split })
      } catch {
        return reply.code(500).send({ error: 'Ошибка расчета сплита' })
      }
    },
  })

  fastify.post('/api/admin/payments/:id/confirm-split', {
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
        required: ['split'],
        properties: {
          txHash: { type: 'string', minLength: 1 },
          split: {
            type: 'object',
            required: ['wages', 'promotions'],
            properties: {
              wages: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['wallet', 'amount'],
                  properties: {
                    wallet: { type: 'string' },
                    amount: { type: 'number' },
                    userId: { type: 'integer' },
                    score: { type: 'integer' },
                    groupScore: { type: 'integer' },
                    onLevel: { type: 'integer', minimum: MIN_LEVEL, maximum: MAX_LEVEL },
                  },
                },
                minItems: 1,
              },
              promotions: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['userId', 'oldLevel', 'newLevel'],
                  properties: {
                    userId: { type: 'integer' },
                    oldLevel: { type: 'integer', minimum: MIN_LEVEL, maximum: MAX_LEVEL },
                    newLevel: { type: 'integer', minimum: MIN_LEVEL, maximum: MAX_LEVEL },
                  },
                },
              },
            },
          },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      try {
        const payment = await fastify.prisma.payment.findUnique({
          where: { id: req.params.id },
          include: { company: true },
        })

        if (!payment) {
          return reply.code(404).send({ error: 'Платеж не найден' })
        }

        if (payment.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        if (payment.status !== PaymentStatus.Completed) {
          return reply.code(409).send({ error: 'Подтвердить сплит можно только для завершенного платежа' })
        }

        if (!payment.company.serviceWallet) {
          return reply.code(400).send({ error: 'Не задан cчет на обслуживание системы' })
        }

        if (!payment.company.cumulativeWallet) {
          return reply.code(400).send({ error: 'Не задан накопительный счет' })
        }

        if (!payment.company.wallet) {
          return reply.code(400).send({ error: 'Не задан распределительный счет' })
        }

        const { split: { wages, promotions = [] }, txHash = null } = req.body
        const company = payment.company

        // Create wages from split items (array of { wallet, amount, userId?, score?, groupScore? })
        // All wages share the same on-chain tx hash of the splitPayment transaction.
        const wagesData = wages.map((item) =>
          fastify.prisma.wage.create({
            data: {
              companyId: company.id,
              paymentId: payment.id,
              txHash,
              fromWallet: company.wallet,
              toWallet: item.wallet,
              onLevel: item.onLevel ?? 0,
              amount: item.amount,
              score: item.score ?? 0,
              groupScore: item.groupScore ?? 0,
              userId: item.userId ?? null,
              description: 'Начисление по распределению платежа',
            },
          }),
        )
        const promotionsHistoryData = promotions.map((item) =>
          fastify.prisma.levelHistory.create({ data: { ...item } }),
        )
        const promotedUsersData = promotions.map((item) =>
          fastify.prisma.user.update({
            where: { id: item.userId },
            data: { level: item.newLevel },
          }),
        )

        // Collect userIds from split items to flag for level review and lock
        const userIds = wages.filter((item) => item.userId != null).map((item) => item.userId)

        // Create all wages, flag users, and update payment status in a transaction
        await fastify.prisma.$transaction([
          ...wagesData,
          ...promotionsHistoryData,
          ...promotedUsersData,
          fastify.prisma.user.updateMany({
            where: { id: { in: userIds } },
            data: { isLocked: true },
          }),
          fastify.prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.Splitted },
          }),
        ])

        return reply.send({ success: true })
      } catch {
        return reply.code(500).send({ error: 'Ошибка подтверждения сплита' })
      }
    },
  })

  fastify.post('/api/admin/payments/:id/refund', {
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
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      try {
        const payment = await fastify.prisma.payment.findUnique({
          where: { id: req.params.id },
          include: { order: true },
        })

        if (!payment) {
          return reply.code(404).send({ error: 'Платеж не найден' })
        }

        if (payment.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        if (payment.status !== PaymentStatus.ToRefund) {
          return reply.code(409).send({ error: 'Зачесть возврат можно только для платежа со статусом «Отмена»' })
        }

        const updatedPayment = await fastify.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.Refunded,
            refundedAt: new Date(),
          },
          include: { order: true },
        })

        return reply.send({ success: true, payment: serializePayment(updatedPayment) })
      } catch {
        return reply.code(500).send({ error: 'Ошибка зачтения возврата платежа' })
      }
    },
  })

  fastify.patch('/api/admin/payments/:id', {
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
        required: ['uid'],
        properties: {
          uid: { type: 'string', minLength: 1, maxLength: 64, format: 'paymentUid' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      try {
        const payment = await fastify.prisma.payment.findUnique({
          where: { id: req.params.id },
          include: { order: true },
        })

        if (!payment) {
          return reply.code(404).send({ error: 'Платеж не найден' })
        }

        if (payment.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        const updatedPayment = await fastify.prisma.payment.update({
          where: { id: payment.id },
          data: { uid: req.body.uid.trim() },
          include: { order: true },
        })

        return reply.send({ success: true, payment: serializePayment(updatedPayment) })
      } catch (err) {
        if (err.code === 'P2002') {
          return reply.code(409).send({ error: 'Такой номер платежа уже есть в системе' })
        }

        return reply.code(500).send({ error: 'Ошибка обновления номера платежа' })
      }
    },
  })

  fastify.post('/api/admin/payments/:id/verify', {
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
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const payment = await fastify.prisma.payment.findUnique({
        where: { id: req.params.id },
        include: { order: true },
      })

      if (!payment) {
        return reply.code(404).send({ error: 'Платеж не найден' })
      }

      if (payment.companyId !== user.company.id) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      if (payment.status !== PaymentStatus.Pending && payment.status !== PaymentStatus.Unconfirmed) {
        return reply.code(409).send({ error: 'Проверить можно только платёж в статусе «В обработке» или «Не подтверждён»' })
      }

      if (!payment.txHash) {
        return reply.code(409).send({ error: 'У платежа не указан хеш транзакции' })
      }

      try {
        await verifyPaymentOnChain(payment)
        return reply.send({ success: true, result: 'found' })
      } catch (err) {
        const notFound = err.message === 'Transaction not confirmed on chain'
        return reply.send({ success: false, result: notFound ? 'not_found' : 'mismatch', error: err.message })
      }
    },
  })

  fastify.post('/api/admin/payments/:id/notify', {
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
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      try {
        const payment = await fastify.prisma.payment.findUnique({
          where: { id: req.params.id },
          include: { order: true, user: true },
        })

        if (!payment) {
          return reply.code(404).send({ error: 'Платеж не найден' })
        }

        if (payment.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        if (payment.status !== PaymentStatus.Pending && payment.status !== PaymentStatus.Unconfirmed) {
          return reply.code(409).send({ error: 'Уведомить можно только платёж в статусе «В обработке» или «Не подтверждён»' })
        }

        const updatedPayment = await fastify.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.Unconfirmed, notifiedAt: new Date() },
          include: { order: true },
        })

        await fastify.prisma.paymentEvent.create({
          data: {
            paymentId: payment.id,
            action: 'admin_notify',
            actorUserId: user.id,
          },
        })

        await sendPaymentUnconfirmedEmail(payment.user, updatedPayment)

        return reply.send({ success: true, payment: serializePayment(updatedPayment) })
      } catch {
        return reply.code(500).send({ error: 'Ошибка уведомления пользователя' })
      }
    },
  })

  fastify.post('/api/admin/payments/:id/cancel', {
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
        required: ['note'],
        properties: {
          note: { type: 'string', minLength: 1, maxLength: 500 },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      try {
        const payment = await fastify.prisma.payment.findUnique({
          where: { id: req.params.id },
          include: { order: true },
        })

        if (!payment) {
          return reply.code(404).send({ error: 'Платеж не найден' })
        }

        if (payment.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        const cancellable = [PaymentStatus.Pending, PaymentStatus.Unconfirmed, PaymentStatus.Failed]
        if (!cancellable.includes(payment.status)) {
          return reply
            .code(409)
            .send({ error: 'Принудительно отменить можно только платёж в статусе «В обработке», «Не подтверждён» или «Ошибка»' })
        }

        const note = req.body.note.trim()

        const [updatedPayment] = await fastify.prisma.$transaction([
          fastify.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.Canceled,
              adminCanceledAt: new Date(),
              adminCanceledBy: user.id,
              adminCancelNote: note,
            },
            include: { order: true },
          }),
          fastify.prisma.order.update({
            where: { id: payment.orderId },
            data: { status: OrderStatus.Canceled },
          }),
          fastify.prisma.paymentEvent.create({
            data: {
              paymentId: payment.id,
              action: 'admin_cancel',
              actorUserId: user.id,
              note,
            },
          }),
        ])

        return reply.send({ success: true, payment: serializePayment(updatedPayment) })
      } catch {
        return reply.code(500).send({ error: 'Ошибка принудительной отмены платежа' })
      }
    },
  })

  fastify.get('/api/admin/clients/search', {
    schema: {
      querystring: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 2 },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { query } = req.query

      const users = await fastify.prisma.user.findMany({
        where: {
          role: { not: 'Admin' },
          companyId: user.company.id,
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          level: true,
        },
        take: 20,
        orderBy: { id: 'desc' },
      })

      return reply.send({ users })
    },
  })

  fastify.put('/api/admin/user/:id/parent', {
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
        properties: {
          parentId: {
            anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }],
          },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { id: userId } = req.params
      const { parentId } = req.body

      if (userId === parentId) {
        return reply.code(400).send({ error: 'Пользователь не может быть собственным родителем' })
      }

      try {
        const targetUser = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, companyId: true },
        })

        if (!targetUser) {
          return reply.code(404).send({ error: 'Пользователь не найден' })
        }

        if (targetUser.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        if (parentId != null) {
          const parentUser = await fastify.prisma.user.findUnique({
            where: { id: parentId },
            select: { id: true, companyId: true },
          })

          if (!parentUser) {
            return reply.code(404).send({ error: 'Родительский пользователь не найден' })
          }

          if (parentUser.companyId !== user.company.id) {
            return reply.code(403).send({ error: 'Доступ запрещен' })
          }
        }

        const updatedUser = await fastify.prisma.user.update({
          where: { id: userId },
          data: { parentId: parentId ?? null, orphant: parentId == null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            level: true,
            parentId: true,
            parent: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        })

        return reply.send({ success: true, user: updatedUser })
      } catch {
        return reply.code(500).send({ error: 'Ошибка обновления родителя' })
      }
    },
  })

  fastify.put('/api/admin/user/:id/level', {
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
        required: ['level', 'levelConfirmed'],
        properties: {
          level: { type: 'integer', minimum: MIN_LEVEL, maximum: MAX_LEVEL },
          levelConfirmed: { type: 'boolean' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { id: userId } = req.params
      const { level, levelConfirmed } = req.body

      try {
        const targetUser = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, companyId: true, role: true, level: true, isLocked: true },
        })

        if (!targetUser) {
          return reply.code(404).send({ error: 'Пользователь не найден' })
        }

        if (targetUser.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        if (targetUser.role !== UserRole.Consultant) {
          return reply.code(400).send({ error: 'Обновлять уровень можно только консультантам' })
        }

        if (targetUser.isLocked) {
          return reply.code(400).send({ error: 'У пользователя уже есть продажи' })
        }

        const updatedUser = await fastify.prisma.user.update({
          where: { id: userId },
          data: { level, levelConfirmed },
          select: {
            id: true,
            level: true,
            levelConfirmed: true,
          },
        })

        if (targetUser.level !== level) {
          const existingLevelHistory = await fastify.prisma.levelHistory.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          })

          if (existingLevelHistory) {
            await fastify.prisma.levelHistory.update({
              where: { id: existingLevelHistory.id },
              data: {
                oldLevel: targetUser.level,
                newLevel: level,
                createdAt: new Date(),
              },
            })
          } else {
            await fastify.prisma.levelHistory.create({
              data: {
                oldLevel: targetUser.level,
                newLevel: level,
                userId,
              },
            })
          }
        }

        return reply.send({ success: true, user: updatedUser })
      } catch {
        return reply.code(500).send({ error: 'Ошибка обновления пользователя' })
      }
    },
  })

  fastify.put('/api/admin/settings', {
    schema: {
      body: {
        type: 'object',
        required: ['type', 'data'],
        properties: {
          type: { type: 'string', enum: ['general', 'levels', 'prices'] },
          data: { type: 'object' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { type, data } = req.body

      try {
        let payload = { [type]: data }

        if (type === 'general') {
          const existing = await fastify.prisma.setting.findUnique({
            where: { companyId: user.company.id },
          })

          payload = { general: { ...(existing?.general ?? {}), ...data } }
        }

        const setting = await fastify.prisma.setting.upsert({
          where: { companyId: user.company.id },
          update: payload,
          create: {
            companyId: user.company.id,
            general: type === 'general' ? payload.general : {},
            levels: type === 'levels' ? data : {},
            prices: type === 'prices' ? data : {},
          },
        })

        return reply.send({ success: true, setting })
      } catch {
        return reply.code(500).send({ error: 'Ошибка сохранения настроек' })
      }
    },
  })

  fastify.put('/api/admin/email-settings', {
    schema: {
      body: {
        type: 'object',
        required: ['fromEmail', 'fromName', 'smtpHost', 'smtpPort', 'smtpUser', 'smtpTls'],
        properties: {
          fromEmail: { type: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
          fromName: { type: 'string', minLength: 1, maxLength: 120 },
          smtpHost: { type: 'string', minLength: 1, maxLength: 255 },
          smtpPort: { type: 'integer', minimum: 1, maximum: 65535 },
          smtpUser: { type: 'string', minLength: 1, maxLength: 255 },
          smtpPass: { type: 'string', minLength: 1, maxLength: 255 },
          smtpTls: { type: 'boolean' },
          adminPassword: { type: 'string' },
          reason: { type: 'string', maxLength: 500 },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      try {
        const setting = await fastify.prisma.setting.findUnique({
          where: { companyId: user.company.id },
        })

        const general = setting?.general ?? {}
        const existingEmail = general.email ?? {}

        const {
          fromEmail,
          fromName,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          smtpTls,
          adminPassword,
          reason,
        } = req.body

        const currentTls =
          typeof existingEmail.smtpTls === 'boolean' ? existingEmail.smtpTls : process.env.SMTP_TLS === 'true'
        const currentHost = existingEmail.smtpHost ?? process.env.SMTP_HOST
        const currentPort = existingEmail.smtpPort ?? (parseInt(process.env.SMTP_PORT, 10) || 587)
        const currentUser = existingEmail.smtpUser ?? process.env.SMTP_USER

        const smtpChanged =
          smtpHost !== currentHost ||
          smtpPort !== currentPort ||
          smtpUser !== currentUser ||
          smtpTls !== currentTls ||
          Boolean(smtpPass)

        if (smtpChanged) {
          if (!adminPassword) {
            return reply.code(400).send({ error: 'Для изменения SMTP-настроек требуется пароль администратора' })
          }

          const adminRecord = await fastify.prisma.user.findUnique({
            where: { id: user.id },
            select: { password: true },
          })

          const validPassword = await bcrypt.compare(adminPassword, adminRecord?.password || '')
          if (!validPassword) {
            return reply.code(403).send({ error: 'Неверный пароль администратора' })
          }
        }

        const email = {
          ...existingEmail,
          fromEmail,
          fromName,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpTls,
        }

        if (smtpPass) {
          email.smtpPassEncrypted = encryptSecret(smtpPass)
        }

        const updatedGeneral = { ...general, email }

        await fastify.prisma.setting.upsert({
          where: { companyId: user.company.id },
          update: { general: updatedGeneral },
          create: {
            companyId: user.company.id,
            general: updatedGeneral,
            levels: {},
            prices: {},
          },
        })

        setEmailSettings({
          fromEmail: email.fromEmail,
          fromName: email.fromName,
          smtpHost: email.smtpHost,
          smtpPort: email.smtpPort,
          smtpUser: email.smtpUser,
          smtpPass: email.smtpPassEncrypted ? decryptSecret(email.smtpPassEncrypted) : process.env.SMTP_PASS,
          smtpTls: email.smtpTls,
        })

        await fastify.prisma.adminEvent.create({
          data: {
            actorUserId: user.id,
            action: 'email_settings_update',
            target: 'email',
            note: JSON.stringify({
              fromEmail,
              fromName,
              smtpHost,
              smtpPort,
              smtpUser,
              smtpTls,
              passwordChanged: Boolean(smtpPass),
              reason: reason || null,
            }),
          },
        })

        return reply.send({ success: true })
      } catch {
        return reply.code(500).send({ error: 'Ошибка сохранения настроек почты' })
      }
    },
  })

  fastify.post('/api/admin/email/test', {
    schema: {
      body: {
        type: 'object',
        properties: {
          to: { type: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const now = Date.now()
      const lastSentAt = emailTestRateLimit.get(user.id) || 0
      if (now - lastSentAt < 30000) {
        return reply.code(429).send({ error: 'Слишком часто. Повторите через 30 секунд.' })
      }
      emailTestRateLimit.set(user.id, now)

      const settings = await fastify.admin.getEmailSettings(user)
      const to = req.body?.to || settings?.fromEmail

      try {
        await sendTestEmail(to)

        await fastify.prisma.adminEvent.create({
          data: {
            actorUserId: user.id,
            action: 'email_test_sent',
            target: to,
          },
        })

        return reply.send({ success: true })
      } catch (err) {
        return reply.code(500).send({ error: err.message || 'Ошибка отправки тестового письма' })
      }
    },
  })

  fastify.put('/api/admin/user/:id/wages', {
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
        required: ['score', 'groupScore'],
        properties: {
          score: { type: 'integer', minimum: 0 },
          groupScore: { type: 'integer', minimum: 0 },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { id: userId } = req.params
      const { score, groupScore } = req.body

      try {
        const targetUser = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, companyId: true, role: true, isLocked: true },
        })

        if (!targetUser) {
          return reply.code(404).send({ error: 'Пользователь не найден' })
        }

        if (targetUser.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        if (targetUser.role !== UserRole.Consultant) {
          return reply.code(400).send({ error: 'Устанавливать единицы можно только консультантам' })
        }

        const result = await fastify.admin.setScores(targetUser, { score, groupScore })

        if (result.error) {
          return reply.code(400).send({ error: result.error })
        }

        return reply.send({ success: true, score, groupScore })
      } catch {
        return reply.code(500).send({ error: 'Ошибка обновления пользователя' })
      }
    },
  })

  fastify.post('/api/admin/user/:id/wages', {
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
        required: ['amount', 'description'],
        properties: {
          amount: { type: 'number', minimum: 0 },
          description: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { id: userId } = req.params
      const { amount, description } = req.body

      try {
        const targetUser = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, companyId: true, role: true },
        })

        if (!targetUser) {
          return reply.code(404).send({ error: 'Пользователь не найден' })
        }

        if (targetUser.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        if (targetUser.role !== UserRole.Consultant) {
          return reply.code(400).send({ error: 'Начислять можно только консультантам' })
        }

        const wage = await fastify.prisma.wage.create({
          data: {
            companyId: user.company.id,
            userId: targetUser.id,
            amount,
            description,
            score: 0,
            groupScore: 0,
          },
        })

        if (!targetUser.isLocked) {
          await fastify.prisma.user.update({
            where: { id: targetUser.id },
            data: { isLocked: true },
          })
        }

        return reply.send({ success: true, wage })
      } catch {
        return reply.code(500).send({ error: 'Ошибка создания начисления' })
      }
    },
  })

  fastify.get('/api/admin/user/:id/wages', {
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
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { id: userId } = req.params
      const limit = CLIENT_WAGES_LIMIT

      try {
        const targetUser = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, companyId: true },
        })

        if (!targetUser) {
          return reply.code(404).send({ error: 'Пользователь не найден' })
        }

        if (targetUser.companyId !== user.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        const wages = await fastify.prisma.wage.findMany({
          where: { userId: userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            amount: true,
            description: true,
            createdAt: true,
          },
        })

        return reply.send({
          wages: wages.map((w) => ({ ...w, amount: Number(w.amount) })),
        })
      } catch {
        return reply.code(500).send({ error: 'Ошибка получения начислений' })
      }
    },
  })

  fastify.delete('/api/admin/user/:id', {
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
      const admin = await fastify.auth.getUser(req)
      if (!admin || admin.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { id: userId } = req.params

      try {
        const target = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, companyId: true, role: true },
        })

        if (!target) {
          return reply.code(404).send({ error: 'Пользователь не найден' })
        }

        if (target.companyId !== admin.company.id) {
          return reply.code(403).send({ error: 'Доступ запрещен' })
        }

        if (target.role !== UserRole.Candidate) {
          return reply.code(400).send({ error: 'Пользователя можно удалить только в статусе кандидата' })
        }

        // Delete the candidate's interactions (they are only ever a target) and the
        // candidate itself atomically, so no orphaned or FK-blocked records remain.
        await fastify.prisma.$transaction([
          fastify.prisma.interaction.deleteMany({ where: { targetId: userId } }),
          fastify.prisma.user.delete({ where: { id: userId } }),
        ])

        return reply.send({ success: true })
      } catch (err) {
        return reply.code(500).send({ error: `Ошибка удаления пользователя: ${err.message}` })
      }
    },
  })
}
