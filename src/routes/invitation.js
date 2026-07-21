import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

export default fp(async (fastify) => {
  fastify.post('/api/invitation/generate', async (req, reply) => {
    const user = await fastify.auth.getUser(req)
    if (!user) {
      return reply.code(401).send({ error: 'Доступно только авторизованным пользователям' })
    }

    const owner = user.role === 'Admin' ? null : user.id
    const token = jwt.sign({ owner: owner, jti: crypto.randomUUID() }, process.env.SESSION_SECRET, { expiresIn: '24h' })

    return { token }
  })
})
