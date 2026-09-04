import { test, expect } from '../fixtures.js'
import { createTestCompany, createTestUser } from '../db.js'

test.describe('admin manages own profile', () => {
  let admin

  test.beforeEach(async () => {
    const company = await createTestCompany('Profile Admin Company')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
  })

  test('updates profile data successfully', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Verify initial profile data is displayed
    await expect(page.getByText('Alice', { exact: true })).toBeVisible()
    await expect(page.getByText('Admin', { exact: true })).toBeVisible()
    await expect(page.getByText(admin.email)).toBeVisible()

    // Enter edit mode
    await page.getByRole('button', { name: 'Редактировать' }).click()

    // Clear first name and submit — should see validation error
    await page.locator('#firstName').fill('')
    await page.locator('#lastName').fill('Admin')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.getByText('Обязательное поле')).toHaveCount(1)

    // Clear last name and submit — should see validation error
    await page.locator('#firstName').fill('Alice')
    await page.locator('#lastName').fill('')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.getByText('Обязательное поле')).toHaveCount(1)

    // Enter new valid values and save
    await page.locator('#firstName').fill('Bob')
    await page.locator('#lastName').fill('Updated')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Verify view mode shows updated data
    await expect(page.getByText('Bob')).toBeVisible()
    await expect(page.getByText('Updated')).toBeVisible()

    // Email should remain unchanged
    await expect(page.getByText(admin.email)).toBeVisible()
    await page.getByRole('button', { name: 'Профиль компании' }).click()
    await page.getByRole('button', { name: 'Профиль администратора' }).click()

    // Verify updated data are still in place
    await expect(page.getByText('Bob')).toBeVisible()
    await expect(page.getByText('Updated')).toBeVisible()
  })
})
