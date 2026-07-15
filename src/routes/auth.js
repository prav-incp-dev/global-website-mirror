import fp from 'fastify-plugin'

export default fp(async (fastify) => {
  fastify.post('/api/login', {
    preHandler: fastify.csrfProtection,
    handler: async (req, reply) => {
      const { email, password } = req.body || {}

      if (!email || !password) {
        return reply
          .code(400)
          .send({ error: 'Email and password are required' })
      }

      const user = await fastify.auth.login(email, password)

      if (!user) {
        return reply.code(401).send({ error: 'Invalid email or password' })
      }

      fastify.auth.setSession(reply, user.id)

      return reply.send({
        success: true,
        redirect: '/',
      })
    },
  })

  fastify.post('/api/logout', {
    preHandler: fastify.csrfProtection,
    handler: async (req, reply) => {
      fastify.auth.clearSession(reply)
      return reply.send({ success: true, redirect: '/login' })
    },
  })
})
