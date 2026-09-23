import fp from 'fastify-plugin'
import { getAddress, formatUnits } from 'viem'
import { getPublicClient, usdtAddress } from '../lib/chain.js'
import { UserRole } from '../generated/prisma/client'
import { WAGES_LIMIT } from '../lib/constants.js'

const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
]

export default fp(async (server) => {
  server.decorate('user', {
    getBalance: async (wallet) => {
      if (!wallet) return null

      if (!usdtAddress) return null

      const publicClient = getPublicClient()

      const [rawBalance, decimals] = await Promise.all([
        publicClient.readContract({
          address: getAddress(usdtAddress),
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [getAddress(wallet)],
        }),
        publicClient.readContract({
          address: getAddress(usdtAddress),
          abi: erc20Abi,
          functionName: 'decimals',
        }),
      ])

      return formatUnits(rawBalance, decimals)
    },

    getScores: async (user) => {
      if (user.role === UserRole.Candidate) {
        return { score: 0, groupScore: 0 }
      }

      const wageSums = await server.prisma.wage.groupBy({
        by: ['userId'],
        where: { userId: user.id },
        _sum: { score: true, groupScore: true },
      })

      return {
        score: wageSums[0]?._sum?.score ?? 0,
        groupScore: wageSums[0]?._sum?.groupScore ?? 0,
      }
    },

    getWages: async (user, page = 1, limit = WAGES_LIMIT, sortBy = 'id', query = '') => {
      const skip = (page - 1) * limit

      const orderByMap = {
        id: '"id" DESC',
        amount_asc: 'CAST("amount" AS NUMERIC) ASC',
        amount_desc: 'CAST("amount" AS NUMERIC) DESC',
      }
      const orderBy = orderByMap[sortBy] ?? orderByMap.id

      const baseParams = [user.id]
      const whereParts = ['"userId" = $1']

      if (query) {
        whereParts.push(`(CAST("amount" AS TEXT) ILIKE $2 OR "description" ILIKE $2)`)
        baseParams.push(`%${query}%`)
      }

      const whereSql = whereParts.join(' AND ')

      const [rows, totalRows] = await Promise.all([
        server.prisma.$queryRawUnsafe(
          `SELECT "id", "amount"::text, "description", "score", "groupScore", "createdAt"
           FROM "Wage"
           WHERE ${whereSql}
           ORDER BY ${orderBy}
           LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
          ...baseParams,
          limit,
          skip,
        ),
        server.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS "total" FROM "Wage" WHERE ${whereSql}`, ...baseParams),
      ])

      const total = totalRows[0]?.total ?? 0

      const wages = rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        description: row.description,
        score: row.score,
        groupScore: row.groupScore,
        createdAt: row.createdAt,
      }))

      return {
        wages,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    },

    getDescendants: async (user) => {
      if (user.role === UserRole.Candidate) return []

      const children = await server.prisma.$queryRaw`
        WITH RECURSIVE user_hierarchy AS (
          SELECT *
          FROM "User"
          WHERE "parentId" = ${user.id}

          UNION ALL

          SELECT u.*
          FROM "User" u
          INNER JOIN user_hierarchy uh ON u."parentId" = uh.id
        ),
        wage_sums AS (
          SELECT
            "userId",
            COALESCE(SUM("score"), 0)::int AS "score",
            COALESCE(SUM("groupScore"), 0)::int AS "groupScore"
          FROM "Wage"
          GROUP BY "userId"
        ),
        last_interactions AS (
          SELECT
            "targetId",
            MAX("completedAt") AS "lastInteractionDate"
          FROM "Interaction"
          WHERE "status" = 'Closed'
          GROUP BY "targetId"
        ),
        next_interactions AS (
          SELECT
            "targetId",
            "plannedAt"
          FROM "Interaction"
          WHERE "status" = 'Open'
        )
        SELECT
          uh."id", uh."email", uh."password", uh."role", uh."companyId", uh."nick",
          uh."firstName", uh."lastName", uh."phone", uh."level", uh."levelConfirmed",
          uh."memberId", uh."parentId", uh."orphant", uh."wallet", uh."confirmationCode",
          uh."createdAt", uh."updatedAt",
          COALESCE(ws."score", 0)::int AS "score",
          COALESCE(ws."groupScore", 0)::int AS "groupScore",
          li."lastInteractionDate",
          ni."plannedAt" AS "nextInteractionDate"
        FROM user_hierarchy uh
        LEFT JOIN wage_sums ws ON ws."userId" = uh."id"
        LEFT JOIN last_interactions li ON li."targetId" = uh."id"
        LEFT JOIN next_interactions ni ON ni."targetId" = uh."id"
      `

      return children
    },
  })
})
