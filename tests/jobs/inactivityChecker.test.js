import { describe, it, vi } from 'vitest'
import { createApp } from '../helpers'
import { orphantUsers } from '../../src/jobs/inactivityChecker.js'

describe('orphantUsers', () => {
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

  it('orphans Consultant with old interaction', async ({ expect }) => {
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

    await orphantUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBeNull()
    expect(updated.orphant).toBe(true)
  })

  it('orphants Candidate with old interaction', async ({ expect }) => {
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

    await orphantUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBeNull()
    expect(updated.orphant).toBe(true)
  })

  it('does not orphant user with recent interaction', async ({ expect }) => {
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

    await orphantUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBe(parent.id)
    expect(updated.orphant).toBe(false)
  })

  it('does not orphant Admin with old interaction', async ({ expect }) => {
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

    await orphantUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBe(1)
    expect(updated.orphant).toBe(false)
  })

  it('does not orphant user with null parentId', async ({ expect }) => {
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

    await orphantUsers(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.parentId).toBeNull()
    expect(updated.orphant).toBe(false)
  })

  it('uses per-company orphantDays from company settings', async ({ expect }) => {
    const app = await createApp()

    const companyRelaxed = await app.prisma.company.create({
      data: { name: `Inactivity Relaxed ${Date.now()}` },
    })
    const companyStrict = await app.prisma.company.create({
      data: { name: `Inactivity Strict ${Date.now()}` },
    })

    await app.prisma.setting.create({
      data: {
        companyId: companyRelaxed.id,
        general: { staleDays: 30, orphantDays: 365, refundFee: 5 },
        levels: {},
        prices: {},
      },
    })
    await app.prisma.setting.create({
      data: {
        companyId: companyStrict.id,
        general: { staleDays: 30, orphantDays: 7, refundFee: 5 },
        levels: {},
        prices: {},
      },
    })

    const interactionDate = new Date()
    interactionDate.setDate(interactionDate.getDate() - 30)

    const relaxedParent = await app.prisma.user.create({
      data: {
        ...baseUser,
        companyId: companyRelaxed.id,
        role: 'Consultant',
        email: `inactivity-relaxed-parent-${Date.now()}@test.com`,
        phone: `+10001011${String(Date.now()).slice(-4)}`,
      },
    })
    const strictParent = await app.prisma.user.create({
      data: {
        ...baseUser,
        companyId: companyStrict.id,
        role: 'Consultant',
        email: `inactivity-strict-parent-${Date.now()}@test.com`,
        phone: `+10001012${String(Date.now()).slice(-4)}`,
      },
    })

    const relaxedUser = await createUserWithInteraction(
      app,
      {
        ...baseUser,
        companyId: companyRelaxed.id,
        role: 'Consultant',
        email: `inactivity-relaxed-${Date.now()}@test.com`,
        phone: `+10001013${String(Date.now()).slice(-4)}`,
        parentId: relaxedParent.id,
      },
      interactionDate,
    )

    const strictUser = await createUserWithInteraction(
      app,
      {
        ...baseUser,
        companyId: companyStrict.id,
        role: 'Consultant',
        email: `inactivity-strict-${Date.now()}@test.com`,
        phone: `+10001014${String(Date.now()).slice(-4)}`,
        parentId: strictParent.id,
      },
      interactionDate,
    )

    // Same interaction age (30 days), but each company has its own orphantDays:
    // relaxed company (365) keeps the user tied, strict company (7) orphans it
    await orphantUsers(app.prisma, silentLogger)

    const relaxedUpdated = await app.prisma.user.findUnique({ where: { id: relaxedUser.id } })
    expect(relaxedUpdated.parentId).toBe(relaxedParent.id)
    expect(relaxedUpdated.orphant).toBe(false)

    const strictUpdated = await app.prisma.user.findUnique({ where: { id: strictUser.id } })
    expect(strictUpdated.parentId).toBeNull()
    expect(strictUpdated.orphant).toBe(true)
  })

  it('logs info about processed count', async ({ expect }) => {
    const app = await createApp()

    const logSpy = vi.fn()
    await orphantUsers(app.prisma, { info: logSpy })

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d+ stale users are orphaned from their parents$/))
  })
})
