import fp from 'fastify-plugin'

export default fp(async (fastify) => {
  fastify.decorate('admin', {
    getCompany: async (user) => {
      if (!user?.company?.id) return null

      return fastify.prisma.company.findUnique({
        where: { id: user.company.id },
      })
    },
  })
})
