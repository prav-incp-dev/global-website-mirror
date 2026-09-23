import { test, expect } from '../fixtures.js'
import { createTestCompany, createTestUser } from '../db.js'

test.describe('consultant wages tab', () => {
  let consultant
  let company

  test.beforeEach(async () => {
    company = await createTestCompany('Wages Test Company')
    consultant = await createTestUser({
      firstName: 'Wage',
      lastName: 'User',
      role: 'Consultant',
      companyId: company.id,
    })
  })

  test('wages tab shows empty state when no wages exist', async ({ loginAs, page }) => {
    await loginAs(consultant.id)
    await page.getByRole('button', { name: 'Начисления' }).click()

    await expect(page.getByText('Начислений пока нет')).toBeVisible()
  })

  test('wages tab shows toolbar with sorter and search input', async ({ loginAs, page }) => {
    await loginAs(consultant.id)
    await page.getByRole('button', { name: 'Начисления' }).click()

    // Verify sorter button
    await expect(page.locator('[title="Сортировка"]')).toBeVisible()

    // Verify search input
    await expect(page.getByPlaceholder('Поиск')).toBeVisible()
  })

  test('expand and collapse a wage row', async ({ loginAs, page }) => {
    await loginAs(consultant.id)

    // Create a wage for the consultant
    const { getPrisma } = await import('../db.js')
    const prisma = getPrisma()
    await prisma.wage.create({
      data: {
        companyId: company.id,
        userId: consultant.id,
        amount: 150.5,
        description: 'Test wage payment',
        score: 10,
        groupScore: 25,
      },
    })

    await page.getByRole('button', { name: 'Начисления' }).click()

    // Verify the wage row is visible
    await expect(page.getByText('$150.50 USDT')).toBeVisible()

    // Click the row header (chevron area) to expand
    await page.getByText('$150.50 USDT').click()

    // Verify expanded details are shown
    await expect(page.getByText('Test wage payment')).toBeVisible()
    await expect(page.getByText('Начислено личных единиц: 10')).toBeVisible()
    await expect(page.getByText('Начислено групповых единиц: 25')).toBeVisible()

    // Click again to collapse
    await page.getByText('$150.50 USDT').click()

    // Verify details are hidden
    await expect(page.getByText('Test wage payment')).not.toBeVisible()
  })

  test('multiple rows can be expanded simultaneously', async ({ loginAs, page }) => {
    await loginAs(consultant.id)

    const { getPrisma } = await import('../db.js')
    const prisma = getPrisma()

    // Create two wages
    await prisma.wage.create({
      data: {
        companyId: company.id,
        userId: consultant.id,
        amount: 100,
        description: 'First wage',
        score: 5,
        groupScore: 10,
      },
    })

    await prisma.wage.create({
      data: {
        companyId: company.id,
        userId: consultant.id,
        amount: 200,
        description: 'Second wage',
        score: 8,
        groupScore: 15,
      },
    })

    await page.getByRole('button', { name: 'Начисления' }).click()

    // Expand first row
    await page.getByText('$100.00 USDT').click()
    await expect(page.getByText('First wage')).toBeVisible()

    // Expand second row (both should be open)
    await page.getByText('$200.00 USDT').click()
    await expect(page.getByText('Second wage')).toBeVisible()

    // Verify first one is still expanded
    await expect(page.getByText('First wage')).toBeVisible()
  })

  test('pagination works when there are more wages than page limit', async ({ loginAs, page }) => {
    await loginAs(consultant.id)

    const { WAGES_LIMIT } = await import('../../../src/lib/constants.js')
    const { getPrisma } = await import('../db.js')
    const prisma = getPrisma()

    // Create WAGES_LIMIT + 1 wages to trigger pagination
    const totalWages = WAGES_LIMIT + 1
    for (let i = 1; i <= totalWages; i++) {
      await prisma.wage.create({
        data: {
          companyId: company.id,
          userId: consultant.id,
          amount: i * 10,
          description: `Wage number ${i}`,
          score: i,
          groupScore: i * 2,
        },
      })
    }

    await page.getByRole('button', { name: 'Начисления' }).click()

    // The first wage on page 1 should be the last created one (highest id, highest amount)
    await expect(page.getByText('$110.00 USDT').first()).toBeVisible()
    await expect(page.getByText('$10.00 USDT').first()).not.toBeVisible()

    await page.locator('[title="Сортировка"]').click()
    await page.getByText('По возрастанию суммы').click()

    await expect(page.getByText('$10.00 USDT').first()).toBeVisible()
    await expect(page.getByText('$110.00 USDT').first()).not.toBeVisible()

    // --- Sort by descending amount ---
    await page.locator('[title="Сортировка"]').click()
    await page.getByText('По убыванию суммы').click()
    // The first wage should now be the largest amount again
    await expect(page.getByText('$110.00 USDT').first()).toBeVisible()
    await expect(page.getByText('$10.00 USDT').first()).not.toBeVisible()

    // --- Search by amount ---
    await page.getByPlaceholder('Поиск').fill('50')
    await expect(page.getByText('$110.00 USDT').first()).not.toBeVisible()
    await expect(page.getByText('$50.00 USDT')).toBeVisible()
    // Pagination should disappear since filtered results fit on one page
    await expect(page.getByText('1 из 2')).not.toBeVisible()

    // --- Clear search ---
    await page.getByPlaceholder('Поиск').fill('')
    await expect(page.getByText('$110.00 USDT')).toBeVisible()
    await expect(page.getByText('1 из 2')).toBeVisible()

    // --- Navigate to page 2 ---
    await page.getByRole('button', { name: 'Вперёд' }).click()
    await expect(page.getByText('2 из 2')).toBeVisible()

    // Verify first wage from page 1 is NOT visible
    await expect(page.getByText('$110.00 USDT')).not.toBeVisible()
    await expect(page.getByText('$10.00 USDT')).toBeVisible()
  })
})
