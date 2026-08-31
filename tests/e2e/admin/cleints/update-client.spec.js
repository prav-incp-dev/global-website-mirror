import { test, expect } from '../../fixtures.js'
import { getPrisma } from '../../db.js'

test.describe('update client achievements flow', () => {
  let adminId
  let targetConsultantId

  test.beforeEach(async () => {
    const prisma = getPrisma()

    const company = await prisma.company.create({
      data: {
        name: 'Achievements Test Company',
        primaryWallet: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    })

    const adminUser = await prisma.user.create({
      data: {
        email: 'achievements-admin@example.com',
        password: 'hashed',
        role: 'Admin',
        nick: '@achievements-admin',
        firstName: 'Achieve',
        lastName: 'Admin',
        phone: '+375290000600',
        memberId: 'DOM-00000000-0600',
        wallet: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        companyId: company.id,
      },
    })
    adminId = adminUser.id

    const targetConsultant = await prisma.user.create({
      data: {
        email: 'achievements-consultant@example.com',
        password: 'hashed',
        role: 'Consultant',
        nick: '@achievements-consultant',
        firstName: 'Test',
        lastName: 'Consultant',
        phone: '+375290000601',
        memberId: 'DOM-00000000-0601',
        wallet: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        level: 1,
        levelConfirmed: true,
        score: 10,
        companyId: company.id,
      },
    })
    targetConsultantId = targetConsultant.id

    await prisma.user.create({
      data: {
        email: 'achievements-candidate@example.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@achievements-candidate',
        firstName: 'Test',
        lastName: 'Candidate',
        phone: '+375290000602',
        memberId: 'DOM-00000000-0602',
        wallet: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        companyId: company.id,
      },
    })
  })

  test('update client achievements flow', async ({ loginAs, page }) => {
    const prisma = getPrisma()

    // 1. Login as admin and navigate to clients page
    await loginAs(adminId)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    // 2. Find the consultant row and click its info icon
    const rows = page.locator('table tbody tr')
    const consultantRow = rows.filter({ hasText: 'Test Consultant' })
    await expect(consultantRow).toBeVisible()
    await consultantRow.locator('td:last-child').click()

    // 3. ClientModal opens — verify default values displayed
    await expect(page.getByText('Уровень:')).toBeVisible()
    const levelRow = page.getByText('Уровень:').locator('..')
    await expect(levelRow).toContainText('1')

    const confirmedRow = page.getByText('Уровень подтвержден:').locator('..')
    await expect(confirmedRow).toContainText('Да')

    const scoreRow = page.getByText('Личные продажи:').locator('..')
    await expect(scoreRow).toContainText('10')

    // 4. Click "Изменить достижения" to open UpdateClientModal
    await page.getByRole('button', { name: 'Изменить достижения' }).click()

    // 5. Verify default values in the form
    const scoreInput = page.locator('input[type="number"]')
    await expect(scoreInput).toHaveValue('10')

    // Check the stepper shows level 1
    const stepperValue = page.locator('text=1').last()
    await expect(stepperValue).toBeVisible()

    // Check the checkbox is checked
    const checkbox = page.locator('#levelConfirmed')
    await expect(checkbox).toBeChecked()

    // 6. Change values
    // Update score
    await scoreInput.fill('500')

    // Increase level via stepper "+" button
    await page.getByRole('button', { name: 'Увеличить' }).click()

    // Uncheck levelConfirmed
    await checkbox.click()

    // 7. Click "Сохранить"
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await page.waitForLoadState('networkidle')

    // 8. UpdateClientModal closes — back to ClientModal. Verify updated values.
    await expect(levelRow).toContainText('2')
    await expect(confirmedRow).toContainText('Нет')
    await expect(scoreRow).toContainText('500')

    // 9. Verify the database was actually updated
    const updatedUser = await prisma.user.findUnique({ where: { id: targetConsultantId } })
    expect(updatedUser.level).toBe(2)
    expect(updatedUser.levelConfirmed).toBe(false)
    expect(updatedUser.score).toBe(500)

    // 10. Close the consultant's ClientModal
    await page.locator('button[aria-label="Закрыть"]').click()

    // 11. Find the candidate row and click its info icon
    const candidateRow = rows.filter({ hasText: 'Test Candidate' })
    await expect(candidateRow).toBeVisible()
    await candidateRow.locator('td:last-child').click()

    // 12. Verify consultant-specific fields are NOT shown for a candidate
    await expect(page.getByText('Уровень:')).not.toBeVisible()
    await expect(page.getByText('Уровень подтвержден:')).not.toBeVisible()
    await expect(page.getByText('Личные продажи:')).not.toBeVisible()
    await expect(page.getByText('Групповые продажи:')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Изменить достижения' })).not.toBeVisible()

    // 13. Verify common fields are still shown
    await expect(page.getByText('Имя:')).toBeVisible()
    await expect(page.getByText('Статус:')).toBeVisible()
    await expect(page.getByText('Почта:')).toBeVisible()
  })
})
