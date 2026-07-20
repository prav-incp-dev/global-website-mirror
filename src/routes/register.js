import fp from 'fastify-plugin'

export default fp(async (fastify) => {
  fastify.post('/api/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'nick', 'password', 'fullName', 'phone', 'memberId'],
        properties: {
          email: { type: 'string', format: 'email' },
          nick: { type: 'string' },
          fullName: { type: 'string' },
          phone: { type: 'string', pattern: '^\\+?[1-9]\\d{1,14}$' },
          memberId: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      const { email, nick, fullName, phone, memberId, password } = req.body

      try {
        const user = await fastify.createUser({
          email,
          nick,
          fullName,
          phone,
          memberId,
          password,
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
          }
          const errorMessage = String(err.message || '').toLowerCase()
          const foundKey = Object.keys(uniqFields).find(key => errorMessage.includes(key.toLowerCase()))
          const fieldName = uniqFields[foundKey] || foundKey
          return reply.code(409).send({ error: `${fieldName} уже есть в системе` })
        }

        return reply.code(500).send({ error: err.message || 'Ошибка регистрации' })
      }
    },
  })
})
