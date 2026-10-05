import fp from 'fastify-plugin'
import { PaymentStatus } from '../generated/prisma/client'
import { userName } from '../../src/lib/user'
import { PAGE_LIMIT, MIN_LEVEL, MAX_LEVEL } from '../lib/constants.js'

export default fp(async (fastify) => {
  fastify.decorate('admin', {
    getCompany: async (user) => {
      if (!user?.company?.id) return null

      return fastify.prisma.company.findUnique({
        where: { id: user.company.id },
      })
    },

    getSetting: async (user) => {
      if (!user?.company?.id) return null

      return fastify.prisma.setting.findUnique({
        where: { companyId: user.company.id },
      })
    },

    getOrphansCount: async (user, query = '', fromLevel = MIN_LEVEL, toLevel = MAX_LEVEL) => {
      return fastify.prisma.user.count({
        where: {
          role: { not: 'Admin' },
          companyId: user.company.id,
          orphant: true,
          level: { gte: fromLevel, lte: toLevel },
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

    getToRefundCount: async (user, query = '') => {
      return fastify.prisma.payment.count({
        where: {
          companyId: user.company.id,
          status: PaymentStatus.ToRefund,
          ...(query
            ? {
                OR: [
                  { txHash: { contains: query, mode: 'insensitive' } },
                  { uid: { contains: query, mode: 'insensitive' } },
                  { user: { firstName: { contains: query, mode: 'insensitive' } } },
                  { user: { lastName: { contains: query, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
      })
    },

    setScores: async (user, { score, groupScore }) => {
      if (user.isLocked) {
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

    getClients: async (
      user,
      page = 1,
      limit = PAGE_LIMIT,
      query = '',
      orphansOnly = false,
      sortBy = 'id',
      fromLevel = MIN_LEVEL,
      toLevel = MAX_LEVEL,
    ) => {
      const skip = (page - 1) * limit

      const orderByMap = {
        name: `u."firstName" ASC, u."lastName" ASC`,
        level: `u."level" DESC`,
        role: `u."role" ASC`,
        score: `"score" DESC, u."id" DESC`,
        id: `u."id" DESC`,
      }
      const orderBy = orderByMap[sortBy] ?? orderByMap.id

      const baseParams = [user.company.id, fromLevel, toLevel]
      const whereParts = [`u."role" <> 'Admin'`, `u."companyId" = $1`, `u."level" >= $2`, `u."level" <= $3`]
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
          u."email", u."phone", u."memberId", u."nick", u."parentId", u."wallet", u."isLocked",
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
        wallet: row.wallet,
        score: row.score,
        groupScore: row.groupScore,
        isLocked: row.isLocked,
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

    getPayments: async (user, page = 1, limit = PAGE_LIMIT, query = '', toRefundOnly = false, sortBy = 'id') => {
      const skip = (page - 1) * limit

      const orderByMap = {
        amount: [{ amount: 'asc' }, { id: 'desc' }],
        status: [{ status: 'asc' }, { id: 'desc' }],
        id: [{ id: 'desc' }],
      }
      const orderBy = orderByMap[sortBy] ?? orderByMap.id

      const where = {
        companyId: user.company.id,
        status: toRefundOnly ? PaymentStatus.ToRefund : { not: PaymentStatus.Canceled },
        ...(query
          ? {
              OR: [
                { txHash: { contains: query, mode: 'insensitive' } },
                { uid: { contains: query, mode: 'insensitive' } },
                { user: { firstName: { contains: query, mode: 'insensitive' } } },
                { user: { lastName: { contains: query, mode: 'insensitive' } } },
              ],
            }
          : {}),
      }

      const [rows, total] = await Promise.all([
        fastify.prisma.payment.findMany({
          where,
          select: {
            id: true,
            amount: true,
            status: true,
            txHash: true,
            uid: true,
            fromWallet: true,
            finalized: true,
            createdAt: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        fastify.prisma.payment.count({ where }),
      ])

      const payments = rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        status: row.status,
        txHash: row.txHash,
        uid: row.uid,
        fromWallet: row.fromWallet,
        finalized: row.finalized,
        createdAt: row.createdAt,
        userName: userName(row.user),
      }))

      return {
        payments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    },

    getAncestors: async (user) => {
      const ancestors = await fastify.prisma.$queryRaw`
        WITH RECURSIVE user_hierarchy AS (
          SELECT *
          FROM "User"
          WHERE "id" = ${user.id}

          UNION ALL

          SELECT u.*
          FROM "User" u
          INNER JOIN user_hierarchy uh ON u."id" = uh."parentId"
        )
        SELECT *
        FROM user_hierarchy
        WHERE "id" != ${user.id}
      `

      return ancestors
    },

    personalLevelWages: async (user) => {
      // Total personal level score — sum of scores since reaching current level
      const resultAgg = await fastify.prisma.wage.aggregate({
        where: {
          userId: user.id,
          onLevel: user.level,
        },
        _sum: { score: true },
      })
      return resultAgg._sum.score ?? 0
    },

    generalWages: async (user) => {
      // Total general score — sum of all scores + group scores ever
      const resultAgg = await fastify.prisma.wage.aggregate({
        where: { userId: user.id },
        _sum: { score: true, groupScore: true },
      })
      return (resultAgg._sum.score ?? 0) + (resultAgg._sum.groupScore ?? 0)
    },

    exportClients: async (
      user,
      fromDate,
      toDate,
      query = '',
      orphansOnly = false,
      sortBy = 'id',
      fromLevel = MIN_LEVEL,
      toLevel = MAX_LEVEL,
    ) => {
      const baseParams = [user.company.id, fromLevel, toLevel, fromDate, toDate]
      const whereParts = [`u."role" <> 'Admin'`, `u."companyId" = $1`, `u."level" >= $2`, `u."level" <= $3`]
      if (orphansOnly) whereParts.push(`u."orphant" = true`)
      if (query) {
        const likeStart = baseParams.length + 1
        baseParams.push(`%${query}%`, `%${query}%`, `%${query}%`)
        whereParts.push(
          `(u."firstName" ILIKE $${likeStart} OR u."lastName" ILIKE $${likeStart + 1} OR u."email" ILIKE $${likeStart + 2})`,
        )
      }
      const whereSql = whereParts.join(' AND ')

      const orderByMap = {
        name: `u."firstName" ASC, u."lastName" ASC`,
        level: `u."level" DESC`,
        role: `u."role" ASC`,
        score: `"wageScore" DESC, u."id" DESC`,
        id: `u."id" DESC`,
      }
      const orderBy = orderByMap[sortBy] ?? orderByMap.id

      const sql = `
        SELECT
          u."id", u."firstName", u."lastName", u."level", u."email", u."memberId",
          MAX(lh."createdAt") AS "levelDate",
          COALESCE(SUM(w."score"), 0)::int AS "wageScore",
          COALESCE(SUM(w."groupScore"), 0)::int AS "wageGroupScore"
        FROM "User" u
        LEFT JOIN "LevelHistory" lh
          ON lh."userId" = u."id" AND lh."newLevel" = u."level"
        LEFT JOIN "Wage" w
          ON w."userId" = u."id"
          AND w."createdAt" >= $4::date
          AND w."createdAt" < ($5::date + INTERVAL '1 day')
        WHERE ${whereSql}
        GROUP BY u."id"
        ORDER BY ${orderBy}
      `

      const rows = await fastify.prisma.$queryRawUnsafe(sql, ...baseParams)

      return rows.map((row) => ({
        name: `${row.firstName} ${row.lastName || ''}`.trim(),
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        memberId: row.memberId || '',
        level: row.level,
        levelDate: row.levelDate ? new Date(row.levelDate).toLocaleDateString('ru-RU') : '',
        wageScore: row.wageScore,
        wageGroupScore: row.wageGroupScore,
      }))
    },

    calculateSplit: async (payment) => {
      const { user, company, order } = payment

      const setting = await fastify.prisma.setting.findUnique({
        where: { companyId: company.id },
      })
      const levels = setting.levels ?? {}

      const amount = Number(payment.amount)
      const unitAmount = order.quantity > 0 ? payment.amount / order.quantity : payment.amount

      let distributedAmount = 0
      const result = []
      const promotions = []

      const splitToCompany = (wallet, value) => {
        const rounded = Number(value.toFixed(2))
        result.push({ wallet: wallet, amount: rounded })
        return rounded
      }

      const splitToUser = (user, value, level, owner) => {
        if (!user.wallet) return 0
        const rounded = Number(value.toFixed(2))
        result.push({
          wallet: user.wallet,
          amount: rounded,
          userId: user.id,
          onLevel: level,
          score: owner ? 1 : 0,
          groupScore: owner ? 0 : 1,
        })
        return rounded
      }

      const groupResult = () => {
        return Object.values(
          result.reduce((acc, wage) => {
            const key = `${wage.wallet}-${wage.onLevel ?? 0}`

            if (!acc[key]) acc[key] = { ...wage }
            else {
              acc[key].amount += wage.amount
              if (wage.score !== undefined) acc[key].score += wage.score
              if (wage.groupScore !== undefined) acc[key].groupScore += wage.groupScore
            }

            return acc
          }, {}),
        )
      }

      distributedAmount += splitToCompany(company.serviceWallet, amount / 100)
      const ancestors = await fastify.admin.getAncestors(user)

      const wages = {}

      for (let i = 1; i <= order.quantity; i++) {
        let prevPercent = 0
        let currentUser = user
        while (currentUser.parentId) {
          const parent = ancestors.find((user) => user.id == currentUser.parentId)
          const owner = parent.id == user.parentId

          if (i === 1) {
            wages[parent.id] = {
              personal: await fastify.admin.personalLevelWages(parent),
              general: await fastify.admin.generalWages(parent),
              level: parent.level,
            }
          }
          const level = wages[parent.id].level
          const levelPercent = Number(levels?.[level]?.percent) ?? 0
          const percent = levelPercent - prevPercent
          const splitAmount = percent > 0 ? (unitAmount * percent) / 100 : 0

          distributedAmount += splitToUser(parent, splitAmount, wages[parent.id].level, owner)
          if (owner) wages[parent.id].personal += 1
          wages[parent.id].general += 1

          const threshold = levels[level]
          if (wages[parent.id].personal >= threshold.personal && wages[parent.id].general >= threshold.general) {
            const nextLevel = level + 1
            if (levels[nextLevel]) {
              const promotion = promotions.find((promo) => promo.userId === parent.id)
              if (promotion) promotion.newLevel = nextLevel
              else promotions.push({ userId: parent.id, oldLevel: level, newLevel: nextLevel })
              wages[parent.id].personal = 0
              wages[parent.id].level = nextLevel
            }
          }

          prevPercent = levelPercent
          currentUser = parent
        }
      }

      result.push({ wallet: company.cumulativeWallet, amount: amount - distributedAmount })
      return { wages: groupResult(), promotions: promotions }
    },
  })
})
