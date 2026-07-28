import { UserRole } from '../generated/prisma/client'

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
      } catch (err) {
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
}
