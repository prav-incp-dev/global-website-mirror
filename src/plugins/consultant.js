import fp from 'fastify-plugin'

export default fp(async (server) => {
  server.decorate('consultant', {
    getStats: async (user) => {
      const children = await server.prisma.user.findMany({
        where: { parentId: user.id },
        select: { id: true, firstName: true, lastName: true, nick: true, level: true },
      })
      let parentUser = null
      if (user.parentId) {
        parentUser = await server.prisma.user.findUnique({
          where: { id: user.parentId },
          select: { id: true, firstName: true, lastName: true, nick: true, level: true },
        })
      }
      return { children, parent: parentUser }
    },
  })
})
