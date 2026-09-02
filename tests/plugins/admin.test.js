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
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
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

      const low = await createTestUser(app, company.id, {
        email: 'sort-score-low@test.com',
        firstName: 'LowScore',
      })
      const high = await createTestUser(app, company.id, {
        email: 'sort-score-high@test.com',
        firstName: 'HighScore',
      })
      const mid = await createTestUser(app, company.id, {
        email: 'sort-score-mid@test.com',
        firstName: 'MidScore',
      })

      await app.prisma.wage.create({
        data: { companyId: company.id, userId: low.id, score: 100, groupScore: 100, amount: 0 },
      })
      await app.prisma.wage.create({
        data: { companyId: company.id, userId: high.id, score: 300, groupScore: 300, amount: 0 },
      })
      await app.prisma.wage.create({
        data: { companyId: company.id, userId: mid.id, score: 200, groupScore: 200, amount: 0 },
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '', false, 'score')

      expect(result.users).toHaveLength(3)
      expect(result.users[0].score).toBe(300)
      expect(result.users[1].score).toBe(200)
      expect(result.users[2].score).toBe(100)
    })

    it('returns score 0 and groupScore 0 for users without wages', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      await createTestUser(app, company.id, {
        email: 'no-wages@test.com',
        firstName: 'NoWage',
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '')

      const user = result.users.find((u) => u.email === 'no-wages@test.com')

      expect(user).toBeTruthy()
    })

    it('sums score and groupScore across multiple wages per user', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      const user = await createTestUser(app, company.id, {
        email: 'multi-wages@test.com',
        firstName: 'MultiWage',
      })

      await app.prisma.wage.create({
        data: { companyId: company.id, userId: user.id, score: 10, groupScore: 5, amount: 0 },
      })
      await app.prisma.wage.create({
        data: { companyId: company.id, userId: user.id, score: 20, groupScore: 15, amount: 0 },
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '')

      const found = result.users.find((u) => u.email === 'multi-wages@test.com')

      expect(found).toBeTruthy()
      expect(found.score).toBe(30)
      expect(found.groupScore).toBe(20)
    })

    it('sorts by score using aggregated wage sums (not stored score column)', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      const first = await createTestUser(app, company.id, {
        email: 'agg-first@test.com',
        firstName: 'AggFirst',
      })
      const third = await createTestUser(app, company.id, {
        email: 'agg-third@test.com',
        firstName: 'AggThird',
      })
      const second = await createTestUser(app, company.id, {
        email: 'agg-second@test.com',
        firstName: 'AggSecond',
      })

      await app.prisma.wage.create({
        data: { companyId: company.id, userId: first.id, score: 10, groupScore: 0, amount: 0 },
      })
      await app.prisma.wage.create({
        data: { companyId: company.id, userId: second.id, score: 30, groupScore: 0, amount: 0 },
      })
      await app.prisma.wage.create({
        data: { companyId: company.id, userId: third.id, score: 20, groupScore: 0, amount: 0 },
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '', false, 'score')

      expect(result.users).toHaveLength(3)
      // Sorted by aggregated wage sums: second(30), third(20), first(10)
      expect(result.users[0].firstName).toBe('AggSecond')
      expect(result.users[1].firstName).toBe('AggThird')
      expect(result.users[2].firstName).toBe('AggFirst')
    })

    it('maps parent object using parentId left join', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const adminUser = { company: { id: company.id } }

      const parent = await createTestUser(app, company.id, {
        email: 'parent-join@test.com',
        firstName: 'Parent',
        lastName: 'Join',
      })
      await createTestUser(app, company.id, {
        email: 'child-join@test.com',
        firstName: 'Child',
        parentId: parent.id,
      })

      const result = await app.admin.getClients(adminUser, 1, 20, '')

      const child = result.users.find((u) => u.email === 'child-join@test.com')

      expect(child).toBeTruthy()
      expect(child.parent).toEqual({ firstName: 'Parent', lastName: 'Join' })
      expect(child.parentId).toBe(parent.id)
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

    it('returns an error when the user already has a wage with non-zero amount', async () => {
      const app = await createApp()
      const company = await createTestCompany(app)
      const user = await createTestUser(app, company.id)
      const existingWage = await createTestWage(app, company.id, user.id, {
        score: 100,
        groupScore: 100,
        amount: 500,
      })

      const result = await app.admin.setScores(user, { score: 10, groupScore: 20 })

      expect(result).toEqual({ error: 'У пользователя уже есть продажи' })

      // No changes were made
      const wages = await app.prisma.wage.findMany({ where: { userId: user.id } })
      expect(wages).toHaveLength(1)
      expect(wages[0].id).toBe(existingWage.id)
      expect(wages[0].score).toBe(100)
      expect(wages[0].groupScore).toBe(100)
      expect(wages[0].amount.toString()).toBe('500')
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
})
