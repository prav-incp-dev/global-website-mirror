import fp from 'fastify-plugin'
import bcrypt from 'bcryptjs'

export default fp(async (fastify) => {
  fastify.decorate('registration', {
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
            role: 'Candidate',
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
