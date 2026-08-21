import { describe, it, onTestFinished, vi } from 'vitest'
import { createApp } from '../helpers'
import { untieUsers } from '../../src/jobs/inactivityChecker.js'

describe('untieUsers', () => {
  const baseUser = {
    password: 'hash',
    companyId: 1,
    firstName: 'John',
    lastName: 'Smith',
  }

  const silentLogger = { info: vi.fn() }

  const createUserWithInteraction = async (app, userData, interactionDate) => {
    const user = await app.prisma.user.create({ data: userData })

    await app.prisma.interaction.create({
      data: {
        status: 'Closed',
        plannedAt: new Date('2026-01-01T10:00:00Z'),
        completedAt: interactionDate,
        description: 'Test interaction',
        initiatorId: user.id,
        targetId: user.id,
        reminderSent: true,
      },
    })

    return user
  }

  it('unties Consultant with old interaction', async ({ expect }) => {
    const app = await createApp()

    const oldDate = new Date('2026-01-15T10:00:00Z')
    const parent = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Consultant',
        email: `inactivity-parent-${Date.now()}@test.com`,
        phone: `+10001001${String(Date.now()).slice(-4)}`,
      },
    })

    const user = await createUserWithInteraction(
      app,
      {
        ...baseUser,
        role: 'Consultant',
        email: `inactivity-old-consultant-${Date.now()}@test.com`,
        phone: `+10001002${String(Date.now()).slice(-4)}`,
        parentId: parent.id,
      },
      oldDate,
    )

    await untieUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBeNull()
  })

  it('unties Candidate with old interaction', async ({ expect }) => {
    const app = await createApp()

    const oldDate = new Date('2026-01-15T10:00:00Z')
    const parent = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Consultant',
        email: `inactivity-parent2-${Date.now()}@test.com`,
        phone: `+10001003${String(Date.now()).slice(-4)}`,
      },
    })

    const user = await createUserWithInteraction(
      app,
      {
        ...baseUser,
        role: 'Candidate',
        email: `inactivity-old-candidate-${Date.now()}@test.com`,
        phone: `+10001004${String(Date.now()).slice(-4)}`,
        parentId: parent.id,
      },
      oldDate,
    )

    await untieUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBeNull()
  })

  it('does not untie user with recent interaction', async ({ expect }) => {
    const app = await createApp()

    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 5)

    const parent = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Consultant',
        email: `inactivity-parent3-${Date.now()}@test.com`,
        phone: `+10001005${String(Date.now()).slice(-4)}`,
      },
    })

    const user = await createUserWithInteraction(
      app,
      {
        ...baseUser,
        role: 'Consultant',
        email: `inactivity-recent-${Date.now()}@test.com`,
        phone: `+10001006${String(Date.now()).slice(-4)}`,
        parentId: parent.id,
      },
      recentDate,
    )

    await untieUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBe(parent.id)
  })

  it('does not untie Admin with old interaction', async ({ expect }) => {
    const app = await createApp()

    const oldDate = new Date('2026-01-15T10:00:00Z')

    const user = await createUserWithInteraction(
      app,
      {
        ...baseUser,
        role: 'Admin',
        email: `inactivity-admin-${Date.now()}@test.com`,
        phone: `+10001007${String(Date.now()).slice(-4)}`,
        parentId: 1,
      },
      oldDate,
    )

    await untieUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBe(1)
  })

  it('does not untie user with null parentId', async ({ expect }) => {
    const app = await createApp()

    const oldDate = new Date('2026-01-15T10:00:00Z')

    const user = await createUserWithInteraction(
      app,
      {
        ...baseUser,
        role: 'Consultant',
        email: `inactivity-null-parent-${Date.now()}@test.com`,
        phone: `+10001008${String(Date.now()).slice(-4)}`,
        parentId: null,
      },
      oldDate,
    )

    await untieUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBeNull()
  })

  it('uses UNTIE_DAYS env var', async ({ expect }) => {
    const originalUntieDays = process.env.UNTIE_DAYS
    process.env.UNTIE_DAYS = '60'

    const app = await createApp()
    onTestFinished(async () => {
      process.env.UNTIE_DAYS = originalUntieDays
    })

    const oldDate = new Date('2026-06-01T10:00:00Z')
    const parent = await app.prisma.user.create({
      data: {
        ...baseUser,
        role: 'Consultant',
        email: `inactivity-parent4-${Date.now()}@test.com`,
        phone: `+10001009${String(Date.now()).slice(-4)}`,
      },
    })

    const user = await createUserWithInteraction(
      app,
      {
        ...baseUser,
        role: 'Consultant',
        email: `inactivity-custom-untie-${Date.now()}@test.com`,
        phone: `+10001010${String(Date.now()).slice(-4)}`,
        parentId: parent.id,
      },
      oldDate,
    )

    // UNTIE_DAYS=60 — oldDate (June 1) is more than 60 days ago from now (Aug 21)
    await untieUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBeNull()
  })

  it('logs info about processed count', async ({ expect }) => {
    const app = await createApp()

    const logSpy = vi.fn()
    await untieUsers(app.prisma, { info: logSpy })

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d+ stale users untied from their parents$/))
  })
})
