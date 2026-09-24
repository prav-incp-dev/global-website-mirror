import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../helpers'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('setScores', () => {
  const createTestCompany = async (app) => {
    return app.prisma.company.create({
      data: { name: `SetScores Company ${Date.now()}` },
    })
  }

  const createTestUser = async (app, companyId, overrides = {}) => {
    return app.prisma.user.create({
      data: {
        email: `set-scores-${Date.now()}-${Math.random()}@test.com`,
        password: 'hash',
        role: 'Consultant',
        firstName: 'Score',
        lastName: 'Target',
        phone: `+7${Date.now()}${Math.floor(Math.random() * 100)}`,
        companyId,
        level: 1,
        levelConfirmed: true,
        ...overrides,
      },
    })
  }

  const createTestWage = async (app, companyId, userId, overrides = {}) => {
    return app.prisma.wage.create({
      data: {
        companyId,
        userId,
        score: 0,
        groupScore: 0,
        amount: 0,
        ...overrides,
      },
    })
  }

  it('creates a new wage with zero amount when no wages exist', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const user = await createTestUser(app, company.id)

    const result = await app.admin.setScores(user, { score: 10, groupScore: 20 })

    expect(result).toEqual({ success: true })

    const wages = await app.prisma.wage.findMany({ where: { userId: user.id } })
    expect(wages).toHaveLength(1)
    expect(wages[0].companyId).toBe(company.id)
    expect(wages[0].userId).toBe(user.id)
    expect(wages[0].score).toBe(10)
    expect(wages[0].groupScore).toBe(20)
    expect(wages[0].amount.toString()).toBe('0')
  })

  it('modifies the existing zero-amount wage in place', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const user = await createTestUser(app, company.id)
    await createTestWage(app, company.id, user.id)

    const result = await app.admin.setScores(user, { score: 30, groupScore: 40 })

    expect(result).toEqual({ success: true })

    const wages = await app.prisma.wage.findMany({ where: { userId: user.id } })
    expect(wages).toHaveLength(1)
    expect(wages[0].score).toBe(30)
    expect(wages[0].groupScore).toBe(40)
    expect(wages[0].amount.toString()).toBe('0')
  })

  it('updates the first wage by id ascending when multiple zero-amount wages exist', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const user = await createTestUser(app, company.id)
    const firstWage = await createTestWage(app, company.id, user.id, { score: 7, groupScore: 8 })
    const secondWage = await createTestWage(app, company.id, user.id, { score: 5, groupScore: 6 })

    const result = await app.admin.setScores(user, { score: 50, groupScore: 60 })

    expect(result).toEqual({ success: true })

    const wages = await app.prisma.wage.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } })
    expect(wages).toHaveLength(2)
    expect(wages[0].id).toBe(firstWage.id)
    expect(wages[0].score).toBe(50)
    expect(wages[0].groupScore).toBe(60)
    expect(wages[1].id).toBe(secondWage.id)
    expect(wages[1].score).toBe(5)
    expect(wages[1].groupScore).toBe(6)
  })

  it('returns an error when the user is already locked (has non-zero wage amount)', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const user = await createTestUser(app, company.id, { isLocked: true })

    const result = await app.admin.setScores(user, { score: 10, groupScore: 20 })

    expect(result).toEqual({ error: 'У пользователя уже есть продажи' })

    // No changes were made (no wages created)
    const wages = await app.prisma.wage.findMany({ where: { userId: user.id } })
    expect(wages).toHaveLength(0)
  })

  it('handles setting scores back to zero', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const user = await createTestUser(app, company.id)

    const firstResult = await app.admin.setScores(user, { score: 10, groupScore: 20 })
    expect(firstResult).toEqual({ success: true })

    const secondResult = await app.admin.setScores(user, { score: 0, groupScore: 0 })
    expect(secondResult).toEqual({ success: true })

    const wages = await app.prisma.wage.findMany({ where: { userId: user.id } })
    expect(wages).toHaveLength(1)
    expect(wages[0].score).toBe(0)
    expect(wages[0].groupScore).toBe(0)
    expect(wages[0].amount.toString()).toBe('0')
  })
})
