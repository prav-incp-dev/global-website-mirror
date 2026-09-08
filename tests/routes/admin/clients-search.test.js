import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'

const createCompany = async (app, name) => {
  return app.prisma.company.create({
    data: { name },
  })
}

describe('GET /api/admin/clients/search', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search?query=test' })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })
  it('returns 403 when user is not Admin', async () => {
    const nonAdminUser = { id: 1, email: 'user@example.com', role: 'Candidate', company: { id: 1 } }
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(nonAdminUser)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search?query=test' })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })
  it('returns 400 when query is too short', async () => {
    const adminUser = { id: 1, email: 'admin@example.com', role: 'Admin', company: { id: 1 } }
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search?query=a' })
    expect(response.statusCode).toBe(400)
  })
  it('returns 400 when query is missing', async () => {
    const adminUser = { id: 1, email: 'admin@example.com', role: 'Admin', company: { id: 1 } }
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search' })
    expect(response.statusCode).toBe(400)
  })
  it('returns matching users by firstName using real DB', async ({ expect }) => {
    const app = await createApp()
    const company = await createCompany(app, 'Search Test Company 1')
    const adminUser = { id: 1, email: 'admin@example.com', role: 'Admin', company: { id: company.id } }

    await app.prisma.user.create({
      data: {
        email: 'alice-search@test.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@alice-search',
        firstName: 'Alice',
        lastName: 'Johnson',
        phone: '+375299000001',
        memberId: 'DOM-SEARCH-0001',
        wallet: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        companyId: company.id,
      },
    })

    await app.prisma.user.create({
      data: {
        email: 'bob-search@test.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@bob-search',
        firstName: 'Bob',
        lastName: 'Smith',
        phone: '+375299000002',
        memberId: 'DOM-SEARCH-0002',
        wallet: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        companyId: company.id,
      },
    })

    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search?query=ali' })
    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(1)
    expect(response.json().users[0].firstName).toBe('Alice')
    expect(response.json().users[0].lastName).toBe('Johnson')
    expect(response.json().users[0]).toHaveProperty('level')
    expect(response.json().users[0]).toHaveProperty('id')
  })

  it('returns matching users by lastName using real DB', async ({ expect }) => {
    const app = await createApp()
    const company = await createCompany(app, 'Search Test Company 2')
    const adminUser = { id: 1, email: 'admin@example.com', role: 'Admin', company: { id: company.id } }

    await app.prisma.user.create({
      data: {
        email: 'charlie-search@test.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@charlie-search',
        firstName: 'Charlie',
        lastName: 'Brown',
        phone: '+375299000003',
        memberId: 'DOM-SEARCH-0003',
        wallet: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        companyId: company.id,
      },
    })

    await app.prisma.user.create({
      data: {
        email: 'diana-search@test.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@diana-search',
        firstName: 'Diana',
        lastName: 'Prince',
        phone: '+375299000004',
        memberId: 'DOM-SEARCH-0004',
        wallet: '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
        companyId: company.id,
      },
    })

    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search?query=brown' })
    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(1)
    expect(response.json().users[0].firstName).toBe('Charlie')
    expect(response.json().users[0].lastName).toBe('Brown')
  })

  it('returns empty array when no match', async ({ expect }) => {
    const app = await createApp()
    const company = await createCompany(app, 'Search Test Company 3')
    const adminUser = { id: 1, email: 'admin@example.com', role: 'Admin', company: { id: company.id } }

    await app.prisma.user.create({
      data: {
        email: 'eve-search@test.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@eve-search',
        firstName: 'Eve',
        lastName: 'Adams',
        phone: '+375299000005',
        memberId: 'DOM-SEARCH-0005',
        wallet: '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
        companyId: company.id,
      },
    })

    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search?query=xyzxyz' })
    expect(response.statusCode).toBe(200)
    expect(response.json().users).toEqual([])
  })

  it('search is case-insensitive', async ({ expect }) => {
    const app = await createApp()
    const company = await app.prisma.company.create({ data: { name: 'Search Test Company 4' } })
    const adminUser = { id: 1, email: 'admin@example.com', role: 'Admin', company: { id: company.id } }
    await app.prisma.user.create({
      data: {
        email: 'frank-search@test.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@frank-search',
        firstName: 'Frank',
        lastName: 'Miller',
        phone: '+375299000006',
        memberId: 'DOM-SEARCH-0006',
        wallet: '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        companyId: company.id,
      },
    })
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search?query=FRANK' })
    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(1)
    expect(response.json().users[0].firstName).toBe('Frank')
  })

  it('excludes admin users from results', async ({ expect }) => {
    const app = await createApp()
    const company = await app.prisma.company.create({ data: { name: 'Search Test Company 5' } })
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: company.id } }
    await app.prisma.user.create({
      data: {
        email: 'admin-search@test.com',
        password: 'hashed',
        role: 'Admin',
        nick: '@admin-search',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+375299000007',
        memberId: 'DOM-SEARCH-0007',
        wallet: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1',
        companyId: company.id,
      },
    })
    await app.prisma.user.create({
      data: {
        email: 'user-search@test.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@user-search',
        firstName: 'Admin',
        lastName: 'Candidate',
        phone: '+375299000008',
        memberId: 'DOM-SEARCH-0008',
        wallet: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        companyId: company.id,
      },
    })
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search?query=admin' })
    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(1)
    expect(response.json().users[0].role).toBeUndefined()
    expect(response.json().users[0].firstName).toBe('Admin')
    expect(response.json().users[0].lastName).toBe('Candidate')
  })

  it('scopes search to the admin company', async ({ expect }) => {
    const app = await createApp()
    const companyA = await app.prisma.company.create({ data: { name: 'Search Test Company A' } })
    const companyB = await app.prisma.company.create({ data: { name: 'Search Test Company B' } })
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: companyA.id } }
    await app.prisma.user.create({
      data: {
        email: 'grace-a@test.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@grace-a',
        firstName: 'Grace',
        lastName: 'Hopper',
        phone: '+375299000009',
        memberId: 'DOM-SEARCH-0009',
        wallet: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        companyId: companyA.id,
      },
    })
    await app.prisma.user.create({
      data: {
        email: 'grace-b@test.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@grace-b',
        firstName: 'Grace',
        lastName: 'Hopper',
        phone: '+375299000010',
        memberId: 'DOM-SEARCH-0010',
        wallet: '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
        companyId: companyB.id,
      },
    })
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search?query=grace' })
    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(1)
    expect(response.json().users[0].firstName).toBe('Grace')
    expect(response.json().users[0].lastName).toBe('Hopper')
  })

  it('returns up to 20 users', async ({ expect }) => {
    const app = await createApp()
    const company = await app.prisma.company.create({ data: { name: 'Search Test Company 6' } })
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: company.id } }
    for (let i = 0; i < 25; i++) {
      await app.prisma.user.create({
        data: {
          email: `bulk${i}@test.com`,
          password: 'hashed',
          role: 'Candidate',
          nick: `@bulk${i}`,
          firstName: 'Bulk',
          lastName: `User${i}`,
          phone: `+37529901${String(i).padStart(3, '0')}`,
          memberId: `DOM-SEARCH-BULK-${String(i).padStart(3, '0')}`,
          wallet: `0x${String(i).padStart(40, '0')}`,
          companyId: company.id,
        },
      })
    }
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const response = await app.inject({ method: 'GET', url: '/api/admin/clients/search?query=bulk' })
    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(20)
  })
})
