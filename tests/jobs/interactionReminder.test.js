import { describe, it, vi } from 'vitest'
import { createApp } from '../helpers'
import { sendInteractionReminder } from '../../src/services/emailService.js'
import { checkUpcomingInteractions } from '../../src/jobs/interactionReminder.js'

// Mock email service to prevent actual email sending
vi.mock('../../src/services/emailService.js', () => ({
  sendInteractionReminder: vi.fn(),
}))

describe('checkUpcomingInteractions', () => {
  const baseUser = {
    password: 'hash',
    companyId: 1,
    firstName: 'John',
    lastName: 'Smith',
  }

  beforeEach(() => {
    vi.mocked(sendInteractionReminder).mockClear()
  })

  const silentLogger = { info: vi.fn() }

  it('processes yesterday open interaction and sends reminder', async ({ expect }) => {
    const app = await createApp()

    const initiator = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Consultant',
        email: `reminder-initiator-${Date.now()}@test.com`,
        phone: `+10000001${String(Date.now()).slice(-4)}`,
      },
    })

    const target = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Candidate',
        email: `reminder-target-${Date.now()}@test.com`,
        phone: `+10000002${String(Date.now()).slice(-4)}`,
      },
    })

    await app.prisma.interaction.create({
      data: {
        status: 'Open',
        plannedAt: new Date('2026-08-19T10:00:00Z'),
        completedAt: null,
        description: 'Scheduled call',
        initiatorId: initiator.id,
        targetId: target.id,
        reminderSent: false,
      },
    })

    await checkUpcomingInteractions(app.prisma, silentLogger)

    expect(sendInteractionReminder).toHaveBeenCalledWith(expect.objectContaining({ id: initiator.id }), 'John Smith')

    const updated = await app.prisma.interaction.findFirst({ where: { targetId: target.id } })
    expect(updated.reminderSent).toBe(true)
  })

  it('processes today evening open interaction', async ({ expect }) => {
    const app = await createApp()

    const initiator = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Consultant',
        email: `reminder-evening-initiator-${Date.now()}@test.com`,
        phone: `+10000003${String(Date.now()).slice(-4)}`,
        nick: 'consultant1',
      },
    })

    const target = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Candidate',
        email: `reminder-evening-target-${Date.now()}@test.com`,
        phone: `+10000004${String(Date.now()).slice(-4)}`,
      },
    })

    // Set plannedAt to today at 8 PM
    const todayEvening = new Date()
    todayEvening.setHours(20, 0, 0, 0)

    await app.prisma.interaction.create({
      data: {
        status: 'Open',
        plannedAt: todayEvening,
        completedAt: null,
        description: 'Evening call',
        initiatorId: initiator.id,
        targetId: target.id,
        reminderSent: false,
      },
    })

    await checkUpcomingInteractions(app.prisma, silentLogger)

    expect(sendInteractionReminder).toHaveBeenCalledWith(expect.objectContaining({ id: initiator.id }), 'John Smith')

    const updated = await app.prisma.interaction.findFirst({ where: { targetId: target.id } })
    expect(updated.reminderSent).toBe(true)
  })

  it('skips tomorrow interaction', async ({ expect }) => {
    const app = await createApp()

    const initiator = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Consultant',
        email: `reminder-tomorrow-initiator-${Date.now()}@test.com`,
        phone: `+10000005${String(Date.now()).slice(-4)}`,
      },
    })

    const target = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Candidate',
        email: `reminder-tomorrow-target-${Date.now()}@test.com`,
        phone: `+10000006${String(Date.now()).slice(-4)}`,
      },
    })

    // Set plannedAt to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)

    await app.prisma.interaction.create({
      data: {
        status: 'Open',
        plannedAt: tomorrow,
        completedAt: null,
        description: 'Tomorrow call',
        initiatorId: initiator.id,
        targetId: target.id,
        reminderSent: false,
      },
    })

    await checkUpcomingInteractions(app.prisma, silentLogger)

    expect(sendInteractionReminder).not.toHaveBeenCalled()

    const updated = await app.prisma.interaction.findFirst({ where: { targetId: target.id } })
    expect(updated.reminderSent).toBe(false)
  })

  it('skips already reminded interaction', async ({ expect }) => {
    const app = await createApp()

    const initiator = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Consultant',
        email: `reminder-already-initiator-${Date.now()}@test.com`,
        phone: `+10000007${String(Date.now()).slice(-4)}`,
      },
    })

    const target = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Candidate',
        email: `reminder-already-target-${Date.now()}@test.com`,
        phone: `+10000008${String(Date.now()).slice(-4)}`,
      },
    })

    await app.prisma.interaction.create({
      data: {
        status: 'Open',
        plannedAt: new Date('2026-08-19T10:00:00Z'),
        completedAt: null,
        description: 'Already reminded',
        initiatorId: initiator.id,
        targetId: target.id,
        reminderSent: true,
      },
    })

    await checkUpcomingInteractions(app.prisma, silentLogger)

    expect(sendInteractionReminder).not.toHaveBeenCalled()
  })

  it('skips interaction with null initiator', async ({ expect }) => {
    const app = await createApp()

    const target = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Candidate',
        email: `reminder-no-initiator-${Date.now()}@test.com`,
        phone: `+10000009${String(Date.now()).slice(-4)}`,
      },
    })

    await app.prisma.interaction.create({
      data: {
        status: 'Open',
        plannedAt: new Date('2026-08-19T10:00:00Z'),
        completedAt: null,
        description: 'No initiator',
        initiatorId: null,
        targetId: target.id,
        reminderSent: false,
      },
    })

    await expect(checkUpcomingInteractions(app.prisma, silentLogger)).resolves.toBeUndefined()

    expect(sendInteractionReminder).not.toHaveBeenCalled()

    const updated = await app.prisma.interaction.findFirst({ where: { targetId: target.id } })
    expect(updated.reminderSent).toBe(false)
  })

  it('logs info about processed count', async ({ expect }) => {
    const app = await createApp()

    const logSpy = vi.fn()
    await checkUpcomingInteractions(app.prisma, { info: logSpy })

    expect(logSpy).toHaveBeenCalledWith('0 upcoming interactions processed')
  })
})
