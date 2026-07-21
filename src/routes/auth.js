import fp from 'fastify-plugin'
import { sendTwoFactorCode } from '../services/emailService.js'

export default fp(async (fastify) => {
  fastify.post('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      const { email, password } = req.body

      const user = await fastify.auth.login(email, password)

      if (!user) return reply.code(401).send({ error: 'Неверный адрес или пароль' })

      // Generate 2FA code, store in DB, and send via email
      const code = await fastify.auth.createTwoFactorCode(user)
      await sendTwoFactorCode(user, code)

      // Sign a JWT with the userId (10-minute expiry)
      const token = fastify.auth.signPendingAuth(user.id)

      return reply.send({
        success: true,
        token,
      })
    },
  })

  fastify.post('/api/auth/confirm', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'code'],
        properties: {
          token: { type: 'string' },
          code: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      const { token, code } = req.body

      const userId = fastify.auth.verifyPendingAuth(token)
      if (!userId) return reply.code(401).send({ error: 'Неверный код или время истекло' })

      const valid = await fastify.auth.verifyTwoFactorCode(userId, code)
      if (!valid) return reply.code(401).send({ error: 'Неверный код или время истекло' })

      fastify.auth.setSession(reply, userId)

      return reply.send({
        success: true,
        redirect: '/',
      })
    },
  })

  fastify.post('/api/auth/resend', {
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      const { token } = req.body

      const userId = fastify.auth.verifyPendingAuth(token)
      if (!userId) return reply.code(401).send({ error: 'Неверный код или время истекло' })

      const user = await fastify.db.user.findUnique({
        where: { id: userId },
      })

      if (!user) return reply.code(401).send({ error: 'Неверный код или время истекло' })

      // Generate a new 2FA code and send via email
      const code = await fastify.auth.createTwoFactorCode(user)
      await sendTwoFactorCode(user, code)

      return reply.send({ success: true })
    },
  })

  fastify.post('/api/auth/logout', {
    handler: async (req, reply) => {
      fastify.auth.clearSession(reply)
      return reply.send({ success: true, redirect: '/auth' })
    },
  })
})
