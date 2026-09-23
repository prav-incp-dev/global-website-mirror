import { UserRole } from '../generated/prisma/client'

export async function checkLevel(prisma, log = console) {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      settings: {
        select: { levels: true },
        take: 1,
      },
    },
  })

  let promoted = 0

  for (const company of companies) {
    const levels = company.settings[0].levels

    const users = await prisma.user.findMany({
      where: {
        companyId: company.id,
        role: UserRole.Consultant,
        levelConfirmed: true,
        toReviewLevel: true,
      },
    })

    for (const user of users) {
      const currentLevel = user.level
      const nextLevel = currentLevel + 1

      // Skip if no configuration for the next level (user is at max or beyond)
      if (!levels[nextLevel]) continue

      const threshold = levels[currentLevel]

      // Find when the user achieved their current level
      const levelHistory = await prisma.levelHistory.findFirst({
        where: { userId: user.id, newLevel: currentLevel },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      const sinceDate = levelHistory?.createdAt ?? user.createdAt

      // Total personal level score — sum of scores since reaching current level
      const personalAgg = await prisma.wage.aggregate({
        where: {
          userId: user.id,
          createdAt: { gte: sinceDate },
        },
        _sum: { score: true },
      })

      // Total general level score — sum of all scores + group scores ever
      const generalAgg = await prisma.wage.aggregate({
        where: { userId: user.id },
        _sum: { score: true, groupScore: true },
      })

      const personalScore = personalAgg._sum.score ?? 0
      const generalScore = (generalAgg._sum.score ?? 0) + (generalAgg._sum.groupScore ?? 0)

      // Check thresholds and promote if conditions are met
      if (personalScore >= threshold.personal && generalScore >= threshold.general) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { level: nextLevel },
          }),
          prisma.levelHistory.create({
            data: {
              userId: user.id,
              oldLevel: currentLevel,
              newLevel: nextLevel,
            },
          }),
        ])

        promoted++
      }
    }

    // Reset review flag for all users that were processed
    const userIds = users.map((item) => item.id)
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { toReviewLevel: false },
    })
  }

  log.info(`${promoted} users promoted to the next level`)
}
