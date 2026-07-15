import { test, expect } from './fixtures.js'

test.describe('login flow', () => {
  test('logs in and redirects to profile page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('admin@example.com')
    await passwordInput.fill('password')
    await expect(emailInput).toHaveValue('admin@example.com')
    await expect(passwordInput).toHaveValue('password')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page).toHaveURL('http://127.0.0.1:3101/')
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
    await expect(page.getByText('admin@example.com')).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('admin@example.com')
    await passwordInput.fill('wrong-password')
    await expect(emailInput).toHaveValue('admin@example.com')
    await expect(passwordInput).toHaveValue('wrong-password')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page).toHaveURL('http://127.0.0.1:3101/login')
    await expect(page.getByText('Invalid email or password')).toBeVisible()
  })
})
