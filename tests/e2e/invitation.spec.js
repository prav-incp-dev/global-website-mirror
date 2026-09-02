import { test, expect } from './fixtures.js'
import { createTestCompany, createTestUser } from './db.js'
import jwt from 'jsonwebtoken'

/**
 * Extracts the JWT token from the invitation URL in the modal textarea.
 */
const getInvitationTokenFromModal = async (page) => {
  // Wait for the textarea to contain the invitation URL (loading finished)
  const textarea = page.locator('textarea')
  await expect(textarea).toBeVisible()

  // Wait until the textarea has a non-empty value (the invitation URL)
  await expect(async () => {
    const value = await textarea.inputValue()
    expect(value).toContain('/register?token=')
  }).toPass({ timeout: 10_000 })

  // Extract the token from the URL
  const invitationUrl = await textarea.inputValue()
  const urlObj = new URL(invitationUrl)
  const token = urlObj.searchParams.get('token')
  expect(token).toBeTruthy()

  return token
}

test.describe('generate invitation link', () => {
  let admin
  let consultant

  test.beforeEach(async () => {
    const company = await createTestCompany('Invitation Company')

    // Create admin
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
    // Create consultant
    consultant = await createTestUser({ firstName: 'Bob', lastName: 'Consultant', role: 'Consultant', companyId: company.id })
  })

  test('Admin generates invitation link with owner=null', async ({ context, page, loginAs }) => {
    // Grant clipboard permissions so the copy button works
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    // Login as admin (user id = 1)
    await loginAs(admin.id)

    // Verify admin email is visible on profile
    await expect(page).toHaveURL('http://127.0.0.1:3101/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await expect(page.getByText(admin.email)).toBeVisible()

    // Click "Generate invitation" button
    const inviteButton = page.locator('button', { hasText: 'Сгенерировать пригласительную ссылку' })
    await inviteButton.scrollIntoViewIfNeeded()
    await inviteButton.click()

    // Wait for the modal overlay to appear
    await expect(page.locator('div[class*="overlay"]')).toBeVisible({ timeout: 5_000 })

    // Wait for the modal to appear
    await expect(page.getByRole('heading', { name: 'Пригласительная ссылка' })).toBeVisible()

    // Get the token from the modal textarea
    const token = await getInvitationTokenFromModal(page)

    // Click "Copy link" button
    await page.locator('button[title="Копировать"]').click()

    // Verify the copy button shows the copied state (CheckIcon)
    await expect(page.locator('button[title="Скопировано"]')).toBeVisible()

    // Decode the JWT and verify its payload
    const decoded = jwt.decode(token)
    expect(decoded.owner).toBeNull()
    expect(decoded).toHaveProperty('inviteCode')
    expect(typeof decoded.inviteCode).toBe('string')
    expect(decoded.inviteCode).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(decoded).toHaveProperty('exp')
    expect(decoded).toHaveProperty('iat')

    // Click close button
    await page.getByRole('button', { name: 'Закрыть' }).click()

    // Verify modal is closed and we are back on the profile page
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await expect(page.getByText(admin.email)).toBeVisible()
  })

  test('It generates different invitation tokens each time', async ({ context, page, loginAs }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await loginAs(consultant.id)
    await expect(page).not.toHaveURL(/\/auth$/)
    await expect(page.getByText(consultant.email)).toBeVisible()
    await expect(page.locator('text=Ник в Телеграм')).toBeVisible()

    // First token
    const inviteButton = page.locator('button', { hasText: 'Сгенерировать пригласительную ссылку' })
    await inviteButton.scrollIntoViewIfNeeded()
    await inviteButton.click()
    await expect(page.locator('div[class*="overlay"]')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('heading', { name: 'Пригласительная ссылка' })).toBeVisible()
    const token1 = await getInvitationTokenFromModal(page)
    await page.getByRole('button', { name: 'Закрыть' }).click()
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()

    // Second token
    await inviteButton.click()
    await expect(page.locator('div[class*="overlay"]')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('heading', { name: 'Пригласительная ссылка' })).toBeVisible()
    const token2 = await getInvitationTokenFromModal(page)

    // Assert tokens are different
    expect(token1).not.toBe(token2)
  })

  test('Consultant generates invitation link with owner=userId', async ({ context, page, loginAs }) => {
    // Grant clipboard permissions so the copy button works
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    // Login as consultant (user id = 2)
    await loginAs(consultant.id)
    await expect(page).not.toHaveURL(/\/auth$/)

    // Verify consultant email is visible on profile
    await expect(page.getByText(consultant.email)).toBeVisible()

    // Wait for the profile card to be fully rendered
    await expect(page.locator('text=Ник в Телеграм')).toBeVisible()

    // Click "Generate invitation" button
    const inviteButton = page.locator('button', { hasText: 'Сгенерировать пригласительную ссылку' })
    await inviteButton.scrollIntoViewIfNeeded()
    await inviteButton.click()

    // Wait for the modal overlay to appear
    await expect(page.locator('div[class*="overlay"]')).toBeVisible({ timeout: 5_000 })

    // Wait for the modal to appear
    await expect(page.getByRole('heading', { name: 'Пригласительная ссылка' })).toBeVisible()

    // Get the token from the modal textarea
    const token = await getInvitationTokenFromModal(page)

    // Click "Copy link" button
    await page.locator('button[title="Копировать"]').click()

    // Verify the copy button shows the copied state (CheckIcon)
    await expect(page.locator('button[title="Скопировано"]')).toBeVisible()

    // Decode the JWT and verify its payload
    const decoded = jwt.decode(token)
    // Consultant is the second user created, so id should be 2
    expect(decoded.owner).toBe(consultant.id)
    expect(decoded).toHaveProperty('inviteCode')
    expect(typeof decoded.inviteCode).toBe('string')
    expect(decoded.inviteCode).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(decoded).toHaveProperty('exp')
    expect(decoded).toHaveProperty('iat')

    // Click close button
    await page.getByRole('button', { name: 'Закрыть' }).click()

    // Verify modal is closed and we are back on the profile page
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
    await expect(page.getByText(consultant.email)).toBeVisible()
  })
})
