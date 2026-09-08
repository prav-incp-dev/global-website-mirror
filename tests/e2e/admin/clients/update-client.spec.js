import { test, expect } from '../../fixtures.js'
import { getPrisma } from '../../db.js'
import { createTestCompany, createTestUser } from '../../db.js'

test.describe('update client achievements flow', () => {
  let admin
  let targetConsultant

  test.beforeEach(async () => {
    const company = await createTestCompany('Update Client Company')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
    targetConsultant = await createTestUser(
      {
        firstName: 'Abby',
        lastName: 'Target',
        role: 'Consultant',
        level: 1,
        levelConfirmed: true,
        companyId: company.id,
      },
      10,
      13,
    )
    await createTestUser({ firstName: 'George', lastName: 'Black', role: 'Candidate', companyId: company.id })
  })

  test('updates client level', async ({ loginAs, page }) => {
    const prisma = getPrisma()

    // 1. Login as admin and navigate to clients page
    await loginAs(admin.id)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    // 2. Find the consultant row and click its info icon
    const rows = page.locator('table tbody tr')
    const consultantRow = rows.filter({ hasText: 'Abby Target' })
    await expect(consultantRow).toBeVisible()
    await consultantRow.locator('td:last-child').click()

    // 3. ClientModal opens — verify default level values displayed
    await expect(page.getByText('Уровень:')).toBeVisible()
    const levelRow = page.getByText('Уровень:').locator('..')
    await expect(levelRow).toContainText('1')

    const confirmedRow = page.getByText('Уровень подтвержден:').locator('..')
    await expect(confirmedRow).toContainText('Да')

    // 4. Click "Изменить уровень" to open UpdateLevelModal
    await page.getByRole('button', { name: 'Изменить уровень' }).click()

    // 5. Check the checkbox is checked
    const checkbox = page.locator('#levelConfirmed')
    await expect(checkbox).toBeChecked()

    // 6. Increase level via stepper "+" button and uncheck levelConfirmed
    await page.getByRole('button', { name: 'Увеличить' }).click()
    await checkbox.click()

    // 7. Click "Сохранить"
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await page.waitForLoadState('networkidle')

    // 8. UpdateLevelModal closes — back to ClientModal. Verify updated values
    await expect(levelRow).toContainText('2')
    await expect(confirmedRow).toContainText('Нет')

    // 9. Verify the database was actually updated
    const updatedUser = await prisma.user.findUnique({ where: { id: targetConsultant.id } })
    expect(updatedUser.level).toBe(2)
    expect(updatedUser.levelConfirmed).toBe(false)

    // 10. Close the consultant's ClientModal
    await page.locator('button[aria-label="Закрыть"]').click()
  })

  test('updates client scores', async ({ loginAs, page }) => {
    const prisma = getPrisma()

    // 1. Login as admin and navigate to clients page
    await loginAs(admin.id)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    // 2. Find the consultant row and click its info icon
    const rows = page.locator('table tbody tr')
    const consultantRow = rows.filter({ hasText: 'Abby Target' })
    await expect(consultantRow).toBeVisible()
    await consultantRow.locator('td:last-child').click()

    // 3. ClientModal opens — verify default score values displayed
    await expect(page.getByText('Личные продажи:')).toBeVisible()
    const scoreRow = page.getByText('Личные продажи:').locator('..')
    await expect(scoreRow).toContainText('10')

    const groupScoreRow = page.getByText('Групповые продажи:').locator('..')
    await expect(groupScoreRow).toContainText('13')

    // 4. Click "Изменить единицы" to open UpdateScoresModal
    await page.getByRole('button', { name: 'Изменить единицы' }).click()

    // 5. Verify default values in the form
    const scoreInput = page.locator('#score')
    await expect(scoreInput).toHaveValue('10')

    const groupScoreInput = page.locator('#groupScore')
    await expect(groupScoreInput).toHaveValue('13')

    // 6. Change values
    await scoreInput.fill('500')
    await groupScoreInput.fill('250')

    // 7. Click "Сохранить"
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await page.waitForLoadState('networkidle')

    // 8. UpdateScoresModal closes — back to ClientModal. Verify updated values
    await expect(scoreRow).toContainText('500')
    await expect(groupScoreRow).toContainText('250')

    // The initial wage was created with the entered score/groupScore
    const wages = await prisma.wage.findMany({ where: { userId: targetConsultant.id } })
    expect(wages).toHaveLength(1)
    expect(wages[0].score).toBe(500)
    expect(wages[0].groupScore).toBe(250)
    expect(wages[0].amount.toString()).toBe('0')

    // 10. Close the consultant's ClientModal
    await page.locator('button[aria-label="Закрыть"]').click()
  })

  test('hides consultant-specific fields and buttons for a candidate', async ({ loginAs, page }) => {
    // 1. Login as admin and navigate to clients page
    await loginAs(admin.id)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    // 2. Find the candidate row and click its info icon
    const rows = page.locator('table tbody tr')
    const candidateRow = rows.filter({ hasText: 'George Black' })
    await expect(candidateRow).toBeVisible()
    await candidateRow.locator('td:last-child').click()

    // 3. Verify consultant-specific fields are NOT shown for a candidate
    await expect(page.getByText('Уровень:')).not.toBeVisible()
    await expect(page.getByText('Уровень подтвержден:')).not.toBeVisible()
    await expect(page.getByText('Личные продажи:')).not.toBeVisible()
    await expect(page.getByText('Групповые продажи:')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Изменить единицы' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Изменить уровень' })).not.toBeVisible()

    // 4. Verify common fields are still shown
    await expect(page.getByText('Имя:')).toBeVisible()
    await expect(page.getByText('Статус:')).toBeVisible()
    await expect(page.getByText('Почта:')).toBeVisible()
  })
})
