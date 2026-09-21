import { OrderStatus, PaymentStatus, UserRole } from '../generated/prisma/client'
import { serializePayment } from '../lib/payment'
import { PAGE_LIMIT, MIN_LEVEL, MAX_LEVEL } from '../lib/constants.js'
import { uniqConstraintLabel } from '../lib/prismaHelpers.js'

export default async (fastify) => {
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

  fastify.get('/api/admin/payments', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: PAGE_LIMIT },
          query: { type: 'string' },
          toRefundOnly: { type: 'boolean', default: false },
          sortBy: { type: 'string', enum: ['id', 'amount', 'status'], default: 'id' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { page = 1, limit = PAGE_LIMIT, query = '', toRefundOnly = false, sortBy = 'id' } = req.query
      const [result, toRefundCount] = await Promise.all([
        fastify.admin.getPayments(user, page, limit, query, toRefundOnly, sortBy),
        fastify.admin.getToRefundCount(user, query),
      ])
      return reply.send({ ...result, toRefundCount })
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

        if (payment.status !== PaymentStatus.Failed) {
          return reply.code(409).send({ error: 'Зачесть можно только платеж со статусом «Ошибка»' })
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
        required: ['splits'],
        properties: {
          splits: {
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
              },
            },
            minItems: 1,
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

        const { splits } = req.body
        const company = payment.company

        // Create wages from split items (array of { wallet, amount, userId?, score?, groupScore? })
        const wagesData = splits.map((item) =>
          fastify.prisma.wage.create({
            data: {
              companyId: company.id,
              paymentId: payment.id,
              fromWallet: company.wallet,
              toWallet: item.wallet,
              amount: item.amount,
              score: item.score ?? 0,
              groupScore: item.groupScore ?? 0,
              userId: item.userId ?? null,
              description: 'Начисление по распределению платежа',
            },
          }),
        )

        // Create all wages and update payment status in a transaction
        await fastify.prisma.$transaction([
          ...wagesData,
          fastify.prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.Splitted },
          }),
        ])

        return reply.send({ success: true, wagesCount: wagesData.length })
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
          select: { id: true, companyId: true, role: true, level: true },
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
          await fastify.prisma.levelHistory.create({
            data: {
              oldLevel: targetUser.level,
              newLevel: level,
              userId,
            },
          })
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
        const setting = await fastify.prisma.setting.upsert({
          where: { companyId: user.company.id },
          update: { [type]: data },
          create: {
            companyId: user.company.id,
            general: type === 'general' ? data : {},
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
          select: { id: true, companyId: true, role: true },
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

        return reply.send({ success: true, wage })
      } catch {
        return reply.code(500).send({ error: 'Ошибка создания начисления' })
      }
    },
  })
}
