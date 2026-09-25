import { describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createNoCsrfApp as createApp } from '../helpers'

describe('auth routes', () => {
  it('POST /api/auth/login returns 400 when email or password is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'login')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: '' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
    expect(app.auth.login).not.toHaveBeenCalled()
  })

  it('POST /api/auth/login returns 401 when credentials are invalid', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'login').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@example.com',
        password: 'wrong-password',
      },
    })

    expect(app.auth.login).toHaveBeenCalledWith('admin@example.com', 'wrong-password')
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Неверный адрес или пароль',
    })
    vi.spyOn(app.auth, 'createTwoFactorCode')
    vi.spyOn(app.auth, 'setSession')
    expect(app.auth.createTwoFactorCode).not.toHaveBeenCalled()
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/auth/login returns 200 with token and sends email with confirmation code', async () => {
    // Clean up any previous email fixture
    const fixturePath = path.join(__dirname, '../fixtures', 'last-email.json')
    if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath)

    const user = { id: 1, email: 'admin@example.com' }
    const app = await createApp()
    vi.spyOn(app.auth, 'login').mockResolvedValue(user)
    vi.spyOn(app.auth, 'createTwoFactorCode').mockResolvedValue('123456')
    vi.spyOn(app.auth, 'signPendingAuth').mockReturnValue('mock-jwt-token')
    vi.spyOn(app.auth, 'setSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@example.com',
        password: 'password',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      token: 'mock-jwt-token',
    })
    expect(app.auth.createTwoFactorCode).toHaveBeenCalledWith(user)
    expect(app.auth.signPendingAuth).toHaveBeenCalledWith(1, 600)
    expect(app.auth.setSession).not.toHaveBeenCalled()

    // Verify email was sent
    const emailContent = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
    expect(emailContent.subject).toBe('Код подтверждения для входа в систему')
    expect(emailContent.to).toBe(user.email)
    expect(emailContent.text).toContain('123456')
  })

  it('POST /api/auth/confirm returns 400 when token or code is missing', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/confirm',
      payload: { code: '123456' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('POST /api/auth/confirm returns 401 when token is invalid', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'verifyPendingAuth').mockReturnValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/confirm',
      payload: { token: 'invalid-token', code: '123456' },
    })

    expect(app.auth.verifyPendingAuth).toHaveBeenCalledWith('invalid-token')
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Неверный код или время истекло',
    })
    vi.spyOn(app.auth, 'verifyTwoFactorCode')
    vi.spyOn(app.auth, 'setSession')
    expect(app.auth.verifyTwoFactorCode).not.toHaveBeenCalled()
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/auth/confirm returns 401 when code is invalid', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'verifyPendingAuth').mockReturnValue(1)
    vi.spyOn(app.auth, 'verifyTwoFactorCode').mockResolvedValue(false)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/confirm',
      payload: { token: 'valid-token', code: 'wrong-code' },
    })

    expect(app.auth.verifyTwoFactorCode).toHaveBeenCalledWith(1, 'wrong-code')
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Неверный код или время истекло',
    })
    vi.spyOn(app.auth, 'setSession')
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/auth/confirm returns 200 and sets session on valid code', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'verifyPendingAuth').mockReturnValue(1)
    vi.spyOn(app.auth, 'verifyTwoFactorCode').mockResolvedValue(true)
    vi.spyOn(app.auth, 'setSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/confirm',
      payload: { token: 'valid-token', code: '123456' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      redirect: '/home',
    })
    expect(app.auth.verifyTwoFactorCode).toHaveBeenCalledWith(1, '123456')
    expect(app.auth.setSession).toHaveBeenCalledTimes(1)
    expect(app.auth.setSession).toHaveBeenCalledWith(expect.anything(), 1)
  })

  it('POST /api/auth/resend returns 400 when token is missing', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/resend',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('POST /api/auth/resend returns 401 when token is invalid', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'verifyPendingAuth').mockReturnValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/resend',
      payload: { token: 'invalid-token' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Неверный код или время истекло',
    })
  })

  it('POST /api/auth/resend returns 401 when user does not exist', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'verifyPendingAuth').mockReturnValue(1)

    // Mock fastify.prisma.user.findUnique to return null, simulating a non-existent user
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/resend',
      payload: { token: 'valid-token' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Неверный код или время истекло',
    })
    expect(app.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    })
    vi.spyOn(app.auth, 'createTwoFactorCode')
    expect(app.auth.createTwoFactorCode).not.toHaveBeenCalled()
  })

  it('POST /api/auth/resend returns 200 and sends new code when user exists', async () => {
    const user = { id: 1, email: 'admin@example.com' }
    const app = await createApp()
    vi.spyOn(app.auth, 'verifyPendingAuth').mockReturnValue(1)
    vi.spyOn(app.auth, 'createTwoFactorCode').mockResolvedValue('654321')
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(user)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/resend',
      payload: { token: 'valid-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true })
    expect(app.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    })
    expect(app.auth.createTwoFactorCode).toHaveBeenCalledWith(user)
  })

  it('POST /api/auth/forgot-password returns 400 when email is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.prisma.user, 'findUnique')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
    expect(app.prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('POST /api/auth/forgot-password returns 200 and sends reset email when user exists', async () => {
    const fixturePath = path.join(__dirname, '../fixtures', 'last-email.json')
    if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath)

    const user = { id: 1, email: 'admin@example.com', firstName: 'Alice' }
    const app = await createApp()
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(user)
    vi.spyOn(app.auth, 'signPendingAuth').mockReturnValue('mock-reset-token')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'admin@example.com' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true })
    expect(app.prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'admin@example.com' } })
    expect(app.auth.signPendingAuth).toHaveBeenCalledWith(1, 3600)

    const emailContent = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
    expect(emailContent.subject).toBe('Сброс пароля')
    expect(emailContent.to).toBe(user.email)
  })

  it('POST /api/auth/forgot-password returns 200 even when user does not exist', async () => {
    const app = await createApp()
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(null)
    vi.spyOn(app.auth, 'signPendingAuth')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'nonexistent@example.com' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true })
    expect(app.auth.signPendingAuth).not.toHaveBeenCalled()
  })

  it('POST /api/auth/reset-password returns 400 when token or password is missing', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: 'some-token' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('POST /api/auth/reset-password returns 400 when password is too short', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: 'some-token', password: '12345' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('POST /api/auth/reset-password returns 400 when token is invalid', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'verifyPendingAuth').mockReturnValue(null)
    vi.spyOn(app.prisma.user, 'update')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: 'expired-token', password: 'newpassword' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'Ссылка недействительна или срок её действия истёк',
    })
    expect(app.prisma.user.update).not.toHaveBeenCalled()
  })

  it('POST /api/auth/reset-password returns 200 on success', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'verifyPendingAuth').mockReturnValue(1)
    vi.spyOn(app.prisma.user, 'update').mockResolvedValue({ id: 1 })

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: 'valid-token', password: 'newpassword' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true })
    expect(app.auth.verifyPendingAuth).toHaveBeenCalledWith('valid-token')
    expect(app.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { password: expect.any(String) },
      }),
    )
  })

  it('POST /api/auth/logout returns 200 and clears session', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'clearSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      redirect: '/auth',
    })
    expect(app.auth.clearSession).toHaveBeenCalledTimes(1)
    expect(app.auth.clearSession).toHaveBeenCalledWith(expect.anything())
  })
})
