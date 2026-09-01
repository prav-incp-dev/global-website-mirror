import { test, expect } from '../fixtures.js'
import { createTestCompany, createTestUser } from '../db.js'

test.describe('admin manages company profile', () => {
  let admin

  test.beforeEach(async () => {
    const company = await createTestCompany('Admin Company Profile')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
  })

  const navigateToCompanyTab = async (page) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Профиль компании' }).click()
  }

  test('updates company data successfully', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await navigateToCompanyTab(page)
    await page.getByRole('button', { name: 'Редактировать' }).click()

    // Update all fields
    await page.locator('#name').fill('Updated Company Name')
    await page.locator('#wallet').fill('0x1234567890abcdef1234567890abcdef12345678')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Verify view mode shows updated data
    await expect(page.getByText('Updated Company Name')).toBeVisible()
    await expect(page.getByText('0x12345678...12345678')).toBeVisible()

    // Clear wallet
    await page.getByRole('button', { name: 'Редактировать' }).click()
    await page.locator('#wallet').fill('')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.getByText('—')).toHaveCount(1)

    await page.getByRole('button', { name: 'Профиль администратора' }).click()
    await page.getByRole('button', { name: 'Профиль компании' }).click()
    await expect(page.getByText('Updated Company Name')).toBeVisible()
  })

  test('shows validation error for invalid wallet', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await navigateToCompanyTab(page)
    await page.getByRole('button', { name: 'Редактировать' }).click()

    await page.locator('#wallet').fill('invalid-wallet-format')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Client-side validation from react-hook-form pattern
    await expect(page.getByText('Неверный формат кошелька')).toHaveCount(1)
  })

  test('shows error when company name is already taken', async ({ loginAs, page }) => {
    // Create another company with a different name via Prisma directly
    await createTestCompany('Existing Company')

    await loginAs(admin.id)
    await navigateToCompanyTab(page)
    await page.getByRole('button', { name: 'Редактировать' }).click()

    // Try to rename to the existing company name
    await page.locator('#name').fill('Existing Company')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Server-side validation error
    await expect(page.getByText('Компания с таким названием уже существует')).toBeVisible()
  })
})
