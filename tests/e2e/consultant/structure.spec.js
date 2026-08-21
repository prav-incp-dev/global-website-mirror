import { test, expect } from '../fixtures.js'
import { getPrisma } from '../db.js'

const daysAgo = (n) => new Date(Date.now() - n * 86400000)
const daysFromNow = (n) => new Date(Date.now() + n * 86400000)

const toLocalDatetimeString = (date) => {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

test.describe('consultant structure tab', () => {
  let johnId, tomId, teresaId, mariaId

  test.beforeEach(async () => {
    const prisma = getPrisma()

    // Create John — the logged-in consultant
    const john = await prisma.user.create({
      data: {
        email: 'john@example.com',
        password: 'hashed',
        role: 'Consultant',
        nick: '@john',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375330000100',
        memberId: 'DOM-00000000-0100',
        wallet: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        companyId: 1,
      },
    })
    johnId = john.id

    // Create Tom — direct child of John, Consultant
    const tom = await prisma.user.create({
      data: {
        email: 'tom@example.com',
        password: 'hashed',
        role: 'Consultant',
        nick: '@tom',
        firstName: 'Tom',
        lastName: 'Smith',
        phone: '+375330000101',
        memberId: 'DOM-00000000-0101',
        wallet: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        companyId: 1,
        parentId: johnId,
      },
    })
    tomId = tom.id

    // Create Teresa — child of Tom, Candidate
    const teresa = await prisma.user.create({
      data: {
        email: 'teresa@example.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@teresa',
        firstName: 'Teresa',
        lastName: 'Green',
        phone: '+375330000102',
        memberId: 'DOM-00000000-0102',
        companyId: 1,
        parentId: tomId,
      },
    })
    teresaId = teresa.id

    // Create Maria — direct child of John, Candidate
    const maria = await prisma.user.create({
      data: {
        email: 'maria@example.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@maria',
        firstName: 'Maria',
        lastName: 'Brown',
        phone: '+375330000103',
        memberId: 'DOM-00000000-0103',
        companyId: 1,
        parentId: johnId,
      },
    })
    mariaId = maria.id

    // Tom: one closed interaction 40 days ago (stale)
    await prisma.interaction.create({
      data: {
        status: 'Closed',
        plannedAt: daysAgo(40),
        completedAt: daysAgo(40),
        description: 'Initial meeting with Tom',
        targetId: tomId,
      },
    })

    // Teresa: one closed interaction 14 days ago (not stale)
    await prisma.interaction.create({
      data: {
        status: 'Closed',
        plannedAt: daysAgo(14),
        completedAt: daysAgo(14),
        description: 'Follow-up with Teresa',
        targetId: teresaId,
      },
    })

    // Teresa: one open interaction today (attention icon)
    await prisma.interaction.create({
      data: {
        status: 'Open',
        plannedAt: new Date(),
        description: 'Scheduled call with Teresa',
        targetId: teresaId,
      },
    })

    // Maria: one closed interaction yesterday (not stale)
    await prisma.interaction.create({
      data: {
        status: 'Closed',
        plannedAt: daysAgo(2),
        completedAt: daysAgo(2),
        description: 'Intro with Maria',
        targetId: mariaId,
      },
    })
  })

  test('structure tab full workflow', async ({ loginAs, page }) => {
    // 1. Login as John
    await loginAs(johnId)

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
    await expect(page.getByText('Имя:')).toBeVisible()
    await expect(page.getByText('Фамилия:')).toBeVisible()
    await expect(page.getByText('Статус:')).toBeVisible()
    await expect(page.getByText('Почта:')).not.toBeVisible()
    await expect(page.getByText('Номер телефона:')).not.toBeVisible()
    await expect(page.getByText('Номер пайщика:')).not.toBeVisible()
    await expect(page.getByText('Ник в Телеграм:')).not.toBeVisible()
    await expect(page.getByText('Уровень:')).toBeVisible()
    await expect(page.getByText('Личные продажи:')).toBeVisible()
    await expect(page.getByText('Групповые продажи:')).toBeVisible()
    await expect(page.getByText('Дата последнего взаимодействия:')).toBeVisible()
    await expect(page.getByText('Дата запланированного взаимодействия:')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Отметить взаимодействие' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Запланировать взаимодействие' })).not.toBeVisible()

    // Close Teresa's modal
    await page.getByRole('button', { name: 'Закрыть' }).click()

    // 6. Click Tom's info icon
    const tomInfoIcon = page.getByText('Tom Smith').locator('..').locator('..').locator('[title="Данные пользователя"]')
    await tomInfoIcon.click()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()

    // Click "Отметить взаимодействие"
    await expect(page.getByText('Имя:')).toBeVisible()
    await expect(page.getByText('Фамилия:')).toBeVisible()
    await expect(page.getByText('Статус:')).toBeVisible()
    await expect(page.getByText('Почта:')).toBeVisible()
    await expect(page.getByText('Номер телефона:')).toBeVisible()
    await expect(page.getByText('Номер пайщика:')).toBeVisible()
    await expect(page.getByText('Ник в Телеграм:')).toBeVisible()
    await expect(page.getByText('Уровень:')).toBeVisible()
    await expect(page.getByText('Личные продажи:')).toBeVisible()
    await expect(page.getByText('Групповые продажи:')).toBeVisible()
    await expect(page.getByText('Дата последнего взаимодействия:')).toBeVisible()
    await expect(page.getByText('Дата запланированного взаимодействия:')).toBeVisible()
    await page.getByRole('button', { name: 'Отметить взаимодействие' }).click()
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
    const lastInteractionRow = page.getByText('Дата последнего взаимодействия:').locator('..')
    await expect(lastInteractionRow.getByText(yesterday.toLocaleDateString('ru-RU'))).toBeVisible()

    // Close Tom's modal
    await page.getByRole('button', { name: 'Закрыть' }).click()

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

    // Schedule interaction in a week
    await page.getByRole('button', { name: 'Запланировать взаимодействие' }).click()
    await expect(page.getByRole('heading', { name: 'Запланировать взаимодействие' })).toBeVisible()

    const oneWeek = daysFromNow(7)
    const oneWeekStr = toLocalDatetimeString(oneWeek)
    await page.locator('#plannedAt').fill(oneWeekStr)
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await expect(page.getByRole('heading', { name: 'Запланировать взаимодействие' })).not.toBeVisible()

    // Verify next interaction date is updated
    const nextInteractionRow = page.getByText('Дата запланированного взаимодействия:').locator('..')
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
    await page.getByRole('button', { name: 'Закрыть' }).click()

    // Verify scheduled date was stored. Re-open Maria's modal
    await mariaInfoIcon.click()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()
    await expect(nextInteractionRow.getByText(tomorrow.toLocaleDateString('ru-RU'))).toBeVisible()

    // Close Maria's modal
    await page.getByRole('button', { name: 'Закрыть' }).click()

    // 8. Switch tabs and back — verify dates are not reset
    await page.getByRole('button', { name: 'Профиль' }).click()
    await page.getByRole('button', { name: 'Структура' }).click()

    // Verify Tom's last interaction date (yesterday) is still there
    await expect(page.getByText(yesterday.toLocaleDateString('ru-RU'))).toBeVisible()
  })
})
