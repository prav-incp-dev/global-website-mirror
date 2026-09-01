import { test, expect } from '../fixtures.js'
import { createTestCompany, createTestUser, createTestInteraction } from '../db.js'

const daysAgo = (n) => new Date(Date.now() - n * 86400000)
const daysFromNow = (n) => new Date(Date.now() + n * 86400000)

const toLocalDatetimeString = (date) => {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

test.describe('consultant structure tab', () => {
  let john, tom, teresa, maria

  test.beforeEach(async () => {
    const company = await createTestCompany('Consultant Structure')
    // Create John — the logged-in consultant
    john = await createTestUser({ firstName: 'John', lastName: 'Doe', role: 'Consultant', companyId: company.id })
    // Create Tom — direct child of John, Consultant
    tom = await createTestUser(
      { firstName: 'Tom', lastName: 'Smith', role: 'Consultant', companyId: company.id, parentId: john.id },
      13,
      2,
    )

    // Create Teresa — child of Tom, Candidate
    teresa = await createTestUser({ firstName: 'Teresa', lastName: 'Green', role: 'Candidate', companyId: company.id, parentId: tom.id })

    // Create Maria — direct child of John, Candidate
    maria = await createTestUser({ firstName: 'Maria', lastName: 'Brown', role: 'Candidate', companyId: company.id, parentId: john.id })

    // Tom: one closed interaction 40 days ago (stale)
    await createTestInteraction({
      status: 'Closed',
      plannedAt: daysAgo(40),
      completedAt: daysAgo(40),
      description: 'Initial meeting with Tom',
      targetId: tom.id,
    })

    // Teresa: one closed interaction 14 days ago (not stale)
    await createTestInteraction({
      status: 'Closed',
      plannedAt: daysAgo(14),
      completedAt: daysAgo(14),
      description: 'Follow-up with Teresa',
      targetId: teresa.id,
    })

    // Teresa: one open interaction today (attention icon)
    await createTestInteraction({
      status: 'Open',
      plannedAt: new Date(),
      description: 'Scheduled call with Teresa',
      targetId: teresa.id,
    })

    // Maria: one closed interaction yesterday (not stale)
    await createTestInteraction({
      status: 'Closed',
      plannedAt: daysAgo(2),
      completedAt: daysAgo(2),
      description: 'Intro with Maria',
      targetId: maria.id,
    })
  })

  test('structure tab full workflow', async ({ loginAs, page }) => {
    // 1. Login as John
    await loginAs(john.id)

    // 2. Click 'Structure' tab
    await page.getByRole('button', { name: 'Структура' }).click()

    // Verify Tom and Maria are visible with their types
    await expect(page.getByText('Tom Smith')).toBeVisible()
    await expect(page.getByText('Maria Brown')).toBeVisible()

    // Tom is Consultant (green checkmark), Maria is Candidate (no checkmark)
    await expect(page.locator('[title="Консультант"]')).toBeVisible()

    // Tom has arrow (expandable), Maria does not
    const tomRow = page.getByText('Tom Smith').locator('..')
    const mariaRow = page.getByText('Maria Brown').locator('..')

    // Tom's row should have an arrow (▶)
    await expect(tomRow.locator('..').getByText('▶')).toBeVisible()
    // Maria's row should not have an arrow
    await expect(mariaRow.locator('..').getByText('▶')).not.toBeVisible()

    // 3. Click Tom to expand and see Teresa
    await page.getByText('Tom Smith').click()
    await expect(page.getByText('Teresa Green')).toBeVisible()

    // Teresa has attention icon (nextInteractionDate is overdue)
    await expect(page.locator('[title="Назначено взаимодействие"]')).toBeVisible()

    // 4. Verify Tom and Teresa have red color (stale), Maria has white color
    const staleColor = 'rgb(229, 57, 53)'

    // Tom should be red
    const tomRowElement = page.getByText('Tom Smith').locator('..').locator('..')
    await expect(tomRowElement).toHaveCSS('color', staleColor)

    // Teresa should NOT be red
    const teresaRowElement = page.getByText('Teresa Green').locator('..').locator('..')
    await expect(teresaRowElement).not.toHaveCSS('color', staleColor)

    // Maria should NOT be red
    const mariaRowElement = page.getByText('Maria Brown', { exact: true }).locator('..').locator('..')
    await expect(mariaRowElement).not.toHaveCSS('color', staleColor)

    // 5. Click Teresa's info icon — modal opens, no interaction buttons
    const teresaInfoIcon = page
      .getByText('Teresa Green')
      .locator('..')
      .locator('..')
      .locator('[title="Данные пользователя"]')
    await teresaInfoIcon.click()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()

    const userModal = page.getByRole('heading', { name: 'Информация о пользователе' }).locator('..').locator('..')

    const teresaFirstNameRow = userModal.getByText('Имя:').locator('..')
    await expect(teresaFirstNameRow).toContainText('Teresa')
    const teresaLastNameRow = userModal.getByText('Фамилия:').locator('..')
    await expect(teresaLastNameRow).toContainText('Green')
    const teresaStatusRow = userModal.getByText('Статус:').locator('..')
    await expect(teresaStatusRow).toContainText('Кандидат')
    await expect(userModal.getByText('Почта:')).not.toBeVisible()
    await expect(userModal.getByText('Номер телефона:')).not.toBeVisible()
    await expect(userModal.getByText('Номер пайщика:')).not.toBeVisible()
    await expect(userModal.getByText('Ник в Телеграм:')).not.toBeVisible()
    await expect(userModal.getByText('Уровень:')).not.toBeVisible()
    await expect(userModal.getByText('Личные продажи:')).not.toBeVisible()
    await expect(userModal.getByText('Групповые продажи:')).not.toBeVisible()
    await expect(userModal.getByText('Дата последнего взаимодействия:')).toBeVisible()
    await expect(userModal.getByText('Дата запланированного взаимодействия:')).toBeVisible()
    await expect(userModal.getByRole('button', { name: 'Отметить взаимодействие' })).not.toBeVisible()
    await expect(userModal.getByRole('button', { name: 'Запланировать взаимодействие' })).not.toBeVisible()

    // Close Teresa's modal
    await userModal.getByRole('button', { name: 'Закрыть' }).click()

    // 6. Click Tom's info icon
    const tomInfoIcon = page.getByText('Tom Smith').locator('..').locator('..').locator('[title="Данные пользователя"]')
    await tomInfoIcon.click()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()

    const tomModal = page.getByRole('heading', { name: 'Информация о пользователе' }).locator('..').locator('..')

    const tomFirstNameRow = userModal.getByText('Имя:').locator('..')
    await expect(tomFirstNameRow).toContainText('Tom')
    const tomLastNameRow = userModal.getByText('Фамилия:').locator('..')
    await expect(tomLastNameRow).toContainText('Smith')
    const tomStatusRow = userModal.getByText('Статус:').locator('..')
    await expect(tomStatusRow).toContainText('Консультант')
    await expect(tomModal.getByText('Имя:')).toBeVisible()
    await expect(tomModal.getByText('Фамилия:')).toBeVisible()
    await expect(tomModal.getByText('Статус:')).toBeVisible()
    await expect(tomModal.getByText('Почта:')).toBeVisible()
    await expect(tomModal.getByText('Номер телефона:')).toBeVisible()
    await expect(tomModal.getByText('Номер пайщика:')).toBeVisible()
    await expect(tomModal.getByText('Ник в Телеграм:')).toBeVisible()
    await expect(tomModal.getByText('Уровень:')).toBeVisible()
    const tomScoreRow = userModal.getByText('Личные продажи:').locator('..')
    await expect(tomScoreRow).toContainText('13')
    const tomGroupScoreRow = userModal.getByText('Групповые продажи:').locator('..')
    await expect(tomGroupScoreRow).toContainText('2')
    await expect(tomModal.getByText('Дата последнего взаимодействия:')).toBeVisible()
    await expect(tomModal.getByText('Дата запланированного взаимодействия:')).toBeVisible()
    await tomModal.getByRole('button', { name: 'Отметить взаимодействие' }).click()
    await expect(page.getByRole('heading', { name: 'Отметить взаимодействие' })).toBeVisible()

    // Enter yesterday's date
    const yesterday = daysAgo(1)
    const yesterdayStr = toLocalDatetimeString(yesterday)
    await page.locator('#completedAt').fill(yesterdayStr)

    // Add description
    await page.locator('#description').fill('Follow-up meeting completed')

    // Submit
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await expect(page.getByRole('heading', { name: 'Отметить взаимодействие' })).not.toBeVisible()

    // Verify last interaction date is updated for Tom (yesterday) inside the modal
    const lastInteractionRow = tomModal.getByText('Дата последнего взаимодействия:').locator('..')
    await expect(lastInteractionRow.getByText(yesterday.toLocaleDateString('ru-RU'))).toBeVisible()

    // Close Tom's modal
    await tomModal.getByRole('button', { name: 'Закрыть' }).click()

    // Verify Tom and Teresa are no longer red
    await expect(tomRowElement).not.toHaveCSS('color', staleColor)

    // 7. Click Maria's info icon
    const mariaInfoIcon = page
      .getByText('Maria Brown')
      .locator('..')
      .locator('..')
      .locator('[title="Данные пользователя"]')
    await mariaInfoIcon.click()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()

    const mariaModal = page.getByRole('heading', { name: 'Информация о пользователе' }).locator('..').locator('..')

    // Schedule interaction in a week
    await mariaModal.getByRole('button', { name: 'Запланировать взаимодействие' }).click()
    await expect(page.getByRole('heading', { name: 'Запланировать взаимодействие' })).toBeVisible()

    const oneWeek = daysFromNow(7)
    const oneWeekStr = toLocalDatetimeString(oneWeek)
    await page.locator('#plannedAt').fill(oneWeekStr)
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await expect(page.getByRole('heading', { name: 'Запланировать взаимодействие' })).not.toBeVisible()

    // Verify next interaction date is updated
    const nextInteractionRow = mariaModal.getByText('Дата запланированного взаимодействия:').locator('..')
    await expect(nextInteractionRow.getByText(oneWeek.toLocaleDateString('ru-RU'))).toBeVisible()

    // Schedule again — verify previous date is default
    await page.getByRole('button', { name: 'Запланировать взаимодействие' }).click()
    await expect(page.getByRole('heading', { name: 'Запланировать взаимодействие' })).toBeVisible()
    const plannedAtInput = page.locator('#plannedAt')
    const defaultValue = await plannedAtInput.inputValue()
    expect(defaultValue).toBe(oneWeekStr)

    // Change to tomorrow
    const tomorrow = daysFromNow(1)
    const tomorrowStr = toLocalDatetimeString(tomorrow)
    await plannedAtInput.fill(tomorrowStr)
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await expect(page.getByRole('heading', { name: 'Запланировать взаимодействие' })).not.toBeVisible()

    // Verify date changed
    await expect(nextInteractionRow.getByText(tomorrow.toLocaleDateString('ru-RU'))).toBeVisible()

    // Close Maria's modal
    await mariaModal.getByRole('button', { name: 'Закрыть' }).click()

    // Verify scheduled date was stored. Re-open Maria's modal
    await mariaInfoIcon.click()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()
    const mariaModalReopened = page
      .getByRole('heading', { name: 'Информация о пользователе' })
      .locator('..')
      .locator('..')
    await expect(mariaModalReopened.getByText(tomorrow.toLocaleDateString('ru-RU'))).toBeVisible()

    // Close Maria's modal
    await mariaModalReopened.getByRole('button', { name: 'Закрыть' }).click()

    // 8. Switch tabs and back — verify dates are not reset
    await page.getByRole('button', { name: 'Профиль' }).click()
    await page.getByRole('button', { name: 'Структура' }).click()

    // Verify Tom's last interaction date (yesterday) is still there
    await expect(page.getByText(yesterday.toLocaleDateString('ru-RU'))).toBeVisible()
  })
})
