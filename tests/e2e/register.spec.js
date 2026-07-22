import { test, expect } from './fixtures.js'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { resetDatabase, getPrisma } from './db.js'

const SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-not-for-production'
const BASE_URL = 'http://127.0.0.1:3101'

const generateInviteToken = ({ owner, inviteCode, expiresIn = '24h' }) => {
  return jwt.sign({ owner, inviteCode }, SESSION_SECRET, { expiresIn })
}

test.describe('registration flow', () => {
  test('redirects to /auth when accessing /register without a token', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(`${BASE_URL}/auth`)
  })

  test('redirects to /auth when accessing /register with an expired token', async ({ page }) => {
    const inviteCode = crypto.randomUUID()
    const token = generateInviteToken({ owner: null, inviteCode, expiresIn: '0s' })

    // Wait a moment for the token to expire
    await new Promise((resolve) => setTimeout(resolve, 1000))

    await page.goto(`/register?token=${token}`)
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(`${BASE_URL}/auth`)
  })

  test('redirects to /auth when inviteCode was already used', async ({ page }) => {
    await resetDatabase()

    const inviteCode = crypto.randomUUID()

    // Mark the invite code as used directly in the database
    const prisma = getPrisma()
    await prisma.usedInvite.create({ data: { code: inviteCode } })

    const token = generateInviteToken({ owner: null, inviteCode })

    await page.goto(`/register?token=${token}`)
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(`${BASE_URL}/auth`)
  })

  test('registers a new user with valid token and no owner field (parentId = null)', async ({ page }) => {
    await resetDatabase()

    const inviteCode = crypto.randomUUID()
    const token = generateInviteToken({ owner: null, inviteCode })

    await page.goto(`/register?token=${token}`)
    await page.waitForLoadState('networkidle')

    // Should see the registration form
    await expect(page.locator('#email')).toBeVisible()

    await page.locator('#email').fill('noowner.user@example.com')
    await page.locator('#nick').fill('noowneruser')
    await page.locator('#fullName').fill('No Owner User')
    await page.locator('#phone').fill('+375330000001')
    await page.locator('#memberId').fill('MBR-9001')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('password123')

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page.getByText('Регистрация прошла успешно')).toBeVisible()
    await expect(page).toHaveURL(`${BASE_URL}/auth`)

    // Verify the user was created with parentId = null
    const prisma = getPrisma()
    const user = await prisma.user.findUnique({ where: { email: 'noowner.user@example.com' } })
    expect(user).not.toBeNull()
    expect(user.parentId).toBeNull()
  })

  test('registers a new user with valid token and owner=null (parentId = null)', async ({ page }) => {
    await resetDatabase()

    const inviteCode = crypto.randomUUID()
    const token = generateInviteToken({ owner: null, inviteCode })

    await page.goto(`/register?token=${token}`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('#email')).toBeVisible()

    await page.locator('#email').fill('nullowner.user@example.com')
    await page.locator('#nick').fill('nullowneruser')
    await page.locator('#fullName').fill('Null Owner User')
    await page.locator('#phone').fill('+375330000002')
    await page.locator('#memberId').fill('MBR-9002')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('password123')

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page.getByText('Регистрация прошла успешно')).toBeVisible()
    await expect(page).toHaveURL(`${BASE_URL}/auth`)

    // Verify the user was created with parentId = null
    const prisma = getPrisma()
    const user = await prisma.user.findUnique({ where: { email: 'nullowner.user@example.com' } })
    expect(user).not.toBeNull()
    expect(user.parentId).toBeNull()
  })

  test('registers a new user with valid token and owner=1 (parentId = 1)', async ({ page }) => {
    await resetDatabase()

    const inviteCode = crypto.randomUUID()
    const token = generateInviteToken({ owner: 1, inviteCode })

    await page.goto(`/register?token=${token}`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('#email')).toBeVisible()

    await page.locator('#email').fill('withowner.user@example.com')
    await page.locator('#nick').fill('withowneruser')
    await page.locator('#fullName').fill('With Owner User')
    await page.locator('#phone').fill('+375330000003')
    await page.locator('#memberId').fill('MBR-9003')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('password123')

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page.getByText('Регистрация прошла успешно')).toBeVisible()
    await expect(page).toHaveURL(`${BASE_URL}/auth`)

    // Verify the user was created with parentId = 1
    const prisma = getPrisma()
    const user = await prisma.user.findUnique({ where: { email: 'withowner.user@example.com' } })
    expect(user).not.toBeNull()
    expect(user.parentId).toBe(1)
  })

  test('shows client validation error for invalid email format', async ({ page }) => {
    await resetDatabase()

    const inviteCode = crypto.randomUUID()
    const token = generateInviteToken({ owner: null, inviteCode })

    await page.goto(`/register?token=${token}`)
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill('new.user@example.c')
    await page.locator('#nick').fill('newuser')
    await page.locator('#fullName').fill('New User')
    await page.locator('#phone').fill('+375(33)000-0001')
    await page.locator('#memberId').fill('MBR-9001')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('password123')

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page.getByText('Введите корректный адрес')).toBeVisible()
    await expect(page).toHaveURL(`${BASE_URL}/register?token=${token}`)
  })

  test('shows client validation error when passwords do not match', async ({ page }) => {
    await resetDatabase()

    const inviteCode = crypto.randomUUID()
    const token = generateInviteToken({ owner: null, inviteCode })

    await page.goto(`/register?token=${token}`)
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill('new.user@example.com')
    await page.locator('#nick').fill('newuser')
    await page.locator('#fullName').fill('New User')
    await page.locator('#phone').fill('+79221110500')
    await page.locator('#memberId').fill('MBR-9001')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('different-password')

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page.getByText('Пароли не совпадают')).toBeVisible()
    await expect(page).toHaveURL(`${BASE_URL}/register?token=${token}`)
  })

  test('shows server validation error for duplicate email', async ({ page }) => {
    await resetDatabase()

    const inviteCode = crypto.randomUUID()
    const token = generateInviteToken({ owner: null, inviteCode })

    await page.goto(`/register?token=${token}`)
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill('admin@example.com')
    await page.locator('#nick').fill('anotheruser')
    await page.locator('#fullName').fill('Another User')
    await page.locator('#phone').fill('+7 (495) 000-00-00')
    await page.locator('#memberId').fill('MBR-9002')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('password123')

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page.getByText('Электронная почта уже есть в системе')).toBeVisible()
    await expect(page).toHaveURL(`${BASE_URL}/register?token=${token}`)
  })
})
