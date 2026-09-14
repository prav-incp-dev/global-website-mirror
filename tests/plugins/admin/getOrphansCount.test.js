import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../helpers'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('getOrphansCount', () => {
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
        parentId: null,
        ...overrides,
      },
    })
  }

  it('returns the count of orphan users', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    await createTestUser(app, company.id, {
      email: 'orphan1@test.com',
      firstName: 'Orphan',
      lastName: 'One',
      orphant: true,
    })
    await createTestUser(app, company.id, {
      email: 'orphan2@test.com',
      firstName: 'Orphan',
      lastName: 'Two',
      orphant: true,
    })
    const superParent = await createTestUser(app, company.id, {
      email: 'super-parent@test.com',
      firstName: 'Super',
      lastName: 'Parent',
    })
    const parent = await createTestUser(app, company.id, {
      email: 'parent@test.com',
      firstName: 'Parent',
      lastName: 'User',
      parentId: superParent.id,
    })
    await createTestUser(app, company.id, {
      email: 'with-parent@test.com',
      firstName: 'Has',
      lastName: 'Parent',
      parentId: parent.id,
    })

    const count = await app.admin.getOrphansCount(adminUser)

    expect(count).toBe(2)
  })

  it('returns 0 when there are no orphans', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    const superParent = await createTestUser(app, company.id, {
      email: 'super-parent@test.com',
      firstName: 'Super',
      lastName: 'Parent',
    })
    const parent1 = await createTestUser(app, company.id, {
      email: 'parent1@test.com',
      firstName: 'Parent',
      lastName: 'One',
      parentId: superParent.id,
    })
    const parent2 = await createTestUser(app, company.id, {
      email: 'parent2@test.com',
      firstName: 'Parent',
      lastName: 'Two',
      parentId: superParent.id,
    })
    await createTestUser(app, company.id, {
      email: 'child1@test.com',
      firstName: 'Child',
      lastName: 'One',
      parentId: parent1.id,
    })
    await createTestUser(app, company.id, {
      email: 'child2@test.com',
      firstName: 'Child',
      lastName: 'Two',
      parentId: parent2.id,
    })

    const count = await app.admin.getOrphansCount(adminUser)

    expect(count).toBe(0)
  })

  it('excludes Admin users from count', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    await createTestUser(app, company.id, {
      email: 'admin-orphan@test.com',
      role: 'Admin',
      firstName: 'Admin',
      lastName: 'Orphan',
      parentId: null,
      orphant: true,
    })
    await createTestUser(app, company.id, {
      email: 'candidate-orphan@test.com',
      role: 'Candidate',
      firstName: 'Candidate',
      lastName: 'Orphan',
      parentId: null,
      orphant: true,
    })

    const count = await app.admin.getOrphansCount(adminUser)

    expect(count).toBe(1)
  })

  it('filters orphans count by search query', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    await createTestUser(app, company.id, {
      email: 'john1@test.com',
      firstName: 'John',
      lastName: 'Doe',
      parentId: null,
      orphant: true,
    })
    await createTestUser(app, company.id, {
      email: 'john2@test.com',
      firstName: 'Johnny',
      lastName: 'Smith',
      parentId: null,
      orphant: true,
    })
    await createTestUser(app, company.id, {
      email: 'jane@test.com',
      firstName: 'Jane',
      lastName: 'Doe',
      parentId: null,
      orphant: true,
    })

    const count = await app.admin.getOrphansCount(adminUser, 'John')

    expect(count).toBe(2)
  })

  it('returns 0 when search query matches no orphans', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    await createTestUser(app, company.id, {
      email: 'john@test.com',
      firstName: 'John',
      lastName: 'Doe',
      parentId: null,
      orphant: true,
    })

    const count = await app.admin.getOrphansCount(adminUser, 'Nonexistent')

    expect(count).toBe(0)
  })

  it('filters orphans by email (case-insensitive)', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    await createTestUser(app, company.id, {
      email: 'matchme@test.com',
      firstName: 'Alice',
      lastName: 'Smith',
      parentId: null,
      orphant: true,
    })
    await createTestUser(app, company.id, {
      email: 'other@test.com',
      firstName: 'Bob',
      lastName: 'Jones',
      parentId: null,
      orphant: true,
    })

    const count = await app.admin.getOrphansCount(adminUser, 'matchme')

    expect(count).toBe(1)
  })

  it('filters orphans count by fromLevel', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    await createTestUser(app, company.id, {
      email: 'level-orphan-3@test.com',
      firstName: 'LowLevel',
      lastName: 'Orphan',
      parentId: null,
      orphant: true,
      level: 3,
    })
    await createTestUser(app, company.id, {
      email: 'level-orphan-7@test.com',
      firstName: 'MidLevel',
      lastName: 'Orphan',
      parentId: null,
      orphant: true,
      level: 7,
    })
    await createTestUser(app, company.id, {
      email: 'level-orphan-9@test.com',
      firstName: 'HighLevel',
      lastName: 'Orphan',
      parentId: null,
      orphant: true,
      level: 9,
    })

    const count = await app.admin.getOrphansCount(adminUser, '', 5, 10)

    expect(count).toBe(2)
  })

  it('filters orphans count by toLevel', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    await createTestUser(app, company.id, {
      email: 'tolevel-orphan-2@test.com',
      firstName: 'ToLevel',
      lastName: 'Low',
      parentId: null,
      orphant: true,
      level: 2,
    })
    await createTestUser(app, company.id, {
      email: 'tolevel-orphan-4@test.com',
      firstName: 'ToLevel',
      lastName: 'Mid',
      parentId: null,
      orphant: true,
      level: 4,
    })
    await createTestUser(app, company.id, {
      email: 'tolevel-orphan-8@test.com',
      firstName: 'ToLevel',
      lastName: 'High',
      parentId: null,
      orphant: true,
      level: 8,
    })

    const count = await app.admin.getOrphansCount(adminUser, '', 0, 5)

    expect(count).toBe(2)
  })

  it('filters orphans count by level range combined with search', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const adminUser = { company: { id: company.id } }

    await createTestUser(app, company.id, {
      email: 'alpha-low@test.com',
      firstName: 'Alpha',
      lastName: 'Low',
      parentId: null,
      orphant: true,
      level: 3,
    })
    await createTestUser(app, company.id, {
      email: 'alpha-high@test.com',
      firstName: 'Alpha',
      lastName: 'High',
      parentId: null,
      orphant: true,
      level: 7,
    })
    await createTestUser(app, company.id, {
      email: 'beta@test.com',
      firstName: 'Beta',
      lastName: 'User',
      parentId: null,
      orphant: true,
      level: 6,
    })

    const count = await app.admin.getOrphansCount(adminUser, 'Alpha', 5, 10)

    expect(count).toBe(1)
  })
})
