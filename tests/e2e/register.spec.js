import { test, expect } from './fixtures.js'

test.describe('registration flow', () => {
  test('registers a new user and shows success message then redirects to auth page', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill('new.user@example.com')
    await page.locator('#nick').fill('newuser')
    await page.locator('#fullName').fill('New User')
    await page.locator('#phone').fill('+10000000002')
    await page.locator('#memberId').fill('MBR-9001')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('password123')

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page.getByText('Регистрация прошла успешно')).toBeVisible()
    await expect(page).toHaveURL('http://127.0.0.1:3101/auth')
  })

  test('shows client validation error for invalid email format', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill('new.user@example.c')
    await page.locator('#nick').fill('newuser')
    await page.locator('#fullName').fill('New User')
    await page.locator('#phone').fill('+10000000002')
    await page.locator('#memberId').fill('MBR-9001')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('password123')

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page.getByText('Введите корректный адрес')).toBeVisible()
    await expect(page).toHaveURL('http://127.0.0.1:3101/register')
  })

  test('shows client validation error when passwords do not match', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill('new.user@example.com')
    await page.locator('#nick').fill('newuser')
    await page.locator('#fullName').fill('New User')
    await page.locator('#phone').fill('+10000000002')
    await page.locator('#memberId').fill('MBR-9001')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('different-password')

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page.getByText('Пароли не совпадают')).toBeVisible()
    await expect(page).toHaveURL('http://127.0.0.1:3101/register')
  })

  test('shows server validation error for duplicate email', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill('admin@example.com')
    await page.locator('#nick').fill('anotheruser')
    await page.locator('#fullName').fill('Another User')
    await page.locator('#phone').fill('+10000000003')
    await page.locator('#memberId').fill('MBR-9002')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('password123')

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page.getByText('Электронная почта уже есть в системе')).toBeVisible()
    await expect(page).toHaveURL('http://127.0.0.1:3101/register')
  })
})
