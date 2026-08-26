import fp from 'fastify-plugin'

export const CLIENTS_PAGE_LIMIT = 20

export default fp(async (fastify) => {
  fastify.decorate('admin', {
    getCompany: async (user) => {
      if (!user?.company?.id) return null

      return fastify.prisma.company.findUnique({
        where: { id: user.company.id },
      })
    },

    getOrphansCount: async (user, query = '') => {
      return fastify.prisma.user.count({
        where: {
          role: { not: 'Admin' },
          companyId: user.company.id,
          parentId: null,
          ...(query
            ? {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      })
    },

    getClients: async (user, page = 1, limit = CLIENTS_PAGE_LIMIT, query = '', orphansOnly = false) => {
      const skip = (page - 1) * limit

      const where = {
        role: { not: 'Admin' },
        companyId: user.company.id,
        ...(orphansOnly ? { parentId: null } : {}),
        ...(query
          ? {
              OR: [
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      }

      const [users, total] = await Promise.all([
        fastify.prisma.user.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            level: true,
            role: true,
            email: true,
            phone: true,
            memberId: true,
            nick: true,
            score: true,
            groupScore: true,
            parentId: true,
            parent: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { id: 'desc' },
        }),
        fastify.prisma.user.count({ where }),
      ])

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    },
  })
})
