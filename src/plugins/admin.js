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

    setScores: async (user, { score, groupScore }) => {
      const nonZeroWage = await fastify.prisma.wage.findFirst({
        where: { userId: user.id, amount: { not: 0 } },
        select: { id: true },
      })

      if (nonZeroWage) {
        return { error: 'У пользователя уже есть продажи' }
      }

      const firstWage = await fastify.prisma.wage.findFirst({
        where: { userId: user.id },
        orderBy: { id: 'asc' },
        select: { id: true },
      })

      if (firstWage) {
        await fastify.prisma.wage.update({
          where: { id: firstWage.id },
          data: { score, groupScore },
        })
      } else {
        await fastify.prisma.wage.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            score,
            groupScore,
            amount: 0,
          },
        })
      }

      return { success: true }
    },

    getClients: async (user, page = 1, limit = CLIENTS_PAGE_LIMIT, query = '', orphansOnly = false, sortBy = 'id') => {
      const skip = (page - 1) * limit

      const orderByMap = {
        name: `u."firstName" ASC, u."lastName" ASC`,
        level: `u."level" DESC`,
        role: `u."role" ASC`,
        score: `"score" DESC, u."id" DESC`,
        id: `u."id" DESC`,
      }
      const orderBy = orderByMap[sortBy] ?? orderByMap.id

      const baseParams = [user.company.id]
      const whereParts = [`u."role" <> 'Admin'`, `u."companyId" = $1`]
      if (orphansOnly) whereParts.push(`u."orphant" = true`)
      if (query) {
        const likeStart = baseParams.length
        baseParams.push(`%${query}%`, `%${query}%`, `%${query}%`)
        whereParts.push(
          `(u."firstName" ILIKE $${likeStart + 1} OR u."lastName" ILIKE $${likeStart + 2} OR u."email" ILIKE $${likeStart + 3})`,
        )
      }
      const whereSql = whereParts.join(' AND ')

      const selectSql = `
        SELECT
          u."id", u."firstName", u."lastName", u."level", u."levelConfirmed", u."role",
          u."email", u."phone", u."memberId", u."nick", u."parentId",
          COALESCE(SUM(w."score"), 0)::int AS "score",
          COALESCE(SUM(w."groupScore"), 0)::int AS "groupScore",
          p."firstName" AS "parentFirstName",
          p."lastName" AS "parentLastName"
        FROM "User" u
        LEFT JOIN "Wage" w ON w."userId" = u."id"
        LEFT JOIN "User" p ON p."id" = u."parentId"
        WHERE ${whereSql}
        GROUP BY u."id", p."id"
        ORDER BY ${orderBy}
        LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}
      `

      const selectParams = [...baseParams, limit, skip]

      const [rows, totalRows] = await Promise.all([
        fastify.prisma.$queryRawUnsafe(selectSql, ...selectParams),
        fastify.prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS "total" FROM "User" u WHERE ${whereSql}`,
          ...baseParams,
        ),
      ])

      const total = totalRows[0]?.total ?? 0

      const users = rows.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        level: row.level,
        levelConfirmed: row.levelConfirmed,
        role: row.role,
        email: row.email,
        phone: row.phone,
        memberId: row.memberId,
        nick: row.nick,
        parentId: row.parentId,
        score: row.score,
        groupScore: row.groupScore,
        parent: row.parentId != null ? { firstName: row.parentFirstName, lastName: row.parentLastName } : null,
      }))

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
