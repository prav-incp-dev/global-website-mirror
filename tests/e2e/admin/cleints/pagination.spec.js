import { test, expect } from '../../fixtures.js'
import { getPrisma } from '../../db.js'

test.describe('admin clients page', () => {
  let adminId

  test.beforeEach(async () => {
    const prisma = getPrisma()

    // Create a separate company for this test to avoid data interference
    const company = await prisma.company.create({
      data: {
        name: 'Test Company',
        primaryWallet: '0x9999999999999999999999999999999999999999',
      },
    })

    // Create admin user for this company
    const admin = await prisma.user.create({
      data: {
        email: 'test-admin@example.com',
        password: 'hashed',
        role: 'Admin',
        nick: '@test-admin',
        firstName: 'Test',
        lastName: 'Admin',
        phone: '+375290000100',
        memberId: 'DOM-00000000-1000',
        wallet: '0x9999999999999999999999999999999999999999',
        companyId: company.id,
      },
    })
    adminId = admin.id

    // Create 1 candidate 'Nemo' without parent (orphan)
    await prisma.user.create({
      data: {
        email: 'nemo@example.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@nemo',
        firstName: 'Nemo',
        lastName: 'Fish',
        phone: '+375290000300',
        memberId: 'DOM-00000000-0300',
        wallet: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        companyId: company.id,
        orphant: true,
      },
    })

    // Create 10 candidates with firstName 'John', no parent (orphans)
    const johns = []
    for (let i = 0; i < 10; i++) {
      const john = await prisma.user.create({
        data: {
          email: `john${i}@example.com`,
          password: 'hashed',
          role: 'Candidate',
          nick: `@john${i}`,
          firstName: 'John',
          lastName: `Doe${i}`,
          phone: `+[PHONE]1${i}`,
          memberId: `DOM-00000000-01${i}0`,
          wallet: `0x${String(i).padStart(40, '0')}`,
          companyId: company.id,
          orphant: true,
        },
      })
      johns.push(john)
    }

    // Create 10 candidates with firstName 'Tom', with parent set to first John
    for (let i = 0; i < 10; i++) {
      await prisma.user.create({
        data: {
          email: `tom${i}@example.com`,
          password: 'hashed',
          role: 'Candidate',
          nick: `@tom${i}`,
          firstName: 'Tom',
          lastName: `Smith${i}`,
          phone: `+[PHONE]2${i}`,
          memberId: `DOM-00000000-02${i}0`,
          wallet: `0x${String(10 + i).padStart(40, '0')}`,
          companyId: company.id,
          parentId: johns[0].id,
        },
      })
    }
  })

  test('clients page full workflow', async ({ loginAs, page }) => {
    // 1. Login as admin
    await loginAs(adminId)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()

    // 2. Click 'Клиенты' tab
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    // 3. Verify initial state — 20 records on page 1, pagination visible
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(20)

    // Pagination shows "1 из 2"
    await expect(page.getByText('1 из 2')).toBeVisible()

    // 'Вперёд' is enabled, 'Назад' is disabled
    const backButton = page.getByRole('button', { name: 'Назад' })
    const forwardButton = page.getByRole('button', { name: 'Вперёд' })
    await expect(backButton).toBeDisabled()
    await expect(forwardButton).toBeEnabled()

    // Orphans button shows correct count
    const orphansButton = page.getByRole('button', { name: 'Открепленные (11)' })
    await expect(orphansButton).toBeVisible()
    await expect(orphansButton).toBeEnabled()

    // 4. Click 'Вперёд' — navigate to page 2
    await forwardButton.click()
    await page.waitForLoadState('networkidle')

    // Only Nemo is visible
    await expect(rows).toHaveCount(1)
    await expect(page.getByText('Nemo Fish')).toBeVisible()

    // 'Вперёд' is disabled, 'Назад' is enabled
    await expect(page.getByRole('button', { name: 'Назад' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Вперёд' })).toBeDisabled()

    // 5. Click 'Открепленные (11)' — filter orphans only
    await page.getByRole('button', { name: 'Открепленные (11)' }).click()
    await page.waitForLoadState('networkidle')

    // 11 records visible (10 Johns + 1 Nemo)
    await expect(rows).toHaveCount(11)

    // No pagination (totalPages = 1)
    await expect(page.getByText('1 из 2')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Назад' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Вперёд' })).not.toBeVisible()

    // All 11 records have 'Кандидат' type, no consultants
    const candidateLabels = page.locator('table tbody tr td span')
    await expect(candidateLabels).toHaveCount(11)

    // 6. Click 'Открепленные (11)' again — all records back
    await page.getByRole('button', { name: 'Открепленные (11)' }).click()
    await page.waitForLoadState('networkidle')

    // Back to 20 records on page 1 with pagination
    await expect(rows).toHaveCount(20)
    await expect(page.getByText('1 из 2')).toBeVisible()

    // 7. Search for 'nem'
    const searchInput = page.locator('input[placeholder="Поиск (имя, почта)"]')
    await searchInput.fill('nem')
    await page.waitForLoadState('networkidle')

    // Only Nemo is left
    await expect(rows).toHaveCount(1)
    await expect(page.getByText('Nemo Fish')).toBeVisible()

    // Button shows 'Открепленные (1)'
    await expect(page.getByRole('button', { name: 'Открепленные (1)' })).toBeVisible()
  })
})
