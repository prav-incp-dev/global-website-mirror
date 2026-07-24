import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { UserRole } from '../generated/prisma/client'

export default async (fastify) => {
  fastify.post('/api/invitation/generate', async (req, reply) => {
    const user = await fastify.auth.getUser(req)
    if (!user) {
      return reply.code(401).send({ error: 'Доступно только авторизованным пользователям' })
    }

    const owner = user.role === UserRole.Admin ? null : user.id
    const token = jwt.sign({ owner: owner, inviteCode: crypto.randomUUID() }, process.env.SESSION_SECRET, {
      expiresIn: '24h',
    })

    return { token }
  })
}
