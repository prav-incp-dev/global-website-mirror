import fp from 'fastify-plugin'
import bcrypt from 'bcryptjs'

export default fp(async (fastify) => {
  fastify.decorate('registration', {
    createUser: async ({ email, nick, fullName, phone, memberId, password }) => {
      const company = await fastify.db.company.findFirst({
        orderBy: { id: 'asc' },
      })

      if (!company) {
        throw new Error('No company found')
      }

      const passwordHash = await bcrypt.hash(password, 12)

      const user = await fastify.db.user.create({
        data: {
          email,
          password: passwordHash,
          role: 'Candidate',
          nick,
          fullName,
          phone,
          memberId,
          companyId: company.id,
        },
        include: { company: true },
      })

      const { password: _pw, ...safeUser } = user
      return safeUser
    },
  })
})
