import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser } from '../../db.js'

test.describe('admin clients filtering', () => {
  let admin

  test.beforeEach(async () => {
    const company = await createTestCompany('Filtering Test Company')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })

    // Level 3 — Alice Anderson, orphan
    await createTestUser({
      firstName: 'Alice',
      lastName: 'Anderson',
      role: 'Candidate',
      level: 3,
      companyId: company.id,
      orphant: true,
    })

    // Level 5 — Bob Brown, not orphan
    await createTestUser(
      { firstName: 'Bob', lastName: 'Brown', role: 'Consultant', level: 5, companyId: company.id },
      100,
    )

    // Level 7 — Charlie Clark, orphan
    await createTestUser({
      firstName: 'Charlie',
      lastName: 'Clark',
      role: 'Candidate',
      level: 7,
      companyId: company.id,
      orphant: true,
    })

    // Level 9 — Diana Davis, not orphan
    await createTestUser(
      { firstName: 'Diana', lastName: 'Davis', role: 'Consultant', level: 9, companyId: company.id },
      200,
    )
  })

  const navigateToClients = async (page) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Админка' })).toBeVisible()
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')
  }

  const getRowNames = async (page) => {
    const rows = page.locator('table tbody tr')
    return rows.locator('td:first-child').allTextContents()
  }

  test('filters clients by level range', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await navigateToClients(page)

    const rows = () => page.locator('table tbody tr')
    await expect(rows()).toHaveCount(4)

    // Open FilterModal
    await page.getByTitle('Фильтрация').click()
    await expect(page.getByRole('heading', { name: 'Фильтрация' })).toBeVisible()

    // Set from=5, to=8
    const fromInput = page.locator('input[placeholder="от"]')
    const toInput = page.locator('input[placeholder="до"]')
    await fromInput.fill('5')
    await toInput.fill('8')

    // Apply filter
    await page.getByRole('button', { name: 'Применить' }).click()
    await page.waitForLoadState('networkidle')

    // Level 5 (Bob) and level 7 (Charlie); level 3 (Alice) below, level 9 (Diana) above
    await expect(rows()).toHaveCount(2)
    let names = await getRowNames(page)
    expect(names).toEqual(expect.arrayContaining(['Bob Brown', 'Charlie Clark']))

    // Filter button shows active state
    const filterButton = page.getByTitle('Фильтрация')
    await expect(filterButton).toHaveClass(/filterButtonActive/)

    // Re-open modal — inputs reflect current values
    await filterButton.click()
    await expect(fromInput).toHaveValue('5')
    await expect(toInput).toHaveValue('8')

    // Reset filter
    await page.getByRole('button', { name: 'Сбросить фильтр' }).click()
    await page.waitForLoadState('networkidle')

    // All 4 users back
    await expect(rows()).toHaveCount(4)
    names = await getRowNames(page)
    expect(names).toEqual(expect.arrayContaining(['Alice Anderson', 'Bob Brown', 'Charlie Clark', 'Diana Davis']))
    await expect(filterButton).not.toHaveClass(/filterButtonActive/)
  })

  test('combines level filter with text search', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await navigateToClients(page)

    const rows = () => page.locator('table tbody tr')

    // Set level range 4-8
    await page.getByTitle('Фильтрация').click()
    const fromInput = page.locator('input[placeholder="от"]')
    const toInput = page.locator('input[placeholder="до"]')
    await fromInput.fill('4')
    await toInput.fill('8')
    await page.getByRole('button', { name: 'Применить' }).click()
    await page.waitForLoadState('networkidle')

    // Range narrows to Bob (5) and Charlie (7)
    await expect(rows()).toHaveCount(2)

    // Search for 'Charlie' — found within range
    const searchInput = page.locator('input[placeholder="Поиск"]')
    await searchInput.fill('Charlie')
    await page.waitForLoadState('networkidle')

    await expect(rows()).toHaveCount(1)
    expect(await getRowNames(page)).toEqual(['Charlie Clark'])

    // Search for 'Alice' (level 3, outside range) — empty
    await searchInput.fill('Alice')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Нет клиентов')).toBeVisible()

    // Clear search — level 4-8 range still active
    await searchInput.fill('')
    await page.waitForLoadState('networkidle')
    await expect(rows()).toHaveCount(2)
    await expect(page.getByTitle('Фильтрация')).toHaveClass(/filterButtonActive/)
  })

  test('level filter combined with orphans filter', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await navigateToClients(page)

    const rows = () => page.locator('table tbody tr')
    await expect(rows()).toHaveCount(4)

    // Filter orphans only (Alice level 3, Charlie level 7)
    const orphansButton = page.getByRole('button', { name: 'Открепленные (2)' })
    await expect(orphansButton).toBeEnabled()
    await orphansButton.click()
    await page.waitForLoadState('networkidle')

    await expect(rows()).toHaveCount(2)
    let names = await getRowNames(page)
    expect(names).toEqual(expect.arrayContaining(['Alice Anderson', 'Charlie Clark']))

    // Apply level filter 4-8 — only Charlie (level 7) remains
    await page.getByTitle('Фильтрация').click()
    const fromInput = page.locator('input[placeholder="от"]')
    const toInput = page.locator('input[placeholder="до"]')
    await fromInput.fill('4')
    await toInput.fill('8')
    await page.getByRole('button', { name: 'Применить' }).click()
    await page.waitForLoadState('networkidle')

    await expect(rows()).toHaveCount(1)
    expect(await getRowNames(page)).toEqual(['Charlie Clark'])

    // Toggle orphans off — Bob (5) and Charlie (7) both within level range
    await page.getByRole('button', { name: 'Открепленные (1)' }).click()
    await page.waitForLoadState('networkidle')

    await expect(rows()).toHaveCount(2)
    names = await getRowNames(page)
    expect(names).toEqual(expect.arrayContaining(['Bob Brown', 'Charlie Clark']))

    // Reset level filter — all 4 users back
    await page.getByTitle('Фильтрация').click()
    await page.getByRole('button', { name: 'Сбросить фильтр' }).click()
    await page.waitForLoadState('networkidle')

    await expect(rows()).toHaveCount(4)
  })
})
