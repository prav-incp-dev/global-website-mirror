import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { PAGE_LIMIT } from '../../../src/lib/constants.js'

describe('GET /api/admin/payments', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/payments',
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
      url: '/api/admin/payments',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 200 with payments data', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockResult = {
      payments: [
        {
          payment: {
            id: 1,
            amount: 1200,
            status: 'Completed',
            txHash: '0xabc',
            uid: 'ON-1234-01',
            createdAt: new Date().toISOString(),
            userName: 'John Doe',
          },
        },
        {
          payment: {
            id: 2,
            amount: 600,
            status: 'Pending',
            txHash: '0xdef',
            uid: null,
            createdAt: new Date().toISOString(),
            userName: 'Jane Smith',
          },
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.admin, 'getPayments').mockResolvedValue(mockResult)
    vi.spyOn(app.admin, 'getToRefundCount').mockResolvedValue(3)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/payments',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ...mockResult, toRefundCount: 3 })
    expect(app.admin.getPayments).toHaveBeenCalledWith(adminUser, 1, PAGE_LIMIT, '', false, 'id')
    expect(app.admin.getToRefundCount).toHaveBeenCalledWith(adminUser, '')
  })

  it('passes query parameters to getPayments', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockResult = {
      payments: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.admin, 'getPayments').mockResolvedValue(mockResult)
    vi.spyOn(app.admin, 'getToRefundCount').mockResolvedValue(5)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/payments?page=2&limit=10&query=John&toRefundOnly=true&sortBy=amount',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ...mockResult, toRefundCount: 5 })
    expect(app.admin.getPayments).toHaveBeenCalledWith(adminUser, 2, 10, 'John', true, 'amount')
    expect(app.admin.getToRefundCount).toHaveBeenCalledWith(adminUser, 'John')
  })

  it('uses defaults when no query params provided', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockResult = {
      payments: [],
      total: 0,
      page: 1,
      limit: PAGE_LIMIT,
      totalPages: 0,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.admin, 'getPayments').mockResolvedValue(mockResult)
    vi.spyOn(app.admin, 'getToRefundCount').mockResolvedValue(0)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/payments',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ...mockResult, toRefundCount: 0 })
    expect(app.admin.getPayments).toHaveBeenCalledWith(adminUser, 1, PAGE_LIMIT, '', false, 'id')
    expect(app.admin.getToRefundCount).toHaveBeenCalledWith(adminUser, '')
  })
})
