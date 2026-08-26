import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../helpers'
import { CLIENTS_PAGE_LIMIT } from '../../src/plugins/admin.js'

describe('PUT /api/admin/profile', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is not Admin', async () => {
    const nonAdminUser = {
      id: 1,
      email: 'user@example.com',
      role: 'Candidate',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(nonAdminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when firstName is missing', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/profile',
      payload: {
        lastName: 'Doe',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when lastName is missing', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/profile',
      payload: {
        firstName: 'John',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 500 on unexpected error', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.user, 'update').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления профиля' })
  })

  it('returns 200 and updates profile on success', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'Admin',
      company: { id: 1 },
    }

    const updatedAdmin = {
      id: 1,
      firstName: 'Jane',
      lastName: 'Smith',
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.user, 'update').mockResolvedValue(updatedAdmin)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/profile',
      payload: {
        firstName: 'Jane',
        lastName: 'Smith',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      profile: {
        id: 1,
        firstName: 'Jane',
        lastName: 'Smith',
      },
    })
    expect(app.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
      },
    })
  })
})

describe('PUT /api/admin/company', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is not Admin', async () => {
    const nonAdminUser = {
      id: 1,
      email: 'user@example.com',
      role: 'Candidate',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(nonAdminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when name is missing', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when primaryWallet has invalid format', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Test Company',
        primaryWallet: 'invalid-wallet',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('primaryWallet')
  })

  it('returns 400 when secondaryWallet has invalid format', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Test Company',
        secondaryWallet: 'invalid-wallet',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('secondaryWallet')
  })

  it('returns 409 when company name is already taken', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockError = new Error('Unique constraint failed')
    mockError.code = 'P2002'

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockRejectedValue(mockError)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Existing Company' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Компания с таким названием уже существует' })
  })

  it('returns 500 on unexpected error', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company' },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления компании' })
  })

  it('returns 200 and updates company on success', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const updatedCompany = {
      id: 1,
      name: 'Updated Company',
      primaryWallet: '0x1234567890abcdef1234567890abcdef12345678',
      secondaryWallet: null,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockResolvedValue(updatedCompany)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Updated Company',
        primaryWallet: '0x1234567890abcdef1234567890abcdef12345678',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      company: {
        id: 1,
        name: 'Updated Company',
        primaryWallet: '0x1234567890abcdef1234567890abcdef12345678',
        secondaryWallet: null,
      },
    })
    expect(app.prisma.company.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: 'Updated Company',
        primaryWallet: '0x1234567890abcdef1234567890abcdef12345678',
        secondaryWallet: null,
      },
    })
  })

  it('returns 200 when wallets are empty strings', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const updatedCompany = {
      id: 1,
      name: 'Test Company',
      primaryWallet: null,
      secondaryWallet: null,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockResolvedValue(updatedCompany)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Test Company',
        primaryWallet: '',
        secondaryWallet: '',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      company: {
        id: 1,
        name: 'Test Company',
        primaryWallet: null,
        secondaryWallet: null,
      },
    })
    expect(app.prisma.company.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: 'Test Company',
        primaryWallet: null,
        secondaryWallet: null,
      },
    })
  })
})

describe('GET /api/admin/clients', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is not Admin', async () => {
    const nonAdminUser = {
      id: 1,
      email: 'user@example.com',
      role: 'Candidate',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(nonAdminUser)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 200 with clients data', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockResult = {
      users: [
        { id: 1, firstName: 'John', lastName: 'Doe', level: 1, role: 'Consultant', email: 'john@test.com' },
        { id: 2, firstName: 'Jane', lastName: 'Smith', level: 0, role: 'Candidate', email: 'jane@test.com' },
      ],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.admin, 'getClients').mockResolvedValue(mockResult)
    vi.spyOn(app.admin, 'getOrphansCount').mockResolvedValue(5)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ...mockResult, orphansCount: 5 })
    expect(app.admin.getClients).toHaveBeenCalledWith(adminUser, 1, CLIENTS_PAGE_LIMIT, '', false)
    expect(app.admin.getOrphansCount).toHaveBeenCalledWith(adminUser, '')
  })

  it('passes query parameters to getClients', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockResult = {
      users: [],
      total: 0,
      page: 2,
      limit: 5,
      totalPages: 0,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.admin, 'getClients').mockResolvedValue(mockResult)
    vi.spyOn(app.admin, 'getOrphansCount').mockResolvedValue(3)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients?page=2&limit=5&query=John',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ...mockResult, orphansCount: 3 })
    expect(app.admin.getClients).toHaveBeenCalledWith(adminUser, 2, 5, 'John', false)
    expect(app.admin.getOrphansCount).toHaveBeenCalledWith(adminUser, 'John')
  })

  it('uses defaults when no query params provided', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockResult = {
      users: [],
      total: 0,
      page: 1,
      limit: CLIENTS_PAGE_LIMIT,
      totalPages: 0,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.admin, 'getClients').mockResolvedValue(mockResult)
    vi.spyOn(app.admin, 'getOrphansCount').mockResolvedValue(0)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ...mockResult, orphansCount: 0 })
    expect(app.admin.getClients).toHaveBeenCalledWith(adminUser, 1, CLIENTS_PAGE_LIMIT, '', false)
    expect(app.admin.getOrphansCount).toHaveBeenCalledWith(adminUser, '')
  })
})

describe('GET /api/admin/clients/search', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search?query=test',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 403 when user is not Admin', async () => {
    const nonAdminUser = {
      id: 1,
      email: 'user@example.com',
      role: 'Candidate',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(nonAdminUser)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search?query=test',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when query is too short', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search?query=a',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when query is missing', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns matching users by firstName using real DB', async () => {
    const app = await createApp()

    const company = await app.prisma.company.create({
      data: { name: 'Search Test Company 1', primaryWallet: '0x1111111111111111111111111111111111111111' },
    })

    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: company.id },
    }

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

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search?query=ali',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(1)
    expect(response.json().users[0].firstName).toBe('Alice')
    expect(response.json().users[0].lastName).toBe('Johnson')
    expect(response.json().users[0]).toHaveProperty('level')
    expect(response.json().users[0]).toHaveProperty('id')
  })

  it('returns matching users by lastName using real DB', async () => {
    const app = await createApp()

    const company = await app.prisma.company.create({
      data: { name: 'Search Test Company 2', primaryWallet: '0x2222222222222222222222222222222222222222' },
    })

    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: company.id },
    }

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

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search?query=brown',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(1)
    expect(response.json().users[0].firstName).toBe('Charlie')
    expect(response.json().users[0].lastName).toBe('Brown')
  })

  it('returns empty array when no match', async () => {
    const app = await createApp()

    const company = await app.prisma.company.create({
      data: { name: 'Search Test Company 3', primaryWallet: '0x3333333333333333333333333333333333333333' },
    })

    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: company.id },
    }

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

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search?query=xyzxyz',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().users).toEqual([])
  })

  it('search is case-insensitive', async () => {
    const app = await createApp()

    const company = await app.prisma.company.create({
      data: { name: 'Search Test Company 4', primaryWallet: '0x4444444444444444444444444444444444444444' },
    })

    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: company.id },
    }

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

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search?query=FRANK',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(1)
    expect(response.json().users[0].firstName).toBe('Frank')
  })

  it('excludes admin users from results', async () => {
    const app = await createApp()

    const company = await app.prisma.company.create({
      data: { name: 'Search Test Company 5', primaryWallet: '0x5555555555555555555555555555555555555555' },
    })

    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: company.id },
    }

    // Create an admin user in the DB
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

    // Create a non-admin user with similar name
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

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search?query=admin',
    })

    expect(response.statusCode).toBe(200)
    // Should only return the Candidate, not the Admin
    expect(response.json().users).toHaveLength(1)
    expect(response.json().users[0].role).toBeUndefined()
    expect(response.json().users[0].firstName).toBe('Admin')
    expect(response.json().users[0].lastName).toBe('Candidate')
  })

  it('scopes search to the admin company', async () => {
    const app = await createApp()

    const companyA = await app.prisma.company.create({
      data: { name: 'Search Test Company A', primaryWallet: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1' },
    })

    const companyB = await app.prisma.company.create({
      data: { name: 'Search Test Company B', primaryWallet: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' },
    })

    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: companyA.id },
    }

    // User in company A
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

    // User in company B (should not appear)
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

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search?query=grace',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(1)
    expect(response.json().users[0].firstName).toBe('Grace')
    expect(response.json().users[0].lastName).toBe('Hopper')
  })

  it('returns up to 20 users', async () => {
    const app = await createApp()

    const company = await app.prisma.company.create({
      data: { name: 'Search Test Company 6', primaryWallet: '0x6666666666666666666666666666666666666666' },
    })

    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: company.id },
    }

    // Create 25 users with the same firstName
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

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/search?query=bulk',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().users).toHaveLength(20)
  })
})

describe('PUT /api/admin/user/parent', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: 1,
        parentId: 2,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is not Admin', async () => {
    const nonAdminUser = {
      id: 1,
      email: 'user@example.com',
      role: 'Candidate',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(nonAdminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: 2,
        parentId: 3,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when userId is missing', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        parentId: 2,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when parentId is a string', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: 2,
        parentId: 'abc',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('parentId')
  })

  it('returns 404 when target user does not exist', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: 99999,
        parentId: 2,
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Пользователь не найден' })
  })

  it('returns 400 when userId equals parentId', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()

    const company = await app.prisma.company.create({
      data: { name: 'Self Parent Test Company', primaryWallet: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2' },
    })

    const user = await app.prisma.user.create({
      data: {
        email: `self-parent-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Self',
        lastName: 'Parent',
        phone: '+375291000001',
        companyId: company.id,
      },
    })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: user.id,
        parentId: user.id,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Пользователь не может быть собственным родителем' })
  })

  it('returns 403 when target user is in a different company', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()

    const companyA = await app.prisma.company.create({
      data: { name: 'Company A for Cross Company', primaryWallet: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' },
    })

    const companyB = await app.prisma.company.create({
      data: { name: 'Company B for Cross Company', primaryWallet: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC' },
    })

    const userInCompanyB = await app.prisma.user.create({
      data: {
        email: `cross-company-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Cross',
        lastName: 'Company',
        phone: '+375291000002',
        companyId: companyB.id,
      },
    })

    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: userInCompanyB.id,
        parentId: null,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 404 when parent user does not exist', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()

    const company = await app.prisma.company.create({
      data: { name: 'Parent Not Found Company', primaryWallet: '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD' },
    })

    const user = await app.prisma.user.create({
      data: {
        email: `parent-not-found-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Parent',
        lastName: 'NotFound',
        phone: '+375291000003',
        companyId: company.id,
      },
    })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: user.id,
        parentId: 99999,
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Родительский пользователь не найден' })
  })

  it('returns 403 when parent user is in a different company', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()

    const companyA = await app.prisma.company.create({
      data: { name: 'Parent Cross Company A', primaryWallet: '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE' },
    })

    const companyB = await app.prisma.company.create({
      data: { name: 'Parent Cross Company B', primaryWallet: '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' },
    })

    const userInCompanyA = await app.prisma.user.create({
      data: {
        email: `parent-cross-a-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Parent',
        lastName: 'CrossA',
        phone: '+375291000004',
        companyId: companyA.id,
      },
    })

    const parentInCompanyB = await app.prisma.user.create({
      data: {
        email: `parent-cross-b-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'Parent',
        lastName: 'CrossB',
        phone: '+375291000005',
        companyId: companyB.id,
      },
    })

    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: userInCompanyA.id,
        parentId: parentInCompanyB.id,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })
  it('successfully updates parentId to a valid user', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()

    const company = await app.prisma.company.create({
      data: { name: 'Success Parent Update Company', primaryWallet: '0x1111111111111111111111111111111111111111' },
    })

    const targetUser = await app.prisma.user.create({
      data: {
        email: `update-target-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Target',
        lastName: 'User',
        phone: '+375291000006',
        companyId: company.id,
      },
    })

    const parentUser = await app.prisma.user.create({
      data: {
        email: `update-parent-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'Parent',
        lastName: 'User',
        phone: '+375291000007',
        companyId: company.id,
      },
    })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: targetUser.id,
        parentId: parentUser.id,
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.user.id).toBe(targetUser.id)
    expect(body.user.parentId).toBe(parentUser.id)
    expect(body.user.firstName).toBe('Target')
    expect(body.user.lastName).toBe('User')

    // Verify the database was actually updated
    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.parentId).toBe(parentUser.id)
  })

  it('successfully sets parentId to null', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()

    const company = await app.prisma.company.create({
      data: { name: 'Null Parent Update Company', primaryWallet: '0x2222222222222222222222222222222222222222' },
    })

    const parentUser = await app.prisma.user.create({
      data: {
        email: `null-parent-parent-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'Original',
        lastName: 'Parent',
        phone: '+375291000008',
        companyId: company.id,
      },
    })

    const targetUser = await app.prisma.user.create({
      data: {
        email: `null-parent-target-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Target',
        lastName: 'Null',
        phone: '+375291000009',
        companyId: company.id,
        parentId: parentUser.id,
      },
    })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: targetUser.id,
        parentId: null,
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.user.id).toBe(targetUser.id)
    expect(body.user.parentId).toBeNull()

    // Verify the database was actually updated
    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.parentId).toBeNull()
  })

  it('returns 500 on unexpected database error', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.user, 'findUnique').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: {
        userId: 1,
        parentId: 2,
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления родителя' })
  })
})
describe('PUT /api/admin/user', () => {
  const createAdminUser = () => ({
    id: 1,
    email: 'admin@test.com',
    role: 'Admin',
    company: { id: 1 },
  })

  const createCompany = async (app, name, wallet) => {
    return app.prisma.company.create({
      data: { name, primaryWallet: wallet },
    })
  }

  const createUser = async (app, overrides = {}) => {
    const { emailPrefix, ...data } = overrides
    return app.prisma.user.create({
      data: {
        email: `${emailPrefix || 'user'}-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'Target',
        lastName: 'User',
        phone: `+375291${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
        level: 1,
        levelConfirmed: true,
        score: 10,
        ...data,
      },
    })
  }

  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: 1, level: 2 },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 403 when user is not Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({
      id: 1,
      email: 'candidate@test.com',
      role: 'Candidate',
      company: { id: 1 },
    })

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: 1, level: 2 },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when userId is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { level: 2 },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when no updatable fields are provided', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Empty Fields Company', '0x9999999999999999999999999999999999999999')

    const targetUser = await createUser(app, { companyId: company.id })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: targetUser.id },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Нет полей для обновления' })
  })

  it('returns 400 when level is below minimum', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: 1, level: 0 },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when level is above maximum', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: 1, level: 11 },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when score is negative', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: 1, score: -1 },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when target user does not exist', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Not Found Company', '0x1111111111111111111111111111111111111111')
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: 999999, level: 2 },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Пользователь не найден' })
  })

  it('returns 403 when target user is in a different company', async () => {
    const app = await createApp()
    const companyA = await createCompany(app, 'Company A', '0x2222222222222222222222222222222222222222')
    const companyB = await createCompany(app, 'Company B', '0x3333333333333333333333333333333333333333')

    const targetUser = await createUser(app, { companyId: companyB.id })

    const adminUser = createAdminUser()
    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: targetUser.id, level: 2 },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when target user is not a Consultant', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Non Consultant Company', '0x4444444444444444444444444444444444444444')

    const targetUser = await createUser(app, {
      companyId: company.id,
      emailPrefix: 'candidate',
      role: 'Candidate',
    })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: targetUser.id, level: 2 },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Обновлять уровень можно только консультантам' })
  })

  it('successfully updates all three fields', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Update All Company', '0x5555555555555555555555555555555555555555')

    const targetUser = await createUser(app, { companyId: company.id })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: targetUser.id, level: 3, levelConfirmed: false, score: 150 },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.user.id).toBe(targetUser.id)
    expect(body.user.level).toBe(3)
    expect(body.user.levelConfirmed).toBe(false)
    expect(body.user.score).toBe(150)

    // Verify the database was actually updated
    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.level).toBe(3)
    expect(updatedUser.levelConfirmed).toBe(false)
    expect(updatedUser.score).toBe(150)
  })

  it('successfully updates only level, leaving other fields unchanged', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Partial Level Company', '0x6666666666666666666666666666666666666666')

    const targetUser = await createUser(app, { companyId: company.id })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: targetUser.id, level: 4 },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.user.level).toBe(4)
    expect(body.user.levelConfirmed).toBe(true)
    expect(body.user.score).toBe(10)

    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.level).toBe(4)
    expect(updatedUser.levelConfirmed).toBe(true)
    expect(updatedUser.score).toBe(10)
  })

  it('successfully updates only levelConfirmed to false', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Partial Confirmed Company', '0x7777777777777777777777777777777777777777')

    const targetUser = await createUser(app, { companyId: company.id })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: targetUser.id, levelConfirmed: false },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.user.levelConfirmed).toBe(false)
    expect(body.user.level).toBe(1)
    expect(body.user.score).toBe(10)

    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.levelConfirmed).toBe(false)
  })

  it('successfully updates only score', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Partial Score Company', '0x8888888888888888888888888888888888888888')

    const targetUser = await createUser(app, { companyId: company.id })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: targetUser.id, score: 250 },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.user.score).toBe(250)
    expect(body.user.level).toBe(1)
    expect(body.user.levelConfirmed).toBe(true)

    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.score).toBe(250)
  })

  it('returns 500 on unexpected database error', async () => {
    const app = await createApp()
    const adminUser = createAdminUser()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.user, 'findUnique').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user',
      payload: { userId: 1, level: 2 },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления пользователя' })
  })
})
