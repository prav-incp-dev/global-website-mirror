import { describe, it, vi } from 'vitest'
import { createApp } from '../helpers'
import { checkLevel } from '../../src/jobs/levelReviewer.js'
import { UserRole } from '../../src/generated/prisma/client'

describe('checkLevel', () => {
  const silentLogger = { info: vi.fn() }

  const createCompanyWithLevels = async (app, levels) => {
    const company = await app.prisma.company.create({
      data: { name: `Level Tester ${Date.now()} ${Math.random().toString(36).slice(2, 6)}` },
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
        email: `lev-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        phone: `+1000${String(Date.now()).slice(-6)}${Math.random().toString(36).slice(2, 4)}`,
        memberId: `DOM-${String(Date.now()).slice(-8)}-${Math.random().toString(36).slice(2, 6)}`,
        level: 1,
        levelConfirmed: true,
        toReviewLevel: true,
        ...attrs,
      },
    })
  }

  const createWage = async (app, user, { score, groupScore = 0, createdAt = new Date() } = {}) => {
    const wage = await app.prisma.wage.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        score,
        groupScore,
        amount: 0,
        createdAt,
      },
    })
    return wage
  }

  describe('promotion conditions', () => {
    it('promotes user when both personal and general scores meet thresholds', async ({ expect }) => {
      const app = await createApp()
      // User at level 1, so we check thresholds from levels[2]
      const levels = {
        1: { percent: 20, personal: 50, general: 100, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 1 },
        3: { percent: 39, personal: 0, general: 0, confirm: 0 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const user = await createConsultant(app, company, { level: 1 })

      // personal = 60 + 40 = 100 >= 50 ✓, general = 60 + 40 + 80 = 180 >= 100 ✓
      await createWage(app, user, { score: 60, createdAt: new Date(Date.now() + 1000) })
      await createWage(app, user, { score: 40, groupScore: 80, createdAt: new Date(Date.now() + 2000) })

      await checkLevel(app.prisma, silentLogger)

      const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
      expect(updated.level).toBe(2)
      expect(updated.toReviewLevel).toBe(false)
    })

    it('does not promote when personal score is below threshold', async ({ expect }) => {
      const app = await createApp()
      // User at level 1, so we check thresholds from levels[2]
      const levels = {
        1: { percent: 20, personal: 50, general: 100, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 1 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const user = await createConsultant(app, company, { level: 1 })

      // personal = 30 < 50 ✗, general = 30 + 100 = 130 >= 100 ✓
      await createWage(app, user, { score: 30, groupScore: 100 })

      await checkLevel(app.prisma, silentLogger)

      const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
      expect(updated.level).toBe(1)
      expect(updated.toReviewLevel).toBe(false)
    })

    it('does not promote when general score is below threshold', async ({ expect }) => {
      const app = await createApp()
      // User at level 1, so we check thresholds from levels[2]
      const levels = {
        1: { percent: 20, personal: 50, general: 100, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 1 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const user = await createConsultant(app, company, { level: 1 })

      // personal = 60 >= 50 ✓, general = 60 + 20 = 80 < 100 ✗
      await createWage(app, user, { score: 60, groupScore: 20 })

      await checkLevel(app.prisma, silentLogger)

      const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
      expect(updated.level).toBe(1)
      expect(updated.toReviewLevel).toBe(false)
    })

    it('does not promote user with levelConfirmed = false', async ({ expect }) => {
      const app = await createApp()
      const levels = {
        1: { percent: 20, personal: 50, general: 100, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 0 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const user = await createConsultant(app, company, { level: 1, levelConfirmed: false, toReviewLevel: true })

      await createWage(app, user, { score: 100, groupScore: 200 })

      await checkLevel(app.prisma, silentLogger)

      const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
      expect(updated.level).toBe(1)
      expect(updated.toReviewLevel).toBe(true)
    })

    it('does not promote user with toReviewLevel = false', async ({ expect }) => {
      const app = await createApp()
      const levels = {
        1: { percent: 20, personal: 50, general: 100, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 0 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const user = await createConsultant(app, company, { level: 1, toReviewLevel: false })

      await createWage(app, user, { score: 100, groupScore: 200 })

      await checkLevel(app.prisma, silentLogger)

      const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
      expect(updated.level).toBe(1)
      expect(updated.toReviewLevel).toBe(false)
    })

    it('skips user already at max level', async ({ expect }) => {
      const app = await createApp()
      const levels = {
        1: { percent: 20, personal: 50, general: 100, confirm: 0 },
        2: { percent: 30, personal: 100, general: 300, confirm: 1 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const maxUser = await createConsultant(app, company, { level: 2 })

      await createWage(app, maxUser, { score: 200, groupScore: 500 })

      await checkLevel(app.prisma, silentLogger)

      const updated = await app.prisma.user.findUnique({ where: { id: maxUser.id } })
      expect(updated.level).toBe(2)
      expect(updated.toReviewLevel).toBe(false)
    })
  })

  describe('general score calculation', () => {
    it('sums score + groupScore across all wages ever', async ({ expect }) => {
      const app = await createApp()
      // User at level 1, so we check thresholds from levels[1]
      const levels = {
        1: { percent: 20, personal: 10, general: 200, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 1 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const user = await createConsultant(app, company, { level: 1 })

      // Old wage before user's createdAt (should still count for general)
      await createWage(app, user, {
        score: 50,
        groupScore: 100,
        createdAt: new Date(Date.now() - 86400000),
      })
      // Recent wage
      await createWage(app, user, {
        score: 30,
        groupScore: 40,
        createdAt: new Date(Date.now() + 1000),
      })

      await checkLevel(app.prisma, silentLogger)

      const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
      // general = 50 + 100 + 30 + 40 = 220 >= 200 ✓, personal = 30 >= 10 ✓
      expect(updated.level).toBe(2)
      expect(updated.toReviewLevel).toBe(false)
    })
  })

  describe('personal score calculation boundary', () => {
    it('only counts wages created since user reached current level', async ({ expect }) => {
      const app = await createApp()
      // User at level 1, so we check thresholds from levels[1]
      const levels = {
        1: { percent: 20, personal: 100, general: 150, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 1 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const user = await createConsultant(app, company, { level: 1 })

      // Wage before user.createdAt — counts for general but not personal
      await createWage(app, user, {
        score: 100,
        groupScore: 100,
        createdAt: new Date(Date.now() - 86400000),
      })
      // Wage after user.createdAt — counts for personal
      await createWage(app, user, {
        score: 120,
        createdAt: new Date(Date.now() + 1000),
      })

      await checkLevel(app.prisma, silentLogger)

      const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
      // personal = 120 >= 100 ✓, general = 100 + 100 + 120 = 320 >= 150 ✓
      expect(updated.level).toBe(2)
      expect(updated.toReviewLevel).toBe(false)
    })

    it('does not count personal score earned on the previous level toward the current-level personal requirement', async ({
      expect,
    }) => {
      const app = await createApp()
      // User at level 2, so we check thresholds from levels[2]
      const levels = {
        1: { percent: 20, personal: 3, general: 3, confirm: 0 },
        2: { percent: 30, personal: 3, general: 10, confirm: 2 },
        3: { percent: 39, personal: 4, general: 20, confirm: 3 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const user = await createConsultant(app, company, { level: 2 })

      // Level 1: wage with score = 3 (before user reached level 2)
      await createWage(app, user, {
        score: 3,
        createdAt: new Date(Date.now() - 86400000),
      })
      // LevelHistory recording the promotion to level 2
      await app.prisma.levelHistory.create({
        data: {
          userId: user.id,
          oldLevel: 1,
          newLevel: 2,
          createdAt: new Date(Date.now() - 86400000),
        },
      })
      // Level 2: one wage with score = 1, one wage with groupScore = 9
      await createWage(app, user, { score: 1 })
      await createWage(app, user, { groupScore: 9 })

      await checkLevel(app.prisma, silentLogger)

      const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
      // personal = 1 < 3 ✗ (level-1 score of 3 not counted), general = 3 + 1 + 9 = 13 >= 10 ✓
      expect(updated.level).toBe(2)
      expect(updated.toReviewLevel).toBe(false)
    })
  })

  describe('level history tracking', () => {
    it('creates LevelHistory record on promotion', async ({ expect }) => {
      const app = await createApp()
      const levels = {
        1: { percent: 20, personal: 50, general: 100, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 1 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const user = await createConsultant(app, company, { level: 1 })

      await createWage(app, user, { score: 60, groupScore: 60 })

      await checkLevel(app.prisma, silentLogger)

      const history = await app.prisma.levelHistory.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      })
      expect(history).toBeDefined()
      expect(history.oldLevel).toBe(1)
      expect(history.newLevel).toBe(2)

      const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
      expect(updated.toReviewLevel).toBe(false)
    })
  })

  describe('multi-company', () => {
    it('handles multiple companies with different level configs', async ({ expect }) => {
      const app = await createApp()

      // Company A — easy thresholds on the current level (1)
      const companyA = await createCompanyWithLevels(app, {
        1: { percent: 20, personal: 10, general: 10, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 1 },
      })
      const userA = await createConsultant(app, companyA, { level: 1 })
      await createWage(app, userA, { score: 15 })

      // Company B — high thresholds on the current level (1)
      const companyB = await createCompanyWithLevels(app, {
        1: { percent: 20, personal: 999, general: 999, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 1 },
      })
      const userB = await createConsultant(app, companyB, { level: 1 })
      await createWage(app, userB, { score: 15 })

      await checkLevel(app.prisma, silentLogger)

      const updatedA = await app.prisma.user.findUnique({ where: { id: userA.id } })
      const updatedB = await app.prisma.user.findUnique({ where: { id: userB.id } })
      expect(updatedA.level).toBe(2)
      expect(updatedA.toReviewLevel).toBe(false)
      expect(updatedB.level).toBe(1)
      expect(updatedB.toReviewLevel).toBe(false)
    })
  })

  describe('logging', () => {
    it('logs info about promoted count', async ({ expect }) => {
      const app = await createApp()
      const levels = {
        1: { percent: 20, personal: 10, general: 10, confirm: 0 },
        2: { percent: 30, personal: 0, general: 0, confirm: 1 },
      }
      const company = await createCompanyWithLevels(app, levels)
      const user = await createConsultant(app, company, { level: 1 })
      await createWage(app, user, { score: 20 })

      const logSpy = vi.fn()
      await checkLevel(app.prisma, { info: logSpy })

      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d+ users promoted to the next level$/))

      const updated = await app.prisma.user.findUnique({ where: { id: user.id } })
      expect(updated.toReviewLevel).toBe(false)
    })
  })
})
