import { beforeAll, describe, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { createApp } from '../helpers'

const SESSION_SECRET = 'test-secret'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('register plugin', () => {
  it('createUser creates a user and removes password from result', async ({ expect }) => {
    const app = await createApp()

    const email = `create-user-${Date.now()}@test.com`
    const phone = `+10000001${String(Date.now()).slice(-4)}`
    const inviteCode = `invite-${Date.now()}`

    const result = await app.registration.createUser({
      email,
      firstName: 'New',
      phone,
      password: 'plainpassword',
      inviteCode,
    })

    // Verify password is not in the result
    expect(result).not.toHaveProperty('password')

    // Verify the user was actually created in the DB
    const dbUser = await app.prisma.user.findUnique({ where: { id: result.id } })
    expect(dbUser).not.toBeNull()
    expect(dbUser.email).toBe(email)
    expect(dbUser.firstName).toBe('New')
    expect(dbUser.role).toBe('Candidate')
    // Password should be hashed, not plaintext
    expect(dbUser.password).not.toBe('plainpassword')
    expect(dbUser.password).toBeDefined()

    // Verify the usedInvite was created
    const usedInvite = await app.prisma.usedInvite.findUnique({ where: { code: inviteCode } })
    expect(usedInvite).not.toBeNull()

    // Verify the interaction was created
    const interaction = await app.prisma.interaction.findFirst({
      where: { targetId: result.id, description: 'Registration' },
    })
    expect(interaction).not.toBeNull()
    expect(interaction.status).toBe('Closed')
    expect(interaction.initiatorId).toBeNull()
  })

  it('createUser throws error when inviteCode is already taken', async ({ expect }) => {
    const app = await createApp()

    const inviteCode = `already-used-${Date.now()}`

    // Create a used invite record first
    await app.prisma.usedInvite.create({ data: { code: inviteCode } })

    await expect(
      app.registration.createUser({
        email: `duplicate-invite-${Date.now()}@test.com`,
        firstName: 'New',
        phone: `+10000002${String(Date.now()).slice(-4)}`,
        password: 'plainpassword',
        inviteCode,
      }),
    ).rejects.toThrow('Unique constraint failed')
  })

  it('createUser throws error when no company found', async ({ expect }) => {
    const app = await createApp()

    // The seed data creates a company, so we mock findFirst to simulate
    // the scenario where no company exists. This is analogous to mocking
    // app.auth.getUser in the interaction route tests — we mock the
    // guard condition while the rest of the test infrastructure is real.
    vi.spyOn(app.prisma.company, 'findFirst').mockResolvedValue(null)

    await expect(
      app.registration.createUser({
        email: `no-company-${Date.now()}@test.com`,
        firstName: 'New',
        phone: `+10000003${String(Date.now()).slice(-4)}`,
        password: 'plainpassword',
        inviteCode: `invite-no-company-${Date.now()}`,
      }),
    ).rejects.toThrow('No company found')
  })

  it('verifyToken returns inviteCode and owner for valid token', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(jwt, 'verify').mockReturnValue({ inviteCode: 'abc123', owner: 1 })

    const result = await app.registration.verifyToken('valid-token')

    expect(result).toEqual({ inviteCode: 'abc123', owner: 1 })
  })

  it('verifyToken throws error for invalid token (no inviteCode)', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(jwt, 'verify').mockReturnValue({ owner: '1' })

    await expect(app.registration.verifyToken('invalid-token')).rejects.toThrow('Invalid token')
  })

  it('verifyToken throws error when jwt.verify throws', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('jwt malformed')
    })

    await expect(app.registration.verifyToken('malformed-token')).rejects.toThrow('jwt malformed')
  })

  it('verifyToken throws error when invite is already used', async ({ expect }) => {
    const app = await createApp()

    const inviteCode = `used-code-${Date.now()}`

    // Create a real UsedInvite record in the DB
    await app.prisma.usedInvite.create({ data: { code: inviteCode } })

    vi.spyOn(jwt, 'verify').mockReturnValue({ inviteCode, owner: '1' })

    await expect(app.registration.verifyToken('used-token')).rejects.toThrow('Invite already used')
  })
})
