import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../helpers'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('admin plugin', () => {
  describe('getCompany', () => {
    it('returns null when user has no company', async () => {
      const app = await createApp()

      const adminUser = {
        id: 1,
        email: 'admin@example.com',
        role: 'Admin',
        company: null,
      }

      const company = await app.admin.getCompany(adminUser)

      expect(company).toBeNull()
    })

    it('returns null when user is null', async () => {
      const app = await createApp()

      const company = await app.admin.getCompany(null)

      expect(company).toBeNull()
    })

    it('returns company data', async () => {
      const adminUser = {
        id: 1,
        email: 'admin@example.com',
        role: 'Admin',
        company: { id: 1 },
      }

      const foundCompany = {
        id: 1,
        name: 'Our House MLM',
        primaryWallet: '0x1234567890abcdef1234567890abcdef12345678',
        secondaryWallet: null,
      }

      const app = await createApp()
      vi.spyOn(app.prisma.company, 'findUnique').mockResolvedValue(foundCompany)

      const company = await app.admin.getCompany(adminUser)

      expect(company).toEqual(foundCompany)
      expect(app.prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      })
    })
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
  })

  describe('getClients', () => {
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

    it('returns all non-admin users when no query is provided', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'consultant@test.com',
        role: 'Consultant',
        firstName: 'Zara',
        lastName: 'Unique',
      })
      await createTestUser(app, company.id, {
        email: 'candidate@test.com',
        role: 'Candidate',
        firstName: 'Zane',
        lastName: 'Distinct',
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '')

      expect(result.users.length).toBeGreaterThanOrEqual(2)
      expect(result.total).toBeGreaterThanOrEqual(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })

    it('excludes Admin users from results', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'admin-exclude@test.com',
        role: 'Admin',
        firstName: 'Xylo',
        lastName: 'AdminUser',
      })
      await createTestUser(app, company.id, {
        email: 'consultant-exclude@test.com',
        role: 'Consultant',
        firstName: 'Xena',
        lastName: 'ConsultantUser',
      })

      const result = await app.admin.getClients(adminUser, 1, 20, 'Xena')

      expect(result.users).toHaveLength(1)
      expect(result.users[0].role).toBe('Consultant')
      expect(result.total).toBe(1)
    })

    it('returns paginated results', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      for (let i = 0; i < 5; i++) {
        await createTestUser(app, company.id, {
          email: `paginate-user${i}@test.com`,
          firstName: `PaginateUser${i}`,
          phone: `+7${Date.now()}${i}`,
        })
      }

      const page1 = await app.admin.getClients(adminUser, 1, 2, 'PaginateUser')

      expect(page1.users).toHaveLength(2)
      expect(page1.total).toBe(5)
      expect(page1.page).toBe(1)
      expect(page1.limit).toBe(2)
      expect(page1.totalPages).toBe(3)

      const page2 = await app.admin.getClients(adminUser, 2, 2, 'PaginateUser')

      expect(page2.users).toHaveLength(2)
      expect(page2.page).toBe(2)

      const page3 = await app.admin.getClients(adminUser, 3, 2, 'PaginateUser')

      expect(page3.users).toHaveLength(1)
      expect(page3.page).toBe(3)
    })

    it('filters by firstName (case-insensitive)', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'alice-filter@test.com',
        firstName: 'Qalice',
        lastName: 'Johnson',
      })
      await createTestUser(app, company.id, {
        email: 'bob-filter@test.com',
        firstName: 'Bob',
        lastName: 'Smith',
      })
      await createTestUser(app, company.id, {
        email: 'alex-filter@test.com',
        firstName: 'Qalexander',
        lastName: 'Brown',
      })

      const result = await app.admin.getClients(adminUser, 1, 20, 'Qal')

      expect(result.users).toHaveLength(2)
      expect(result.users.map((u) => u.firstName)).toEqual(expect.arrayContaining(['Qalice', 'Qalexander']))
    })

    it('filters by lastName (case-insensitive)', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'user1-last@test.com',
        firstName: 'John',
        lastName: 'Qsmith',
      })
      await createTestUser(app, company.id, {
        email: 'user2-last@test.com',
        firstName: 'Jane',
        lastName: 'Qsmithers',
      })
      await createTestUser(app, company.id, {
        email: 'user3-last@test.com',
        firstName: 'Bob',
        lastName: 'Johnson',
      })

      const result = await app.admin.getClients(adminUser, 1, 20, 'qsmith')

      expect(result.users).toHaveLength(2)
      expect(result.users.map((u) => u.lastName)).toEqual(expect.arrayContaining(['Qsmith', 'Qsmithers']))
    })

    it('returns empty users array when no matches', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'user-no-match@test.com',
        firstName: 'John',
        lastName: 'Doe',
      })

      const result = await app.admin.getClients(adminUser, 1, 20, 'zzzznonexistentzzzz')

      expect(result.users).toHaveLength(0)
      expect(result.total).toBe(0)
      expect(result.totalPages).toBe(0)
    })

    it('returns correct totalPages calculation', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      for (let i = 0; i < 10; i++) {
        await createTestUser(app, company.id, {
          email: `totalpages-user${i}@test.com`,
          firstName: `TotalPagesUser${i}`,
          phone: `+7${Date.now()}${i}`,
        })
      }

      const result = await app.admin.getClients(adminUser, 1, 3, 'TotalPagesUser')

      expect(result.total).toBe(10)
      expect(result.limit).toBe(3)
      expect(result.totalPages).toBe(4)
    })

    it('filters by email (case-insensitive)', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'matchme-email@test.com',
        firstName: 'Alice',
        lastName: 'Smith',
      })
      await createTestUser(app, company.id, {
        email: 'other-email@test.com',
        firstName: 'Bob',
        lastName: 'Jones',
      })

      const result = await app.admin.getClients(adminUser, 1, 20, 'matchme-email')

      expect(result.users).toHaveLength(1)
      expect(result.users[0].email).toBe('matchme-email@test.com')
      expect(result.total).toBe(1)
    })

    it('filters by orphansOnly flag', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'orphan-filter@test.com',
        firstName: 'Orphan',
        lastName: 'User',
        orphant: true,
      })
      await createTestUser(app, company.id, {
        email: 'non-orphan-filter@test.com',
        firstName: 'Normal',
        lastName: 'User',
        orphant: false,
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '', true)

      expect(result.users).toHaveLength(1)
      expect(result.users[0].email).toBe('orphan-filter@test.com')
      expect(result.total).toBe(1)
    })

    it('sorts by name (alphabetical)', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'sort-name-charlie@test.com',
        firstName: 'Charlie',
        lastName: 'Zeta',
      })
      await createTestUser(app, company.id, {
        email: 'sort-name-alice@test.com',
        firstName: 'Alice',
        lastName: 'Bravo',
      })
      await createTestUser(app, company.id, {
        email: 'sort-name-bob@test.com',
        firstName: 'Bob',
        lastName: 'Alpha',
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '', false, 'name')

      expect(result.users).toHaveLength(3)
      expect(result.users[0].firstName).toBe('Alice')
      expect(result.users[1].firstName).toBe('Bob')
      expect(result.users[2].firstName).toBe('Charlie')
    })

    it('sorts by level (descending)', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'sort-level-high@test.com',
        firstName: 'High',
        level: 3,
      })
      await createTestUser(app, company.id, {
        email: 'sort-level-low@test.com',
        firstName: 'Low',
        level: 1,
      })
      await createTestUser(app, company.id, {
        email: 'sort-level-mid@test.com',
        firstName: 'Mid',
        level: 2,
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '', false, 'level')

      expect(result.users).toHaveLength(3)
      expect(result.users[0].level).toBe(3)
      expect(result.users[1].level).toBe(2)
      expect(result.users[2].level).toBe(1)
    })

    it('sorts by role (ascending)', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'sort-role-consultant@test.com',
        firstName: 'Consult',
        role: 'Consultant',
      })
      await createTestUser(app, company.id, {
        email: 'sort-role-candidate@test.com',
        firstName: 'Candid',
        role: 'Candidate',
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '', false, 'role')

      expect(result.users).toHaveLength(2)
      expect(result.users[0].role).toBe('Candidate')
      expect(result.users[1].role).toBe('Consultant')
    })

    it('sorts by score (descending)', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'sort-score-low@test.com',
        firstName: 'LowScore',
        score: 100,
      })
      await createTestUser(app, company.id, {
        email: 'sort-score-high@test.com',
        firstName: 'HighScore',
        score: 300,
      })
      await createTestUser(app, company.id, {
        email: 'sort-score-mid@test.com',
        firstName: 'MidScore',
        score: 200,
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '', false, 'score')

      expect(result.users).toHaveLength(3)
      expect(result.users[0].score).toBe(300)
      expect(result.users[1].score).toBe(200)
      expect(result.users[2].score).toBe(100)
    })

    it('defaults to sorting by id descending', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      const user1 = await createTestUser(app, company.id, {
        email: 'sort-default-first@test.com',
        firstName: 'First',
      })
      const user2 = await createTestUser(app, company.id, {
        email: 'sort-default-second@test.com',
        firstName: 'Second',
      })
      const user3 = await createTestUser(app, company.id, {
        email: 'sort-default-third@test.com',
        firstName: 'Third',
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '', false)

      expect(result.users).toHaveLength(3)
      expect(result.users[0].id).toBe(user3.id)
      expect(result.users[1].id).toBe(user2.id)
      expect(result.users[2].id).toBe(user1.id)
    })
  })
})
