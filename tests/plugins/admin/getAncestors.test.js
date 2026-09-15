import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../helpers'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('getAncestors', () => {
  const createTestCompany = async (app) => {
    return app.prisma.company.create({
      data: { name: `GetAncestors Company ${Date.now()}-${Math.random()}` },
    })
  }

  const createTestUser = async (app, companyId, overrides = {}) => {
    return app.prisma.user.create({
      data: {
        password: 'hash',
        role: 'Consultant',
        companyId,
        email: `get-ancestors-${Date.now()}-${Math.random()}@test.com`,
        phone: `+7${Date.now()}${Math.floor(Math.random() * 100)}`,
        ...overrides,
      },
    })
  }

  it('returns empty array when user has no parent', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const user = await createTestUser(app, company.id)

    const ancestors = await app.admin.getAncestors(user)

    expect(ancestors).toHaveLength(0)
  })

  it('returns ancestors for a Candidate payer', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const parent = await createTestUser(app, company.id)
    const candidate = await createTestUser(app, company.id, { role: 'Candidate', parentId: parent.id })

    const ancestors = await app.admin.getAncestors(candidate)

    expect(ancestors).toHaveLength(1)
    expect(ancestors[0].id).toBe(parent.id)
  })

  it('returns direct parent only', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const parent = await createTestUser(app, company.id)
    const child = await createTestUser(app, company.id, { parentId: parent.id })

    const ancestors = await app.admin.getAncestors(child)

    expect(ancestors).toHaveLength(1)
    expect(ancestors[0].id).toBe(parent.id)
  })

  it('returns all ancestors recursively', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const grandparent = await createTestUser(app, company.id)
    const parent = await createTestUser(app, company.id, { parentId: grandparent.id })
    const child = await createTestUser(app, company.id, { parentId: parent.id })

    const ancestors = await app.admin.getAncestors(child)

    expect(ancestors).toHaveLength(2)
    const ancestorIds = ancestors.map((a) => a.id)
    expect(ancestorIds).toContain(parent.id)
    expect(ancestorIds).toContain(grandparent.id)
  })

  it('does not include the user itself', async () => {
    const app = await createApp()
    const company = await createTestCompany(app)
    const parent = await createTestUser(app, company.id)
    const child = await createTestUser(app, company.id, { parentId: parent.id })

    const ancestors = await app.admin.getAncestors(child)
    const ancestorIds = ancestors.map((a) => a.id)

    expect(ancestorIds).not.toContain(child.id)
    expect(ancestors).toHaveLength(1)
  })
})
