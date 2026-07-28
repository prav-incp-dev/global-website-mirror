export default async (fastify) => {
  fastify.post('/api/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'nick', 'password', 'firstName', 'lastName', 'phone', 'memberId', 'token'],
        properties: {
          email: { type: 'string', format: 'email' },
          nick: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string', format: 'phone' },
          memberId: { type: 'string' },
          password: { type: 'string' },
          token: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      const { email, nick, firstName, lastName, phone, memberId, password, token } = req.body

      try {
        const { inviteCode, owner } = await fastify.registration.verifyToken(token)

        const user = await fastify.registration.createUser({
          email,
          nick,
          firstName,
          lastName,
          phone,
          memberId,
          password,
          parentId: owner,
          inviteCode,
        })

        if (user) {
          return reply.send({ success: true, message: 'Регистрация прошла успешно' })
        } else {
          return reply.code(500).send({ error: 'Ошибка регистрации' })
        }
      } catch (err) {
        if (err.code === 'P2002') {
          const uniqFields = {
            email: 'Электронная почта',
            nick: 'Ник в Телеграм',
            memberId: 'Номер пайщика',
            phone: 'Номер телефона',
            code: 'Приглашенный',
          }

          const errorMessage = String(err.message || '')
          const fieldMatch = errorMessage.match(/\(`([^`]+)`\)/)
          const rawField = fieldMatch ? fieldMatch[1] : null
          const fieldLabel = (rawField && uniqFields[rawField]) || rawField || 'Поле'

          return reply.code(409).send({ error: `${fieldLabel} уже есть в системе` })
        }

        return reply.code(500).send({ error: err.message || 'Ошибка регистрации' })
      }
    },
  })
}
