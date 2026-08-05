import { UserRole } from '../generated/prisma/client'

export default async (fastify) => {
  fastify.get('/api/user/balance', {
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role === UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      if (!user.wallet) {
        return reply.code(400).send({ error: 'Кошелек не указан' })
      }

      try {
        const balance = await fastify.user.getBalance(user.wallet)
        return reply.send({ success: true, balance })
      } catch {
        return reply.code(502).send({ error: 'Не удалось получить баланс' })
      }
    },
  })

  fastify.put('/api/user/profile', {
    schema: {
      body: {
        type: 'object',
        required: ['firstName', 'lastName', 'phone', 'memberId'],
        properties: {
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
          phone: { type: 'string', format: 'phone' },
          memberId: { type: 'string', format: 'member' },
          nick: { type: 'string' },
          wallet: {
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
      if (!user || user.role === UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { firstName, lastName, phone, memberId, nick, wallet } = req.body

      try {
        const updatedUser = await fastify.prisma.user.update({
          where: { id: user.id },
          data: {
            firstName,
            lastName,
            phone,
            memberId,
            nick: nick || null,
            wallet: wallet || null,
          },
        })

        return reply.send({
          success: true,
          profile: {
            id: updatedUser.id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            phone: updatedUser.phone,
            memberId: updatedUser.memberId,
            nick: updatedUser.nick,
            wallet: updatedUser.wallet,
          },
        })
      } catch (err) {
        if (err.code === 'P2002') {
          const uniqFields = {
            memberId: 'Номер пайщика',
            nick: 'Ник',
            wallet: 'Кошелек',
          }

          const errorMessage = String(err.message || '')
          const fieldMatch = errorMessage.match(/\(`([^`]+)`\)/)
          const rawField = fieldMatch ? fieldMatch[1] : null
          const fieldLabel = (rawField && uniqFields[rawField]) || rawField || 'Поле'

          return reply.code(409).send({ error: `${fieldLabel} уже есть в системе` })
        }

        return reply.code(500).send({ error: 'Ошибка обновления профиля' })
      }
    },
  })
}
