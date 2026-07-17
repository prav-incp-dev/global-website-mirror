import fp from 'fastify-plugin'
import { sendTwoFactorCode } from '../services/emailService.js'

export default fp(async (fastify) => {
  fastify.post('/api/auth/login', {
    handler: async (req, reply) => {
      const { email, password } = req.body || {}

      if (!email || !password)
        return reply
          .code(400)
          .send({ error: 'Email and password are required' })

      const user = await fastify.auth.login(email, password)

      if (!user)
        return reply.code(401).send({ error: 'Invalid email or password' })

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
    handler: async (req, reply) => {
      const { token, code } = req.body || {}

      if (!token || !code)
        return reply.code(400).send({ error: 'Token and code are required' })

      const userId = fastify.auth.verifyPendingAuth(token)
      if (!userId)
        return reply.code(401).send({ error: 'Invalid or expired token' })

      const valid = await fastify.auth.verifyTwoFactorCode(userId, code)
      if (!valid)
        return reply.code(401).send({ error: 'Invalid confirmation code' })

      fastify.auth.setSession(reply, userId)

      return reply.send({
        success: true,
        redirect: '/',
      })
    },
  })

  fastify.post('/api/auth/resend', {
    handler: async (req, reply) => {
      const { token } = req.body || {}

      if (!token) return reply.code(400).send({ error: 'Token is required' })

      const userId = fastify.auth.verifyPendingAuth(token)
      if (!userId)
        return reply.code(401).send({ error: 'Invalid or expired token' })

      const user = await fastify.db.user.findUnique({
        where: { id: userId },
      })

      if (!user)
        return reply.code(401).send({ error: 'Invalid or expired token' })

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
