import { UserRole } from '../generated/prisma/client'
import { HOURS24 } from '../lib/constants.js'

const YEAR_MS = 365 * HOURS24

export async function checkLevel(prisma, log = console) {
  // Runs once per month on the 1st. It evaluates the just-finished (previous)
  // month's personal sales to decide level confirmation / downgrade.
  const now = new Date()

  const companies = await prisma.company.findMany({
    select: {
      id: true,
      settings: {
        select: { levels: true },
        take: 1,
      },
    },
  })

  let downgraded = 0
  let confirmed = 0

  for (const company of companies) {
    const settings = company.settings[0]
    if (!settings) continue
    const levels = settings.levels
    if (!levels) continue

    // Start of the just-finished (previous) month, which is the month that is ending
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    // Start of the current month, used as the exclusive upper bound of the ending month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    // Cut-off relative to the user's FIRST level history createdAt
    const yearAgo = new Date(now.getTime() - YEAR_MS)

    // Users awaiting level confirmation whose FIRST level history predates the
    // start of the just-finished (previous) month (i.e. older than the sales window)
    const users = await prisma.user.findMany({
      where: {
        companyId: company.id,
        role: UserRole.Consultant,
        levelConfirmed: false,
        levelHistories: {
          some: {
            createdAt: { lte: monthStart },
          },
        },
      },
      select: {
        id: true,
        level: true,
        levelHistories: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true, createdAt: true },
        },
      },
    })

    for (const user of users) {
      const firstHistory = user.levelHistories[0]
      const firstLevelHistoryAt = firstHistory.createdAt
      const threshold = levels[user.level]?.confirm || 0

      // Previous (just-ended) month personal sales — sum of wage.score
      const personalAgg = await prisma.wage.aggregate({
        where: {
          userId: user.id,
          createdAt: { gte: monthStart, lt: currentMonthStart },
        },
        _sum: { score: true },
      })
      const personalSales = personalAgg._sum.score ?? 0

      // Downgrade if personal sales are below the confirm threshold for the current level
      if (personalSales < threshold && user.level > 1) {
        const oldLevel = user.level
        const newLevel = oldLevel - 1
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { level: newLevel },
          }),
          prisma.levelHistory.update({
            where: { id: firstHistory.id },
            data: { oldLevel, newLevel, createdAt: new Date() },
          }),
        ])
        downgraded++
      }

      // Auto-confirm if the first level history is more than a year old
      // (independent of the downgrade outcome)
      if (firstLevelHistoryAt < yearAgo) {
        await prisma.user.update({
          where: { id: user.id },
          data: { levelConfirmed: true },
        })
        confirmed++
      }
    }
  }

  log.info(`${downgraded} users downgraded, ${confirmed} users confirmed`)
}
