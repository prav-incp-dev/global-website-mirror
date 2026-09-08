import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { PAGE_LIMIT } from '../../../src/plugins/admin.js'

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
    expect(app.admin.getClients).toHaveBeenCalledWith(adminUser, 1, PAGE_LIMIT, '', false, 'id')
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
    expect(app.admin.getClients).toHaveBeenCalledWith(adminUser, 2, 5, 'John', false, 'id')
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
      limit: PAGE_LIMIT,
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
    expect(app.admin.getClients).toHaveBeenCalledWith(adminUser, 1, PAGE_LIMIT, '', false, 'id')
    expect(app.admin.getOrphansCount).toHaveBeenCalledWith(adminUser, '')
  })
})
