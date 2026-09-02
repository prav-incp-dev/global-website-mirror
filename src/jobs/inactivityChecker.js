import { UserRole } from '../generated/prisma/client'

export async function orphantUsers(prisma, log = console) {
  const orphantDays = parseInt(process.env.ORPHANT_DAYS, 10) || 40
  const orphantDate = new Date()
  orphantDate.setDate(orphantDate.getDate() - orphantDays)
  orphantDate.setHours(23, 59, 59, 999)

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
      ) < ${orphantDate}
  `

  const ids = staleUsers.map((u) => u.id)

  if (ids.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { parentId: null, orphant: true },
    })
  }

  log.info(`${ids.length} stale users are orphaned from their parents`)
}
