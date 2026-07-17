import { test, expect } from './fixtures.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = path.join(__dirname, '..', 'fixtures', 'last-email.json')

/**
 * Reads the last email fixture file and extracts the 6-digit confirmation code.
 * Polls for a short time in case the file hasn't been written yet.
 */
const getConfirmationCode = async () => {
  const content = fs.readFileSync(fixturePath, 'utf-8')
  const email = JSON.parse(content)
  const match = email.text?.match(/\b(\d{6})\b/)
  if (match) return match[1]
}

test.describe('login flow with 2FA', () => {
  test('logs in with email + password, enters confirmation code, and redirects to profile page', async ({
    page,
  }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('admin@example.com')
    await passwordInput.fill('password')
    await expect(emailInput).toHaveValue('admin@example.com')
    await expect(passwordInput).toHaveValue('password')
    await page.getByRole('button', { name: 'Login' }).click()

    // Wait for the confirmation code step to appear
    await expect(page.getByRole('heading', { name: 'Confirm' })).toBeVisible()
    await expect(
      page.getByText('confirmation code has been sent'),
    ).toBeVisible()

    // Read the confirmation code from the email fixture file
    const code = await getConfirmationCode()

    const codeInput = page.locator('#code')
    await codeInput.fill(code)
    await expect(codeInput).toHaveValue(code)
    await page.getByRole('button', { name: 'Confirm' }).click()

    await expect(page).toHaveURL('http://127.0.0.1:3101/')
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
    await expect(page.getByText('admin@example.com')).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('admin@example.com')
    await passwordInput.fill('wrong-password')
    await expect(emailInput).toHaveValue('admin@example.com')
    await expect(passwordInput).toHaveValue('wrong-password')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page).toHaveURL('http://127.0.0.1:3101/auth')
    await expect(page.getByText('Invalid email or password')).toBeVisible()
  })

  test('shows error on invalid confirmation code', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('admin@example.com')
    await passwordInput.fill('password')
    await page.getByRole('button', { name: 'Login' }).click()

    // Wait for the confirmation code step to appear
    await expect(page.getByRole('heading', { name: 'Confirm' })).toBeVisible()
    await expect(
      page.getByText('confirmation code has been sent'),
    ).toBeVisible()

    const codeInput = page.locator('#code')
    await codeInput.fill('000000')
    await page.getByRole('button', { name: 'Confirm' }).click()

    await expect(page.getByText('Invalid confirmation code')).toBeVisible()
    await expect(
      page.getByText('confirmation code has been sent'),
    ).not.toBeVisible()
  })

  test('resend code logic', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('admin@example.com')
    await passwordInput.fill('password')
    await page.getByRole('button', { name: 'Login' }).click()

    // Wait for the confirmation code step to appear
    await expect(page.getByRole('heading', { name: 'Confirm' })).toBeVisible()

    // Get the first generated confirmation code
    const firstCode = await getConfirmationCode()
    expect(firstCode).toBeDefined()

    // Click "Resend code" button
    await page.getByRole('button', { name: 'Resend code' }).click()

    // Verify information text banner
    await expect(
      page.getByText('A new confirmation code has been sent to your email.'),
    ).toBeVisible()

    // Retrieve the newly updated / generated code
    const newCode = await getConfirmationCode()
    expect(newCode).toBeDefined()

    // Fill in the new Code and click confirm
    const codeInput = page.locator('#code')
    await codeInput.fill(newCode)
    await page.getByRole('button', { name: 'Confirm' }).click()

    // Should successfully log in and redirect to profile page
    await expect(page).toHaveURL('http://127.0.0.1:3101/')
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
    await expect(page.getByText('admin@example.com')).toBeVisible()
  })

  test('logout case', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('admin@example.com')
    await passwordInput.fill('password')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByRole('heading', { name: 'Confirm' })).toBeVisible()

    const code = await getConfirmationCode()
    const codeInput = page.locator('#code')
    await codeInput.fill(code)
    await page.getByRole('button', { name: 'Confirm' }).click()

    // Verify we are logged in
    await expect(page).toHaveURL('http://127.0.0.1:3101/')
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()

    // Click logout
    await page.getByRole('button', { name: 'Logout' }).click()

    // Verify redirect to auth page
    await expect(page).toHaveURL('http://127.0.0.1:3101/auth')

    // Navigate to homepage / profile, check that we get redirected to /auth again because we are logged out
    await page.goto('/')
    await expect(page).toHaveURL('http://127.0.0.1:3101/auth')
  })
})
