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
          u."email", u."phone", u."memberId", u."nick", u."parentId", u."wallet",
          COALESCE(SUM(w."score"), 0)::int AS "score",
          COALESCE(SUM(w."groupScore"), 0)::int AS "groupScore",
          COALESCE(SUM(w."amount"), 0)::numeric AS "totalAmount",
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
        isLocked: row.totalAmount > 0,
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
      const whereParts = [
        `u."role" <> 'Admin'`,
        `u."companyId" = $1`,
        `u."level" >= $2`,
        `u."level" <= $3`,
      ]
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
          lh."createdAt" AS "levelDate",
          COALESCE(w."score", 0)::int AS "wageScore",
          COALESCE(w."groupScore", 0)::int AS "wageGroupScore"
        FROM "User" u
        LEFT JOIN LATERAL (
          SELECT "createdAt" FROM "LevelHistory"
          WHERE "userId" = u."id" AND "newLevel" = u."level"
          ORDER BY "createdAt" DESC
          LIMIT 1
        ) lh ON true
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM("score"), 0)::int AS "score",
            COALESCE(SUM("groupScore"), 0)::int AS "groupScore"
          FROM "Wage"
          WHERE "userId" = u."id"
            AND "createdAt" >= $4::date
            AND "createdAt" < ($5::date + INTERVAL '1 day')
        ) w ON true
        WHERE ${whereSql}
        ORDER BY ${orderBy}
      `

      const rows = await fastify.prisma.$queryRawUnsafe(sql, ...baseParams)

      return rows.map((row) => ({
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        memberId: row.memberId,
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

      const amount = Number(payment.amount)
      let distributedAmount = 0

      const result = []
      const splitToCompany = (wallet, value) => {
        const rounded = Number(value.toFixed(2))
        result.push({ wallet: wallet, amount: rounded })
        return rounded
      }

      const splitToUser = (user, value, score, groupScore) => {
        if (!user.wallet) return 0
        const rounded = Number(value.toFixed(2))
        result.push({ wallet: user.wallet, amount: rounded, userId: user.id, score: score, groupScore: groupScore })
        return rounded
      }

      distributedAmount += splitToCompany(company.serviceWallet, amount / 100)
      const ancestors = await fastify.admin.getAncestors(user)

      let prevPercent = 0
      let currentUser = user
      while (currentUser.parentId && order.quantity > 0) {
        const parent = ancestors.find(user => user.id == currentUser.parentId)
        const owner = parent.id == user.parentId
        const levelPercent = Number(setting?.levels?.[parent.level]?.percent) ?? 0
        const percent = levelPercent - prevPercent
        distributedAmount += splitToUser(parent, percent > 0 ? (amount * percent) / 100 : 0, owner ? order.quantity : 0, owner ? 0 : order.quantity)
        prevPercent = levelPercent
        currentUser = parent
      }

      result.push({ wallet: company.cumulativeWallet, amount: amount - distributedAmount })
      return result
    },
  })
})
