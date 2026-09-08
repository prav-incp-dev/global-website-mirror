import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser } from '../../db.js'

test.describe('ordering clients', () => {
  let admin

  test.beforeEach(async () => {
    const company = await createTestCompany('Ordering Test Company')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })

    // Alice — Candidate, level 3, score 100
    await createTestUser(
      { firstName: 'Alice', lastName: 'Anderson', role: 'Candidate', level: 3, companyId: company.id },
      100,
    )

    // Bob — Consultant, level 1, score 300
    await createTestUser(
      { firstName: 'Bob', lastName: 'Brown', role: 'Consultant', level: 1, companyId: company.id },
      300,
    )

    // Charlie — Candidate, level 2, score 200
    await createTestUser(
      { firstName: 'Charlie', lastName: 'Clark', role: 'Candidate', level: 2, companyId: company.id },
      200,
    )

    // David — Consultant, level 4, score 50 (created last = highest id)
    await createTestUser(
      { firstName: 'David', lastName: 'Davis', role: 'Consultant', level: 4, companyId: company.id },
      50,
    )
  })

  test('ordering clients by different criteria', async ({ loginAs, page }) => {
    // 1. Login as admin and navigate to clients page
    await loginAs(admin.id)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    const rows = () => page.locator('table tbody tr')
    const getRowNames = async () => {
      return rows().locator('td:first-child').allTextContents()
    }

    // 2. Default sort (id descending): David, Charlie, Bob, Alice
    await expect(rows()).toHaveCount(4)
    let names = await getRowNames()
    expect(names).toEqual(['David Davis', 'Charlie Clark', 'Bob Brown', 'Alice Anderson'])

    // 3. Click sort button, select "В алфавитном порядке"
    await page.getByTitle('Сортировка').click()
    await page.getByText('В алфавитном порядке').click()
    await page.waitForLoadState('networkidle')
    await expect(rows().first()).toContainText('Alice Anderson')

    // 4. Alphabetical: Alice, Bob, Charlie, David
    names = await getRowNames()
    expect(names).toEqual(['Alice Anderson', 'Bob Brown', 'Charlie Clark', 'David Davis'])

    // 5. Click sort button, select "С высоким уровнем"
    await page.getByTitle('Сортировка').click()
    await page.getByText('С высоким уровнем').click()
    await page.waitForLoadState('networkidle')
    await expect(rows().first()).toContainText('David Davis')

    // 6. By level descending: David (4), Alice (3), Charlie (2), Bob (1)
    await expect(rows()).toHaveCount(4)
    names = await getRowNames()
    expect(names).toEqual(['David Davis', 'Alice Anderson', 'Charlie Clark', 'Bob Brown'])

    // 7. Click sort button, select "По статусу"
    await page.getByTitle('Сортировка').click()
    await page.getByText('По статусу').click()
    await page.waitForLoadState('networkidle')
    await expect(rows().first()).toContainText('Alice Anderson')

    // 8. By role ascending: Candidate before Consultant — Alice, Charlie, then Bob, David
    names = await getRowNames()
    expect(names).toEqual(['Alice Anderson', 'Charlie Clark', 'Bob Brown', 'David Davis'])

    // 9. Click sort button, select "Лидеры продаж"
    await page.getByTitle('Сортировка').click()
    await page.getByText('Лидеры продаж').click()
    await page.waitForLoadState('networkidle')
    await expect(rows().first()).toContainText('Bob Brown')

    // 10. By score descending: Bob (300), Charlie (200), Alice (100), David (50)
    names = await getRowNames()
    expect(names).toEqual(['Bob Brown', 'Charlie Clark', 'Alice Anderson', 'David Davis'])

    // 11. Click sort button, select "По умолчанию"
    await page.getByTitle('Сортировка').click()
    await page.getByText('По умолчанию').click()
    await page.waitForLoadState('networkidle')
    await expect(rows().first()).toContainText('David Davis')

    // 12. Back to default (id descending): David, Charlie, Bob, Alice
    names = await getRowNames()
    expect(names).toEqual(['David Davis', 'Charlie Clark', 'Bob Brown', 'Alice Anderson'])
  })
})
