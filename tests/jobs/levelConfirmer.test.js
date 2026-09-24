import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { createApp } from '../helpers'
import { checkLevel } from '../../src/jobs/levelConfirmer.js'
import { UserRole } from '../../src/generated/prisma/client'

describe('checkLevel (levelConfirmer)', () => {
  const silentLogger = { info: vi.fn() }

  // Frozen "now" for the job. With now = 1 Oct 2026, the just-finished
  // (previous) month is September (monthStart = 1 Sep 2026).
  const baseNow = new Date(2026, 9, 1)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(baseNow)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createCompanyWithLevels = async (app, levels) => {
    const company = await app.prisma.company.create({
      data: { name: `Confirmer Tester ${Date.now()} ${Math.random().toString(36).slice(2, 6)}` },
    })
    await app.prisma.setting.create({
      data: {
        companyId: company.id,
        general: { staleDays: 30, orphantDays: 40, refundFee: 5 },
        levels,
        prices: { 0: 100, 1: 1200, 2: 2400 },
      },
    })
    return company
  }

  const createConsultant = async (app, company, attrs = {}) => {
    return app.prisma.user.create({
      data: {
        password: 'hash',
        role: UserRole.Consultant,
        companyId: company.id,
        email: `conf-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        phone: `+2000${String(Date.now()).slice(-6)}${Math.random().toString(36).slice(2, 4)}`,
        memberId: `DOM-${String(Date.now()).slice(-8)}-${Math.random().toString(36).slice(2, 6)}`,
        level: 2,
        levelConfirmed: false,
        ...attrs,
      },
    })
  }

  const createFirstLevelHistory = async (app, user, createdAt) => {
    return app.prisma.levelHistory.create({
      data: {
        userId: user.id,
        oldLevel: 1,
        newLevel: 2,
        createdAt,
      },
    })
  }

  const createWage = async (app, user, { score, groupScore = 0, createdAt = baseNow } = {}) => {
    return app.prisma.wage.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        score,
        groupScore,
        amount: 0,
        createdAt,
      },
    })
  }

  it('downgrades user whose previous-month personal sales are below the level confirm threshold', async ({
    expect,
  }) => {
    const app = await createApp()
    const levels = {
      1: { percent: 20, confirm: 0 },
      2: { percent: 30, confirm: 5 },
      3: { percent: 39, confirm: 3 },
    }
    const company = await createCompanyWithLevels(app, levels)
    const user = await createConsultant(app, company, { level: 2 })
    // First history created 2 months ago -> qualifies (>= 1 month)
    await createFirstLevelHistory(app, user, new Date(2026, 6, 15))
    // Current month personal sales = 2, below threshold of 5 for level 2
    await createWage(app, user, { score: 2, createdAt: new Date(2026, 8, 10) })

    await checkLevel(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.level).toBe(1)
    expect(updated.levelConfirmed).toBe(false)
  })

  it('does not downgrade when monthly personal sales meet the confirm threshold', async ({ expect }) => {
    const app = await createApp()
    const levels = {
      1: { percent: 20, confirm: 0 },
      2: { percent: 30, confirm: 5 },
      3: { percent: 39, confirm: 3 },
    }
    const company = await createCompanyWithLevels(app, levels)
    const user = await createConsultant(app, company, { level: 2 })
    await createFirstLevelHistory(app, user, new Date(2026, 6, 15))
    // Current month personal sales = 6 >= threshold 5 -> keep level
    await createWage(app, user, { score: 6, createdAt: new Date(2026, 8, 10) })

    await checkLevel(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.level).toBe(2)
    expect(updated.levelConfirmed).toBe(false)
  })

  it('only counts wages within the just-finished (previous) month for the personal sales total', async ({ expect }) => {
    const app = await createApp()
    const levels = {
      1: { percent: 20, confirm: 0 },
      2: { percent: 30, confirm: 10 },
      3: { percent: 39, confirm: 3 },
    }
    const company = await createCompanyWithLevels(app, levels)
    const user = await createConsultant(app, company, { level: 2 })
    await createFirstLevelHistory(app, user, new Date(2026, 6, 15))
    // Personal sales before the previous month should NOT count
    await createWage(app, user, { score: 20, createdAt: new Date(2026, 7, 25) }) // August
    // Sales in the new current month (October) should NOT count either
    await createWage(app, user, { score: 20, createdAt: new Date(2026, 9, 1) }) // October
    // Previous (September) personal sales = 4 (< 10) -> downgrade triggers
    await createWage(app, user, { score: 4, createdAt: new Date(2026, 8, 5) }) // September

    await checkLevel(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.level).toBe(1)
  })

  it('sets levelConfirmed to true when the first level history is more than a year old', async ({ expect }) => {
    const app = await createApp()
    const levels = {
      1: { percent: 20, confirm: 0 },
      2: { percent: 30, confirm: 5 },
      3: { percent: 39, confirm: 3 },
    }
    const company = await createCompanyWithLevels(app, levels)
    const user = await createConsultant(app, company, { level: 2 })
    // First history created ~2 years ago -> more than a year old
    await createFirstLevelHistory(app, user, new Date(2024, 5, 10))

    await checkLevel(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.levelConfirmed).toBe(true)
    // Still below threshold for level 2 (confirm 5, no sales) -> also downgraded
    expect(updated.level).toBe(1)
  })

  it('auto-confirms a year-old first history even when no downgrade happens', async ({ expect }) => {
    const app = await createApp()
    const levels = {
      1: { percent: 20, confirm: 0 },
      2: { percent: 30, confirm: 0 },
      3: { percent: 39, confirm: 0 },
    }
    const company = await createCompanyWithLevels(app, levels)
    const user = await createConsultant(app, company, { level: 2 })
    await createFirstLevelHistory(app, user, new Date(2024, 5, 10))
    // Sales >= threshold 0 -> no downgrade, but still confirmed
    await createWage(app, user, { score: 3, createdAt: new Date(2026, 8, 10) })

    await checkLevel(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.levelConfirmed).toBe(true)
    expect(updated.level).toBe(2)
  })

  it('does not select users whose first level history is less than a month old', async ({ expect }) => {
    const app = await createApp()
    const levels = {
      1: { percent: 20, confirm: 5 },
      2: { percent: 30, confirm: 5 },
    }
    const company = await createCompanyWithLevels(app, levels)
    const user = await createConsultant(app, company, { level: 2 })
    // First history created this month -> not yet a month old
    await createFirstLevelHistory(app, user, new Date(2026, 8, 20))

    await checkLevel(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.level).toBe(2)
    expect(updated.levelConfirmed).toBe(false)
  })

  it('does not select users with levelConfirmed already true', async ({ expect }) => {
    const app = await createApp()
    const levels = {
      1: { percent: 20, confirm: 5 },
      2: { percent: 30, confirm: 5 },
    }
    const company = await createCompanyWithLevels(app, levels)
    const user = await createConsultant(app, company, { level: 2, levelConfirmed: true })
    await createFirstLevelHistory(app, user, new Date(2026, 6, 15))

    await checkLevel(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.level).toBe(2)
    expect(updated.levelConfirmed).toBe(true)
  })

  it('does not downgrade below the minimum level', async ({ expect }) => {
    const app = await createApp()
    const levels = {
      0: { percent: 0, confirm: 0 },
      1: { percent: 20, confirm: 5 },
    }
    const company = await createCompanyWithLevels(app, levels)
    const user = await createConsultant(app, company, { level: 1 })
    await app.prisma.levelHistory.create({
      data: { userId: user.id, oldLevel: 0, newLevel: 1, createdAt: new Date(2026, 6, 15) },
    })
    await createWage(app, user, { score: 2 })

    await checkLevel(app.prisma, silentLogger)

    const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.level).toBe(1)
  })

  it('respects unique level config per company (multi-company isolation)', async ({ expect }) => {
    const app = await createApp()

    // Company A — low threshold (5) -> user with 2 sales is downgraded
    const companyA = await createCompanyWithLevels(app, {
      1: { percent: 20, confirm: 0 },
      2: { percent: 30, confirm: 5 },
    })
    const userA = await createConsultant(app, companyA, { level: 2 })
    await createFirstLevelHistory(app, userA, new Date(2026, 6, 15))
    await createWage(app, userA, { score: 2, createdAt: new Date(2026, 8, 10) })

    // Company B — lower threshold (1) -> same user's sales keep the level
    const companyB = await createCompanyWithLevels(app, {
      1: { percent: 20, confirm: 0 },
      2: { percent: 30, confirm: 1 },
    })
    const userB = await createConsultant(app, companyB, { level: 2 })
    await createFirstLevelHistory(app, userB, new Date(2026, 6, 15))
    await createWage(app, userB, { score: 2, createdAt: new Date(2026, 8, 10) })

    await checkLevel(app.prisma, silentLogger)

    const updatedA = await app.prisma.user.findUnique({ where: { id: userA.id } })
    const updatedB = await app.prisma.user.findUnique({ where: { id: userB.id } })
    // A: 2 < 5 -> downgraded; B: 2 >= 1 -> kept
    expect(updatedA.level).toBe(1)
    expect(updatedB.level).toBe(2)
  })

  it('logs info about downgraded and confirmed counts', async ({ expect }) => {
    const app = await createApp()
    const levels = {
      1: { percent: 20, confirm: 0 },
      2: { percent: 30, confirm: 5 },
    }
    const company = await createCompanyWithLevels(app, levels)
    const user = await createConsultant(app, company, { level: 2 })
    await createFirstLevelHistory(app, user, new Date(2026, 6, 15))
    await createWage(app, user, { score: 1 })

    const logSpy = vi.fn()
    await checkLevel(app.prisma, { info: logSpy })

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d+ users downgraded, \d+ users confirmed$/))
  })

  it('selects users based on a calendar boundary (first history must predate the previous month)', async ({
    expect,
  }) => {
    const app = await createApp()
    // Override frozen now = Mar 1, 2026 -> previous month is February (monthStart = Feb 1)
    vi.setSystemTime(new Date(2026, 2, 1))
    const levels = {
      1: { percent: 20, confirm: 0 },
      2: { percent: 30, confirm: 5 },
    }
    const company = await createCompanyWithLevels(app, levels)

    // UserA first history on Jan 31 (<= Feb 1) -> eligible -> downgraded (0 sales in Feb)
    const userA = await createConsultant(app, company, { level: 2 })
    await createFirstLevelHistory(app, userA, new Date(2026, 0, 31))

    // UserB first history on Feb 5 (> Feb 1) -> not eligible -> unchanged
    const userB = await createConsultant(app, company, { level: 2 })
    await createFirstLevelHistory(app, userB, new Date(2026, 1, 5))

    await checkLevel(app.prisma, silentLogger)

    const updatedA = await app.prisma.user.findUnique({ where: { id: userA.id } })
    const updatedB = await app.prisma.user.findUnique({ where: { id: userB.id } })

    // A: first history predates Feb 1 -> selected -> 0 < 5 -> downgraded
    expect(updatedA.level).toBe(1)
    // B: first history is within February (after the month boundary) -> not selected
    expect(updatedB.level).toBe(2)
    expect(updatedB.levelConfirmed).toBe(false)
  })
})
