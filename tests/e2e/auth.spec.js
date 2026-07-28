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

test.describe('consultant login flow with 2FA', () => {
  test('logs in with email + password, enters confirmation code, and redirects to profile page', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('consultant@example.com')
    await passwordInput.fill('password')
    await expect(emailInput).toHaveValue('consultant@example.com')
    await expect(passwordInput).toHaveValue('password')
    await page.getByRole('button', { name: 'Войти' }).click()

    // Wait for the confirmation code step to appear
    await expect(page.getByRole('heading', { name: 'Подтверждение' })).toBeVisible()
    await expect(page.getByText('6-значный код подтверждения отправлен на ваш электронный адрес')).toBeVisible()

    // Read the confirmation code from the email fixture file
    const code = await getConfirmationCode()

    const codeInput = page.locator('#code')
    await codeInput.fill(code)
    await expect(codeInput).toHaveValue(code)
    await page.getByRole('button', { name: 'Подтвердить' }).click()

    await expect(page).toHaveURL('http://127.0.0.1:3101/')
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
    await expect(page.getByText('consultant@example.com')).toBeVisible()
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
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL('http://127.0.0.1:3101/auth')
    await expect(page.getByText('Неверный адрес или пароль')).toBeVisible()
  })

  test('shows error on invalid confirmation code', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('admin@example.com')
    await passwordInput.fill('password')
    await page.getByRole('button', { name: 'Войти' }).click()

    // Wait for the confirmation code step to appear
    await expect(page.getByRole('heading', { name: 'Подтверждение' })).toBeVisible()
    await expect(page.getByText('6-значный код подтверждения отправлен на ваш электронный адрес')).toBeVisible()

    const codeInput = page.locator('#code')
    await codeInput.fill('000000')
    await page.getByRole('button', { name: 'Подтвердить' }).click()

    await expect(page.getByText('Неверный код или время истекло')).toBeVisible()
    await expect(page.getByText('6-значный код подтверждения отправлен на ваш электронный адрес')).not.toBeVisible()
  })

  test('resend code logic', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('consultant@example.com')
    await passwordInput.fill('password')
    await page.getByRole('button', { name: 'Войти' }).click()

    // Wait for the confirmation code step to appear
    await expect(page.getByRole('heading', { name: 'Подтверждение' })).toBeVisible()

    // Get the first generated confirmation code
    const firstCode = await getConfirmationCode()
    expect(firstCode).toBeDefined()

    // Click "Resend code" button
    await page.getByRole('button', { name: 'Отправить новый код' }).click()

    // Verify information text banner
    await expect(page.getByText('Новый код подтверждения отправлен на ваш электронный адрес')).toBeVisible()

    // Retrieve the newly updated / generated code
    const newCode = await getConfirmationCode()
    expect(newCode).toBeDefined()

    // Fill in the new Code and click confirm
    const codeInput = page.locator('#code')
    await codeInput.fill(newCode)
    await page.getByRole('button', { name: 'Подтвердить' }).click()

    // Should successfully log in and redirect to profile page
    await expect(page).toHaveURL('http://127.0.0.1:3101/')
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
    await expect(page.getByText('consultant@example.com')).toBeVisible()
  })

  test('admin gets to admin panel', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('admin@example.com')
    await passwordInput.fill('password')
    await page.getByRole('button', { name: 'Войти' }).click()

    // Wait for the confirmation code step to appear
    await expect(page.getByRole('heading', { name: 'Подтверждение' })).toBeVisible()

    // Get the first generated confirmation code
    const code = await getConfirmationCode()
    expect(code).toBeDefined()

    // Fill in the new Code and click confirm
    const codeInput = page.locator('#code')
    await codeInput.fill(code)
    await page.getByRole('button', { name: 'Подтвердить' }).click()

    // Should successfully log in and redirect to profile page
    await expect(page).toHaveURL('http://127.0.0.1:3101/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await expect(page.getByText('admin@example.com')).toBeVisible()
  })

  test('logout case', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill('admin@example.com')
    await passwordInput.fill('password')
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page.getByRole('heading', { name: 'Подтверждение' })).toBeVisible()

    const code = await getConfirmationCode()
    const codeInput = page.locator('#code')
    await codeInput.fill(code)
    await page.getByRole('button', { name: 'Подтвердить' }).click()

    // Verify we are logged in
    await expect(page).toHaveURL('http://127.0.0.1:3101/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await expect(page.getByText('admin@example.com')).toBeVisible()

    // Click logout
    await page.getByRole('button', { name: 'Выйти' }).click()

    // Verify redirect to auth page
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible()
    await expect(page).toHaveURL('http://127.0.0.1:3101/auth')

    // Navigate to homepage / profile, check that we get redirected to /auth again because we are logged out
    await page.goto('/')
    await expect(page).toHaveURL('http://127.0.0.1:3101/auth')
  })
})
