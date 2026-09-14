import { sendRegistrationConfirmation } from '../services/emailService.js'
import { uniqConstraintLabel } from '../lib/prismaHelpers.js'

export default async (fastify) => {
  fastify.post('/api/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'phone', 'token'],
        properties: {
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          phone: { type: 'string', format: 'phone' },
          password: { type: 'string' },
          token: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      const { email, firstName, phone, password, token } = req.body

      try {
        const { inviteCode, owner } = await fastify.registration.verifyToken(token)

        const user = await fastify.registration.createUser({
          email,
          firstName,
          phone,
          password,
          parentId: owner,
          inviteCode,
        })

        if (user) {
          await sendRegistrationConfirmation(user)
          return reply.send({ success: true, message: 'Регистрация прошла успешно' })
        } else {
          return reply.code(500).send({ error: 'Ошибка регистрации' })
        }
      } catch (err) {
        if (err.code === 'P2002') {
          const uniqFields = {
            email: 'Электронная почта',
            phone: 'Номер телефона',
            code: 'Приглашенный',
          }

          return reply.code(409).send({ error: `${uniqConstraintLabel(err.message, uniqFields)} уже есть в системе` })
        }

        return reply.code(500).send({ error: err.message || 'Ошибка регистрации' })
      }
    },
  })
}
