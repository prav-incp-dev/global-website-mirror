import { test, expect } from '../fixtures.js'
import { getPrisma } from '../db.js'

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
    const orphansButton = page.getByRole('button', { name: 'Без родителя (11)' })
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

    // 5. Click 'Без родителя (11)' — filter orphans only
    await page.getByRole('button', { name: 'Без родителя (11)' }).click()
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

    // 6. Click 'Без родителя (11)' again — all records back
    await page.getByRole('button', { name: 'Без родителя (11)' }).click()
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

    // Button shows 'Без родителя (1)'
    await expect(page.getByRole('button', { name: 'Без родителя (1)' })).toBeVisible()
  })

  test('change parent flow: clear parent from a client with parent', async ({ loginAs, page }) => {
    // 1. Login as admin and navigate to clients page
    await loginAs(adminId)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    // 2. The first client in the list is the last created Tom (sorted by id desc)
    //    which has a parent set to johns[0] (John Doe0)
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(20)

    // 3. Click the info icon on the first row (last td in the row)
    await rows.first().locator('td:last-child').click()

    // 4. ClientModal should be visible — verify it shows parent info
    const parentLabel = page.getByText('Родитель:')
    await expect(parentLabel).toBeVisible()

    // The parent value should show "John Doe0"
    const parentRow = parentLabel.locator('..')
    await expect(parentRow).toContainText('John Doe0')

    // 5. Click "Изменить родителя" to open UpdateParentModal
    const changeParentButton = page.getByRole('button', { name: 'Изменить родителя' })
    await changeParentButton.click()

    // 6. UpdateParentModal shows a chip with the current parent name
    //    Verify the chip shows "John Doe0", then clear it
    const clearButton = page.locator('button[aria-label="Очистить"]')
    const chip = clearButton.locator('..')
    await expect(chip).toContainText('John Doe0')
    await clearButton.click()

    // 7. Click "Сохранить" to save the change (parent → null)
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await page.waitForLoadState('networkidle')

    // 8. UpdateParentModal disappears. ClientModal should now show "Нет родителя"
    await expect(parentLabel).toBeVisible()
    await expect(parentLabel.locator('..')).toContainText('Нет родителя')

    // 9. Click "Изменить родителя" again — now the search input is empty by default
    await changeParentButton.click()

    // 10. Type "j" (1 char) — nothing shown (minimum 2 chars required)
    const searchInput = page.locator('input[placeholder="Начните вводить имя для поиска"]')
    await searchInput.fill('j')
    await expect(page.getByText('Ничего не найдено')).not.toBeVisible()
    await expect(page.getByTestId('parent-search-dropdown')).not.toBeVisible()

    // 11. Type "jo" (2 chars) — after debounce, dropdown with 10 John options appears
    await searchInput.fill('jo')
    await expect(page.getByTestId('parent-search-dropdown')).toBeVisible()
    const options = page.getByTestId('parent-search-dropdown').locator('li')
    await expect(options).toHaveCount(10)

    // 12. Type "jod" (3 chars) — no matches, "Ничего не найдено" appears
    await searchInput.fill('jod')
    await expect(page.getByText('Ничего не найдено')).toBeVisible()
    await expect(page.getByTestId('parent-search-dropdown')).not.toBeVisible()

    // 13. Delete last character (back to "jo") — dropdown with 10 Johns returns
    await searchInput.fill('jo')
    await expect(page.getByTestId('parent-search-dropdown')).toBeVisible()
    await expect(page.getByText('Ничего не найдено')).not.toBeVisible()
    await expect(options).toHaveCount(10)

    // 14. Click the very first option in the list and capture its name
    //     The first span inside the <li> holds the "firstName lastName" name
    const firstOption = options.first()
    const selectedName = (await firstOption.locator('span').first().textContent()).trim()
    await firstOption.click()

    // 15. The chip now shows the selected parent name
    const newChip = page.locator('button[aria-label="Очистить"]').locator('..')
    await expect(newChip).toContainText(selectedName.trim())

    // 16. Click "Сохранить" to save the parent change
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await page.waitForLoadState('networkidle')

    // 17. UpdateParentModal closes. ClientModal should now show the selected parent name
    await expect(parentLabel).toBeVisible()
    await expect(parentLabel.locator('..')).toContainText(selectedName.trim())
  })
})

test('update client achievements flow', async ({ loginAs, page }) => {
  const prisma = getPrisma()

  // Create a dedicated company and users for this scenario to avoid interference
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

  // 1. Login as admin and navigate to clients page
  await loginAs(adminUser.id)
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
  const updatedUser = await prisma.user.findUnique({ where: { id: targetConsultant.id } })
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
