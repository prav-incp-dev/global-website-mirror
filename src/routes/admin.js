import { UserRole } from '../generated/prisma/client'
import { CLIENTS_PAGE_LIMIT } from '../plugins/admin.js'

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
          primaryWallet: {
            anyOf: [
              { type: 'string', format: 'wallet' },
              { type: 'string', maxLength: 0 },
            ],
          },
          secondaryWallet: {
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

      const { name, primaryWallet, secondaryWallet } = req.body

      try {
        const company = await fastify.prisma.company.update({
          where: { id: user.company.id },
          data: {
            name,
            primaryWallet: primaryWallet || null,
            secondaryWallet: secondaryWallet || null,
          },
        })

        return reply.send({
          success: true,
          company: {
            id: company.id,
            name: company.name,
            primaryWallet: company.primaryWallet,
            secondaryWallet: company.secondaryWallet,
          },
        })
      } catch (err) {
        if (err.code === 'P2002') {
          return reply.code(409).send({ error: 'Компания с таким названием уже существует' })
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
          limit: { type: 'integer', minimum: 1, maximum: 100, default: CLIENTS_PAGE_LIMIT },
          query: { type: 'string' },
          orphansOnly: { type: 'boolean', default: false },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { page = 1, limit = CLIENTS_PAGE_LIMIT, query = '', orphansOnly = false } = req.query
      const [result, orphansCount] = await Promise.all([
        fastify.admin.getClients(user, page, limit, query, orphansOnly),
        fastify.admin.getOrphansCount(user, query),
      ])
      return reply.send({ ...result, orphansCount })
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

  fastify.put('/api/admin/user/parent', {
    schema: {
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'integer', minimum: 1 },
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

      const { userId, parentId } = req.body

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
          data: { parentId: parentId ?? null },
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
}
