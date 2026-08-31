import { test, expect } from '../../fixtures.js'
import { getPrisma } from '../../db.js'

test.describe('admin clients page', () => {
  let adminId

  test.beforeEach(async () => {
    const prisma = getPrisma()

    // Create a dedicated company and users for this scenario
    const company = await prisma.company.create({
      data: {
        name: 'Orphan Reassign Test Company',
        primaryWallet: '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      },
    })

    const admin = await prisma.user.create({
      data: {
        email: 'orphan-reassign-admin@example.com',
        password: 'hashed',
        role: 'Admin',
        nick: '@orphan-reassign-admin',
        firstName: 'OrphanReassign',
        lastName: 'Admin',
        phone: '+375290000700',
        memberId: 'DOM-00000000-0700',
        wallet: '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
        companyId: company.id,
      },
    })
    adminId = admin.id

    // Tim Bro — Consultant, non-orphant
    await prisma.user.create({
      data: {
        email: 'tim-bro@example.com',
        password: 'hashed',
        role: 'Consultant',
        nick: '@timbro',
        firstName: 'Tim',
        lastName: 'Bro',
        phone: '+375290000701',
        memberId: 'DOM-00000000-0701',
        wallet: '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
        level: 1,
        companyId: company.id,
        parentId: null,
        orphant: false,
      },
    })

    // Tom Begging — Candidate, orphant
    await prisma.user.create({
      data: {
        email: 'tom-begging@example.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@tombegging',
        firstName: 'Tom',
        lastName: 'Begging',
        phone: '+375290000702',
        memberId: 'DOM-00000000-0702',
        wallet: '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        companyId: company.id,
        orphant: true,
      },
    })
  })

  test('change parent flow: clear/set parent', async ({ loginAs, page }) => {
    // Login as admin and navigate to clients page
    await loginAs(adminId)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    // Both users are visible
    await expect(page.getByText('Tim Bro')).toBeVisible()
    await expect(page.getByText('Tom Begging')).toBeVisible()

    // Click info icon on Tom's row, then open UpdateParentModal
    const tomRow = page.locator('table tbody tr').filter({ hasText: 'Tom Begging' })
    await tomRow.locator('td:last-child').click()

    // Verify parent info
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()
    await expect(page.getByText('Родитель:')).toBeVisible()
    await expect(page.getByText('Родитель:').locator('..')).toContainText('Нет родителя')

    await page.getByRole('button', { name: 'Изменить родителя' }).click()
    await expect(page.getByRole('heading', { name: 'Установить родителя' })).toBeVisible()

    // Search for a parent
    const searchInput = page.locator('input[placeholder="Начните вводить имя для поиска"]')
    await searchInput.fill('t')
    await expect(page.getByText('Ничего не найдено')).not.toBeVisible()
    await expect(page.getByTestId('parent-search-dropdown')).not.toBeVisible()
    await searchInput.fill('ti')
    await expect(page.getByTestId('parent-search-dropdown')).toBeVisible()
    const options = page.getByTestId('parent-search-dropdown').locator('li')
    await expect(options).toHaveCount(1)
    await searchInput.fill('tig')
    await expect(page.getByText('Ничего не найдено')).toBeVisible()
    await expect(page.getByTestId('parent-search-dropdown')).not.toBeVisible()
    await searchInput.fill('ti')
    await expect(page.getByTestId('parent-search-dropdown')).toBeVisible()
    await expect(page.getByText('Ничего не найдено')).not.toBeVisible()
    await expect(options).toHaveCount(1)

    // Click the very first option in the list
    const firstOption = options.first()
    await expect(firstOption).toContainText('Tim Bro')
    await firstOption.click()

    // The chip now shows the selected parent name
    const newChip = page.locator('button[aria-label="Очистить"]').locator('..')
    await expect(newChip).toContainText('Tim Bro')

    // Click "Сохранить" to save the parent change
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Установить родителя' })).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()

    // UpdateParentModal closes. ClientModal should now show the selected parent name
    await expect(page.getByText('Родитель:').locator('..')).toContainText('Tim Bro')

    // Click to change parent once more
    await page.getByRole('button', { name: 'Изменить родителя' }).click()
    await expect(page.getByRole('heading', { name: 'Установить родителя' })).toBeVisible()

    // Verify the chip shows "Tim Bro", then clear it
    const clearButton = page.locator('button[aria-label="Очистить"]')
    const chip = clearButton.locator('..')
    await expect(chip).toContainText('Tim Bro')
    await clearButton.click()

    // Click "Сохранить" to save the change (parent → null)
    await page.getByRole('button', { name: 'Сохранить' }).click()

    await expect(page.getByRole('heading', { name: 'Установить родителя' })).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()

    // UpdateParentModal closes. ClientModal should now show the selected parent name
    await expect(page.getByText('Родитель:').locator('..')).toContainText('Нет родителя')
  })

  test('orphan reassignment removes user from orphans view', async ({ loginAs, page }) => {
    // 1. Login as admin and navigate to clients page
    await loginAs(adminId)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    // 2. Both users are visible
    await expect(page.getByText('Tim Bro')).toBeVisible()
    await expect(page.getByText('Tom Begging')).toBeVisible()

    // 3. Click 'Открепленные (1)' — filter orphans only
    const orphansButton = page.getByRole('button', { name: 'Открепленные (1)' })
    await expect(orphansButton).toBeEnabled()
    await orphansButton.click()
    await page.waitForLoadState('networkidle')

    // 4. Only Tom (the orphan) is visible
    await expect(page.getByText('Tom Begging')).toBeVisible()
    await expect(page.getByText('Tim Bro')).not.toBeVisible()

    // 5. Click info icon on Tom's row, then open UpdateParentModal
    const tomRow = page.locator('table tbody tr').filter({ hasText: 'Tom Begging' })
    await tomRow.locator('td:last-child').click()
    await expect(page.getByText('Родитель:')).toBeVisible()
    await expect(page.getByText('Родитель:').locator('..')).toContainText('Нет родителя')

    await page.getByRole('button', { name: 'Изменить родителя' }).click()

    // 6. Search for "Tim" and select the first option
    const searchInput = page.locator('input[placeholder="Начните вводить имя для поиска"]')
    await searchInput.fill('Tim')
    await expect(page.getByTestId('parent-search-dropdown')).toBeVisible()

    const options = page.getByTestId('parent-search-dropdown').locator('li')
    await options.first().click()

    // 7. Chip shows "Tim Bro"
    const chip = page.locator('button[aria-label="Очистить"]').locator('..')
    await expect(chip).toContainText('Tim Bro')

    // 8. Click "Сохранить"
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await page.waitForLoadState('networkidle')

    // 9. ClientModal now shows "Tim Bro" as parent
    await expect(page.getByText('Родитель:').locator('..')).toContainText('Tim Bro')

    // 10. Close ClientModal
    await page.locator('button[aria-label="Закрыть"]').click()

    // 11. The list is empty (Tom is no longer an orphan, orphansOnly still true)
    await expect(page.getByText('Нет клиентов')).toBeVisible()

    // 12. Button shows 'Открепленные (0)' and is enabled (orphansOnly=true keeps it active)
    const emptyOrphansButton = page.getByRole('button', { name: 'Открепленные (0)' })
    await expect(emptyOrphansButton).toBeVisible()
    await expect(emptyOrphansButton).toBeEnabled()

    // 13. Click the button to toggle back to normal view
    await emptyOrphansButton.click()
    await page.waitForLoadState('networkidle')

    // 14. Both users are visible again
    await expect(page.getByText('Tim Bro')).toBeVisible()
    await expect(page.getByText('Tom Begging')).toBeVisible()

    // 15. Button shows 'Открепленные (0)' and is disabled (no orphans, normal view)
    const finalOrphansButton = page.getByRole('button', { name: 'Открепленные (0)' })
    await expect(finalOrphansButton).toBeVisible()
    await expect(finalOrphansButton).toBeDisabled()
  })
})
