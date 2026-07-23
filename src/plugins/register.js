import fp from 'fastify-plugin'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { UserRole } from '../generated/prisma/client'

export default fp(async (fastify) => {
  fastify.decorate('registration', {
    verifyToken: async (token) => {
      const { inviteCode, owner } = jwt.verify(token, process.env.SESSION_SECRET) || {}
      if (!inviteCode) throw new Error('Invalid token')

      const usedInvite = await fastify.prisma.usedInvite.findUnique({ where: { code: inviteCode } })
      if (usedInvite) throw new Error('Invite already used')

      return { inviteCode, owner }
    },

    createUser: async ({ email, nick, fullName, phone, memberId, password, parentId = null, inviteCode }) => {
      const company = await fastify.prisma.company.findFirst({
        orderBy: { id: 'asc' },
      })

      if (!company) {
        throw new Error('No company found')
      }

      const passwordHash = await bcrypt.hash(password, 12)

      const user = await fastify.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            password: passwordHash,
            role: UserRole.Candidate,
            nick,
            fullName,
            phone,
            memberId,
            parentId,
            companyId: company.id,
          },
          include: { company: true },
        })

        await tx.usedInvite.create({
          data: { code: inviteCode },
        })

        return newUser
      })

      const { password: _pw, ...safeUser } = user
      return safeUser
    },
  })
})
