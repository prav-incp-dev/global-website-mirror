import { UserRole } from '../generated/prisma/client'

export async function untieUsers(prisma, log = console) {
  const untieDays = parseInt(process.env.UNTIE_DAYS, 10) || 40
  const untieDate = new Date()
  untieDate.setDate(untieDate.getDate() - untieDays)
  untieDate.setHours(23, 59, 59, 999)

  const staleUsers = await prisma.$queryRaw`
    SELECT u.id
    FROM "User" u
    WHERE u."parentId" IS NOT NULL
      AND u.role IN (${UserRole.Consultant}, ${UserRole.Candidate})
      AND (
        SELECT MAX(i."completedAt")
        FROM "Interaction" i
        WHERE i."targetId" = u.id
          AND i.status = 'Closed'
      ) < ${untieDate}
  `

  const ids = staleUsers.map((u) => u.id)

  if (ids.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { parentId: null },
    })
  }

  log.info(`${ids.length} stale users untied from their parents`)
}
