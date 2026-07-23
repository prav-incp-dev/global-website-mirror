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
    const token = jwt.sign({ owner: owner, inviteCode: crypto.randomUUID() }, process.env.SESSION_SECRET, { expiresIn: '24h' })

    return { token }
  })

  fastify.get('/api/invitation/check/:inviteCode', async (req, reply) => {
    const { inviteCode } = req.params

    if (!inviteCode) {
      return reply.code(400).send({ error: 'Некорректный код приглашения' })
    }

    const usedInvite = await fastify.prisma.usedInvite.findUnique({
      where: { code: inviteCode },
    })

    if (usedInvite) {
      return reply.code(409).send({ error: 'Приглашение уже использовано' })
    }

    return { success: true }
  })
})
