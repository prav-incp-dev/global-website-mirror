import { sendInteractionReminder } from '../services/emailService.js'

const targetName = (user) => {
  return `${user.firstName} ${user.lastName}`.trim()
}

export async function checkUpcomingInteractions(prisma, log = console) {
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const interactions = await prisma.interaction.findMany({
    where: {
      status: 'Open',
      plannedAt: { lte: endOfToday },
      reminderSent: false,
    },
    include: { initiator: true, target: true },
  })

  for (const interaction of interactions) {
    const initiator = interaction.initiator
    if (!initiator) continue

    await sendInteractionReminder(initiator, targetName(interaction.target))

    await prisma.interaction.update({
      where: { id: interaction.id },
      data: { reminderSent: true },
    })
  }

  log.info(`${interactions.length} upcoming interactions processed`)
}
