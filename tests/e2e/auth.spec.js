import { test, expect } from './fixtures.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createTestCompany, createTestUser } from './db.js'

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

let admin
let consultant

test.beforeEach(async () => {
  const company = await createTestCompany('Auth Test Company')
  admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
  consultant = await createTestUser({
    firstName: 'Consult',
    lastName: 'User',
    role: 'Consultant',
    companyId: company.id,
  })
})

test.describe('login flow with 2FA', () => {
  test('logs in with email + password, enters confirmation code, and redirects to profile page', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill(consultant.email)
    await passwordInput.fill('password')
    await expect(emailInput).toHaveValue(consultant.email)
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
    await expect(page.getByText(consultant.email)).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill(admin.email)
    await passwordInput.fill('wrong-password')
    await expect(emailInput).toHaveValue(admin.email)
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

    await emailInput.fill(admin.email)
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

    await emailInput.fill(consultant.email)
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
    await expect(page.getByText(consultant.email)).toBeVisible()
  })

  test('admin gets to admin panel', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill(admin.email)
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
    await expect(page.getByRole('heading', { name: 'Админка' })).toBeVisible()
    await expect(page.getByText(admin.email)).toBeVisible()
  })

  test('logout case', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    await emailInput.fill(admin.email)
    await passwordInput.fill('password')
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page.getByRole('heading', { name: 'Подтверждение' })).toBeVisible()

    const code = await getConfirmationCode()
    const codeInput = page.locator('#code')
    await codeInput.fill(code)
    await page.getByRole('button', { name: 'Подтвердить' }).click()

    // Verify we are logged in
    await expect(page).toHaveURL('http://127.0.0.1:3101/admin')
    await expect(page.getByRole('heading', { name: 'Админка' })).toBeVisible()
    await expect(page.getByText(admin.email)).toBeVisible()

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

test.describe('forgot password flow', () => {
  test('user requests reset, gets email, resets password, and logs in with new password', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    // Click "Забыли пароль?" link
    await page.getByRole('link', { name: 'Забыли пароль?' }).click()

    // Should show the forgot password form
    await expect(page.getByRole('heading', { name: 'Забыли пароль?' })).toBeVisible()
    await expect(page).toHaveURL('http://127.0.0.1:3101/forgot')

    // Enter email and submit
    const emailInput = page.locator('#email')
    await emailInput.fill(admin.email)
    await page.getByRole('button', { name: 'Отправить ссылку' }).click()

    // Should show success message
    await expect(page.getByText('Ссылка для сброса пароля отправлена на ваш email.')).toBeVisible()

    // Read the reset token from the email fixture file
    const emailContent = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
    const tokenMatch = emailContent.text?.match(/token=([^\s&]+)/)
    expect(tokenMatch).toBeTruthy()
    const resetToken = tokenMatch[1]

    // Navigate to the reset password page with the token
    await page.goto(`/reset?token=${resetToken}`)
    await page.waitForLoadState('networkidle')

    // Should show the reset password form
    await expect(page.getByRole('heading', { name: 'Новый пароль' })).toBeVisible()
    await expect(page).toHaveURL(`http://127.0.0.1:3101/reset?token=${resetToken}`)

    // Enter new password
    const passwordInput = page.locator('#password')
    const confirmPasswordInput = page.locator('#confirmPassword')
    await passwordInput.fill('newpassword123')
    await confirmPasswordInput.fill('newpassword123')
    await page.getByRole('button', { name: 'Сохранить пароль' }).click()

    // Should show success message
    await expect(page.getByText('Пароль успешно изменён.')).toBeVisible()

    // Should redirect to /auth after 3 seconds
    await expect(page).toHaveURL('http://127.0.0.1:3101/auth')

    // Login with the new password
    await page.getByRole('heading', { name: 'Вход в систему' }).waitFor()
    const loginEmailInput = page.locator('#email')
    const loginPasswordInput = page.locator('#password')
    await loginEmailInput.fill(admin.email)
    await loginPasswordInput.fill('newpassword123')
    await page.getByRole('button', { name: 'Войти' }).click()

    // Should show 2FA confirmation step
    await expect(page.getByRole('heading', { name: 'Подтверждение' })).toBeVisible()

    // Read the confirmation code from email
    const code = await getConfirmationCode()
    const codeInput = page.locator('#code')
    await codeInput.fill(code)
    await page.getByRole('button', { name: 'Подтвердить' }).click()

    // Should be logged in and redirected to admin panel
    await expect(page).toHaveURL('http://127.0.0.1:3101/admin')
    await expect(page.getByRole('heading', { name: 'Админка' })).toBeVisible()
  })

  test('entering non-existent email still shows success', async ({ page }) => {
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    // Click "Забыли пароль?" link
    await page.getByRole('link', { name: 'Забыли пароль?' }).click()

    await expect(page.getByRole('heading', { name: 'Забыли пароль?' })).toBeVisible()
    await expect(page).toHaveURL(`http://127.0.0.1:3101/forgot`)

    // Enter a non-existent email
    const emailInput = page.locator('#email')
    await emailInput.fill('nonexistent@example.com')
    await page.getByRole('button', { name: 'Отправить ссылку' }).click()

    // Should still show success (to prevent email enumeration)
    await expect(page.getByText('Ссылка для сброса пароля отправлена на ваш email.')).toBeVisible()
  })

  test('invalid token shows error', async ({ page }) => {
    await page.goto('/reset?token=invalid-token')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Новый пароль' })).toBeVisible()

    const passwordInput = page.locator('#password')
    const confirmPasswordInput = page.locator('#confirmPassword')
    await passwordInput.fill('newpassword123')
    await confirmPasswordInput.fill('newpassword123')
    await page.getByRole('button', { name: 'Сохранить пароль' }).click()

    await expect(page.getByText('Ссылка недействительна или срок её действия истёк')).toBeVisible()
  })
})
