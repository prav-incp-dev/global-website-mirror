import { beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { buildBackendApp } from '../../backend'
import { UserRole } from '@/generated/prisma/client'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

const createApp = async () => {
  const app = await buildBackendApp({
    logger: false,
    auth: {
      enableCsrf: false,
    },
  })
  onTestFinished(async () => {
    await app.close()
  })
  return app
}

describe('POST /api/invitation/generate', () => {
  it('returns 401 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/invitation/generate',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Доступно только авторизованным пользователям' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns a token with owner=null for Admin user', async () => {
    const adminUser = {
      id: 1,
      role: UserRole.Admin,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: '/api/invitation/generate',
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body).toHaveProperty('token')
    expect(typeof body.token).toBe('string')

    // Decode the JWT and verify its payload
    const decoded = jwt.verify(body.token, SESSION_SECRET)
    expect(decoded.owner).toBeNull()
    expect(decoded).toHaveProperty('inviteCode')
    expect(typeof decoded.inviteCode).toBe('string')
    expect(decoded.inviteCode).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(decoded).toHaveProperty('exp')
    expect(decoded).toHaveProperty('iat')
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns a token with owner=userId for non-Admin user', async () => {
    const nonAdminUser = {
      id: 5,
      role: UserRole.Candidate,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(nonAdminUser)

    const response = await app.inject({
      method: 'POST',
      url: '/api/invitation/generate',
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body).toHaveProperty('token')
    expect(typeof body.token).toBe('string')

    // Decode the JWT and verify its payload
    const decoded = jwt.verify(body.token, SESSION_SECRET)
    expect(decoded.owner).toBe(5)
    expect(decoded).toHaveProperty('inviteCode')
    expect(typeof decoded.inviteCode).toBe('string')
    expect(decoded.inviteCode).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(decoded).toHaveProperty('exp')
    expect(decoded).toHaveProperty('iat')
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })
})
