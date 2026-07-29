import { test, expect } from '../fixtures.js'

test.describe('admin manages own profile', () => {
  const updatedFirstName = 'Bob'
  const updatedLastName = 'Updated'

  test('updates profile data successfully', async ({ loginAs, page }) => {
    await loginAs(1)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Verify initial profile data is displayed
    await expect(page.getByText('Alice')).toBeVisible()
    await expect(page.getByText('Admin', { exact: true })).toBeVisible()
    await expect(page.getByText('admin@example.com')).toBeVisible()

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
    await page.locator('#firstName').fill(updatedFirstName)
    await page.locator('#lastName').fill(updatedLastName)
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Verify view mode shows updated data
    await expect(page.getByText(updatedFirstName)).toBeVisible()
    await expect(page.getByText(updatedLastName)).toBeVisible()

    // Email should remain unchanged
    await expect(page.getByText('admin@example.com')).toBeVisible()
    await page.getByRole('button', { name: 'Профиль компании' }).click()
    await page.getByRole('button', { name: 'Профиль администратора' }).click()

    // Verify updated data are still in place
    await expect(page.getByText(updatedFirstName)).toBeVisible()
    await expect(page.getByText(updatedLastName)).toBeVisible()
  })
})
