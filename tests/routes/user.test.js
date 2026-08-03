import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../helpers'
import { UserRole } from '../../src/generated/prisma/client'

describe('PUT /api/user/profile', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'DOM-00000000-1234',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is an Admin', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: UserRole.Admin,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'DOM-00000000-1234',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when firstName is missing', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'DOM-00000000-1234',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when lastName is missing', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        phone: '+375291234567',
        memberId: 'DOM-00000000-1234',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when phone is missing', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        memberId: 'DOM-00000000-1234',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when memberId is missing', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 for invalid phone format', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: 'invalid-phone',
        memberId: 'DOM-00000000-1234',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
  })

  it('returns 400 for invalid wallet format', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'DOM-00000000-1234',
        wallet: 'invalid-wallet',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
  })

  it('returns 400 for invalid memberId format', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'not-4-digits',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
  })

  it('returns 409 for duplicate memberId', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const duplicateMemberIdError = Object.assign(new Error('Unique constraint failed on the fields: (`memberId`)'), {
      code: 'P2002',
      meta: { target: ['memberId'] },
    })

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)
    vi.spyOn(app.prisma.user, 'update').mockRejectedValue(duplicateMemberIdError)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'DOM-00000000-1111',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Номер пайщика уже есть в системе' })
  })

  it('returns 409 for duplicate nick', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const duplicateNickError = Object.assign(new Error('Unique constraint failed on the fields: (`nick`)'), {
      code: 'P2002',
      meta: { target: ['nick'] },
    })

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)
    vi.spyOn(app.prisma.user, 'update').mockRejectedValue(duplicateNickError)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'DOM-00000000-1234',
        nick: 'existing-nick',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Ник уже есть в системе' })
  })

  it('returns 409 for duplicate wallet', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const duplicateWalletError = Object.assign(new Error('Unique constraint failed on the fields: (`wallet`)'), {
      code: 'P2002',
      meta: { target: ['wallet'] },
    })

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)
    vi.spyOn(app.prisma.user, 'update').mockRejectedValue(duplicateWalletError)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'DOM-00000000-1234',
        wallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Кошелек уже есть в системе' })
  })

  it('returns 409 with generic field label when P2002 message has no backtick field', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const p2002NoFieldError = Object.assign(new Error('Constraint violation'), {
      code: 'P2002',
    })

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)
    vi.spyOn(app.prisma.user, 'update').mockRejectedValue(p2002NoFieldError)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'DOM-00000000-1234',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Поле уже есть в системе' })
  })

  it('returns 500 on unexpected database error', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)
    vi.spyOn(app.prisma.user, 'update').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'DOM-00000000-1234',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления профиля' })
  })

  it('returns 200 and updates profile on success with all fields', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const updatedUser = {
      id: 1,
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+375297654321',
      memberId: 'DOM-00000000-4567',
      nick: 'janesmith',
      wallet: '0x1234567890abcdef1234567890abcdef12345678',
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)
    vi.spyOn(app.prisma.user, 'update').mockResolvedValue(updatedUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+375297654321',
        memberId: 'DOM-00000000-4567',
        nick: 'janesmith',
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      profile: updatedUser,
    })
    expect(app.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+375297654321',
        memberId: 'DOM-00000000-4567',
        nick: 'janesmith',
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
      },
    })
  })

  it('returns 200 and updates profile on success with only required fields', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const updatedUser = {
      id: 1,
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+375297654321',
      memberId: 'DOM-00000000-4567',
      nick: null,
      wallet: null,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(regularUser)
    vi.spyOn(app.prisma.user, 'update').mockResolvedValue(updatedUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+375297654321',
        memberId: 'DOM-00000000-4567',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      profile: updatedUser,
    })
    expect(app.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+375297654321',
        memberId: 'DOM-00000000-4567',
        nick: null,
        wallet: null,
      },
    })
  })
})
