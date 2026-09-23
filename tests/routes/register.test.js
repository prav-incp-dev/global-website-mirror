import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../helpers'
import fs from 'fs'
import path from 'path'

const lastEmailFixturePath = path.join(import.meta.dirname, '../fixtures/last-email.json')

describe('register routes', () => {
  it('POST /api/register returns 400 when required fields are missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'setSession')
    vi.spyOn(app.registration, 'createUser')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'new.user@example.com',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
    expect(app.registration.createUser).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 400 for invalid email format', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'setSession')
    vi.spyOn(app.registration, 'createUser')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'invalid-email',
        firstName: 'New',
        phone: '+375291234567',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
    expect(app.registration.createUser).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 400 for invalid phone number', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'setSession')
    vi.spyOn(app.registration, 'createUser')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'another.unique.user@example.com',
        firstName: 'New',
        phone: 'abc',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
    expect(app.registration.createUser).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 for duplicate email', async () => {
    const duplicateEmailError = Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
      code: 'P2002',
      meta: { target: ['email'] },
    })

    const app = await createApp()
    vi.spyOn(app.registration, 'verifyToken').mockResolvedValue({ inviteCode: 'test-jti', owner: null })
    vi.spyOn(app.registration, 'createUser').mockRejectedValue(duplicateEmailError)
    vi.spyOn(app.auth, 'setSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'admin@example.com',
        firstName: 'Another',
        phone: '+375291234568',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Электронная почта уже есть в системе',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 for duplicate phone number', async () => {
    const duplicatePhoneError = Object.assign(new Error('Unique constraint failed on the fields: (`phone`)'), {
      code: 'P2002',
      meta: { target: ['phone'] },
    })

    const app = await createApp()
    vi.spyOn(app.registration, 'verifyToken').mockResolvedValue({ inviteCode: 'test-jti', owner: null })
    vi.spyOn(app.registration, 'createUser').mockRejectedValue(duplicatePhoneError)
    vi.spyOn(app.auth, 'setSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'new.user@example.com',
        firstName: 'New',
        phone: '+375291234569',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Номер телефона уже есть в системе',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 for duplicate invite code', async () => {
    const duplicateCodeError = Object.assign(new Error('Unique constraint failed on the fields: (`code`)'), {
      code: 'P2002',
      meta: { target: ['code'] },
    })

    const app = await createApp()
    vi.spyOn(app.registration, 'verifyToken').mockResolvedValue({ inviteCode: 'test-jti', owner: null })
    vi.spyOn(app.registration, 'createUser').mockRejectedValue(duplicateCodeError)
    vi.spyOn(app.auth, 'setSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'new.user@example.com',
        firstName: 'New',
        phone: '+375291234575',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Приглашенный уже есть в системе',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 with raw field name for unknown P2002 field', async () => {
    const unknownFieldError = Object.assign(new Error('Unique constraint failed on the fields: (`wallet`)'), {
      code: 'P2002',
      meta: { target: ['wallet'] },
    })

    const app = await createApp()
    vi.spyOn(app.registration, 'verifyToken').mockResolvedValue({ inviteCode: 'test-jti', owner: null })
    vi.spyOn(app.registration, 'createUser').mockRejectedValue(unknownFieldError)
    vi.spyOn(app.auth, 'setSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'new.user@example.com',
        firstName: 'New',
        phone: '+375291234576',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'wallet уже есть в системе',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 with generic field label when P2002 message has no backtick field', async () => {
    const p2002NoFieldError = Object.assign(new Error('Constraint violation'), {
      code: 'P2002',
    })

    const app = await createApp()
    vi.spyOn(app.registration, 'verifyToken').mockResolvedValue({ inviteCode: 'test-jti', owner: null })
    vi.spyOn(app.registration, 'createUser').mockRejectedValue(p2002NoFieldError)
    vi.spyOn(app.auth, 'setSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'user@example.com',
        firstName: 'New',
        phone: '+375291234580',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Поле уже есть в системе',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 500 when createUser returns falsy', async () => {
    const app = await createApp()
    vi.spyOn(app.registration, 'verifyToken').mockResolvedValue({ inviteCode: 'test-jti', owner: null })
    vi.spyOn(app.registration, 'createUser').mockResolvedValue(null)
    vi.spyOn(app.auth, 'setSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'new.user@example.com',
        firstName: 'New',
        phone: '+375291234572',
        password: 'password123',
        token: 'some-token',
      },
    })
    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка регистрации' })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 500 when parentId does not point to an existing user', async () => {
    const foreignKeyError = Object.assign(new Error('Foreign key constraint failed on the field: parentId'), {
      code: 'P2003',
    })

    const app = await createApp()
    vi.spyOn(app.registration, 'verifyToken').mockResolvedValue({ inviteCode: 'test-jti', owner: null })
    vi.spyOn(app.registration, 'createUser').mockRejectedValue(foreignKeyError)
    vi.spyOn(app.auth, 'setSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'new.user@example.com',
        firstName: 'New',
        phone: '+375291234577',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Foreign key constraint failed on the field: parentId' })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 500 with error message on non-P2002 error', async () => {
    const app = await createApp()
    vi.spyOn(app.registration, 'verifyToken').mockResolvedValue({ inviteCode: 'test-jti', owner: null })
    vi.spyOn(app.registration, 'createUser').mockRejectedValue(new Error('Database connection error'))
    vi.spyOn(app.auth, 'setSession')

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: {
        email: 'new.user@example.com',
        firstName: 'New',
        phone: '+375291234573',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Database connection error' })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(app.auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 200 with success message on success', async () => {
    if (fs.existsSync(lastEmailFixturePath)) fs.unlinkSync(lastEmailFixturePath)

    const app = await createApp()
    vi.spyOn(app.registration, 'verifyToken').mockResolvedValue({ inviteCode: 'test-jti', owner: null })
    vi.spyOn(app.registration, 'createUser').mockResolvedValue({
      id: 42,
      email: 'new.user@example.com',
      firstName: 'New',
    })
    vi.spyOn(app.auth, 'setSession')

    const payload = {
      email: 'new.user@example.com',
      firstName: 'New',
      phone: '+375291234574',
      password: 'password123',
      token: 'some-token',
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      message: 'Регистрация прошла успешно',
    })
    expect(app.registration.createUser).toHaveBeenCalledWith({
      email: payload.email,
      firstName: payload.firstName,
      phone: payload.phone,
      password: payload.password,
      parentId: null,
      inviteCode: 'test-jti',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(app.auth.setSession).not.toHaveBeenCalled()

    expect(fs.existsSync(lastEmailFixturePath)).toBe(true)
    const emailContent = JSON.parse(fs.readFileSync(lastEmailFixturePath, 'utf-8'))
    expect(emailContent.to).toBe(payload.email)
    expect(emailContent.subject).toBe('Добро пожаловать в Международный клуб участников!')
    expect(emailContent.text).toContain(`Здравствуйте ${payload.firstName}!`)
    expect(emailContent.text).toContain('/auth')
  })
})
