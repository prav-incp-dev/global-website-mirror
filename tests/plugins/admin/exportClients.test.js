import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../helpers'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('exportClients', () => {
  const createTestCompany = async (app) => {
    return app.prisma.company.create({
      data: { name: `Test Company ${Date.now()}` },
    })
  }

  const createTestUser = async (app, companyId, overrides = {}) => {
    return app.prisma.user.create({
      data: {
        email: `user-${Date.now()}-${Math.random()}@test.com`,
        password: 'hash',
        role: 'Candidate',
        firstName: 'Test',
        lastName: 'User',
        phone: `+7${Date.now()}${Math.floor(Math.random() * 100)}`,
        companyId,
        ...overrides,
      },
    })
  }

  const defaultUser = (companyId) => ({ company: { id: companyId } })

  it('returns all non-admin users when no filters are applied', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)

    await createTestUser(app, company.id, {
      email: 'alice-export@test.com',
      role: 'Consultant',
      firstName: 'Alice',
      lastName: 'Export',
    })
    await createTestUser(app, company.id, {
      email: 'bob-export@test.com',
      role: 'Candidate',
      firstName: 'Bob',
      lastName: 'Export',
    })
    // Admin user should be excluded
    await createTestUser(app, company.id, {
      email: 'admin-export@test.com',
      role: 'Admin',
      firstName: 'Admin',
      lastName: 'Export',
    })

    const result = await app.admin.exportClients(defaultUser(company.id), '2024-01-01', '2099-12-31')

    expect(result).toHaveLength(2)
    expect(result.find((u) => u.firstName === 'Alice')).toBeTruthy()
    expect(result.find((u) => u.firstName === 'Bob')).toBeTruthy()
    expect(result.find((u) => u.firstName === 'Admin')).toBeFalsy()
  })

  it('filters by search query', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)

    await createTestUser(app, company.id, {
      email: 'alice-query@test.com',
      firstName: 'Alice',
      lastName: 'Query',
    })
    await createTestUser(app, company.id, {
      email: 'bob-query@test.com',
      firstName: 'Bob',
      lastName: 'Query',
    })

    const result = await app.admin.exportClients(defaultUser(company.id), '2024-01-01', '2099-12-31', 'Alice')

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('Alice')
  })

  it('filters by orphan only', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)

    await createTestUser(app, company.id, {
      email: 'orphan-export@test.com',
      firstName: 'Orphan',
      orphant: true,
    })
    await createTestUser(app, company.id, {
      email: 'non-orphan-export@test.com',
      firstName: 'NonOrphan',
      orphant: false,
    })

    const result = await app.admin.exportClients(defaultUser(company.id), '2024-01-01', '2099-12-31', '', true)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('Orphan')
  })

  it('filters by level range', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)

    await createTestUser(app, company.id, {
      email: 'high-level@test.com',
      firstName: 'High',
      level: 8,
    })
    await createTestUser(app, company.id, {
      email: 'mid-level@test.com',
      firstName: 'Mid',
      level: 5,
    })
    await createTestUser(app, company.id, {
      email: 'low-level@test.com',
      firstName: 'Low',
      level: 2,
    })

    const result = await app.admin.exportClients(
      defaultUser(company.id),
      '2024-01-01',
      '2099-12-31',
      '',
      false,
      'id',
      4,
      6,
    )

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('Mid')
  })

  it('returns correct wage scores for the given date range', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)

    const user = await createTestUser(app, company.id, {
      email: 'wage-export@test.com',
      firstName: 'Wage',
      role: 'Consultant',
    })

    await app.prisma.wage.create({
      data: {
        companyId: company.id,
        userId: user.id,
        score: 10,
        groupScore: 20,
        amount: 0,
        createdAt: new Date('2025-06-15'),
      },
    })
    await app.prisma.wage.create({
      data: {
        companyId: company.id,
        userId: user.id,
        score: 5,
        groupScore: 15,
        amount: 0,
        createdAt: new Date('2025-07-01'),
      },
    })
    // Outside the date range — should be excluded
    await app.prisma.wage.create({
      data: {
        companyId: company.id,
        userId: user.id,
        score: 100,
        groupScore: 200,
        amount: 0,
        createdAt: new Date('2023-01-01'),
      },
    })

    const result = await app.admin.exportClients(defaultUser(company.id), '2025-06-01', '2025-07-31')

    expect(result).toHaveLength(1)
    expect(result[0].wageScore).toBe(15)
    expect(result[0].wageGroupScore).toBe(35)
  })

  it('returns zero wage scores when no wages exist in the date range', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)

    const user = await createTestUser(app, company.id, {
      email: 'no-wage-export@test.com',
      firstName: 'NoWage',
      role: 'Consultant',
    })

    // Wage outside range
    await app.prisma.wage.create({
      data: {
        companyId: company.id,
        userId: user.id,
        score: 50,
        groupScore: 50,
        amount: 0,
        createdAt: new Date('2023-01-01'),
      },
    })

    const result = await app.admin.exportClients(defaultUser(company.id), '2025-01-01', '2025-12-31')

    expect(result).toHaveLength(1)
    expect(result[0].wageScore).toBe(0)
    expect(result[0].wageGroupScore).toBe(0)
  })

  it('returns level date from LevelHistory when available', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)

    const user = await createTestUser(app, company.id, {
      email: 'leveldate-export@test.com',
      firstName: 'LevelDate',
      role: 'Consultant',
      level: 3,
    })

    await app.prisma.levelHistory.create({
      data: {
        userId: user.id,
        oldLevel: 2,
        newLevel: 3,
        createdAt: new Date('2025-05-10'),
      },
    })
    // Older history with a different level — should NOT match
    await app.prisma.levelHistory.create({
      data: {
        userId: user.id,
        oldLevel: 1,
        newLevel: 2,
        createdAt: new Date('2025-03-01'),
      },
    })

    const result = await app.admin.exportClients(defaultUser(company.id), '2024-01-01', '2099-12-31')

    expect(result).toHaveLength(1)
    expect(result[0].levelDate).toBe('10.05.2025')
  })

  it('returns empty level date when no LevelHistory matches current level', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)

    await createTestUser(app, company.id, {
      email: 'no-history-export@test.com',
      firstName: 'NoHistory',
      role: 'Consultant',
      level: 1,
    })

    const result = await app.admin.exportClients(defaultUser(company.id), '2024-01-01', '2099-12-31')

    expect(result).toHaveLength(1)
    expect(result[0].levelDate).toBe('')
  })

  it('returns empty array when no users match the criteria', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)

    await createTestUser(app, company.id, {
      email: 'no-match-export@test.com',
      firstName: 'NoMatch',
      level: 5,
    })

    const result = await app.admin.exportClients(
      defaultUser(company.id),
      '2024-01-01',
      '2099-12-31',
      '',
      false,
      'id',
      8,
      10,
    )

    expect(result).toHaveLength(0)
  })
})
