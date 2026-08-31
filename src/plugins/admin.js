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
          orphant: true,
          ...(query
            ? {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      })
    },

    getClients: async (user, page = 1, limit = CLIENTS_PAGE_LIMIT, query = '', orphansOnly = false, sortBy = 'id') => {
      const skip = (page - 1) * limit

      const where = {
        role: { not: 'Admin' },
        companyId: user.company.id,
        ...(orphansOnly ? { orphant: true } : {}),
        ...(query
          ? {
              OR: [
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      }

      const orderByMap = {
        name: [{ firstName: 'asc' }, { lastName: 'asc' }],
        level: { level: 'desc' },
        role: { role: 'asc' },
        score: { score: 'desc' },
        id: { id: 'desc' },
      }
      const orderBy = orderByMap[sortBy] ?? orderByMap.id

      const [users, total] = await Promise.all([
        fastify.prisma.user.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            level: true,
            levelConfirmed: true,
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
          orderBy,
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
