import { test, expect } from './fixtures.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createTestCompany, createTestUser } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = path.join(__dirname, '..', 'fixtures', 'last-email.json')
// Real, valid PNG already present in the test fixtures.
const attachPath = path.join(__dirname, '..', 'fixtures', 'test-attach.png')

const testMessage = 'Привет, проверяем фикстуру last-email!'

/**
 * Reads and parses the last email fixture once the async on-disk write has finished.
 * Polls briefly so the test doesn't race the server writing the file.
 */
const readLastEmail = async () => {
  await expect(async () => {
    expect(fs.existsSync(fixturePath)).toBeTruthy()
  }).toPass({ timeout: 5_000 })

  return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
}

test.describe('Форма "Contact Us" (Проверка через last-email.json)', () => {
  let consultant

  test.beforeEach(async () => {
    // Clean any stale fixture from a previous test within the run.
    if (fs.existsSync(fixturePath)) {
      fs.unlinkSync(fixturePath)
    }

    const company = await createTestCompany('Contact Us Company')
    // An admin is required so the route has a recipient for the contact email.
    await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
    consultant = await createTestUser({
      firstName: 'Contact',
      lastName: 'User',
      role: 'Candidate',
      companyId: company.id,
    })
  })

  test('отправляет обращение и создает фикстуру письма для админов', async ({ loginAs, page }) => {
    await loginAs(consultant.id)
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // 1. Открываем модальное окно "Contact Us"
    await page.locator('button[title="Связаться с администрацией"]').click()
    await expect(page.getByRole('heading', { name: 'Связаться с нами' })).toBeVisible()

    // 2. Заполняем сообщение (email берется из сессии авторизованного пользователя)
    await page.locator('#contact-message').fill(testMessage)
    await expect(page.locator('#contact-message')).toHaveValue(testMessage)

    // 3. Загружаем тестовое вложение (PNG)
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Прикрепить файл' }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(attachPath)

    // 4. Отправляем форму
    await page.getByRole('button', { name: 'Отправить' }).click()

    // 5. Модальное окно остаётся открытым и показывает успех внутри себя;
    //    форма (textarea, прикрепление файла, кнопка отправки) скрыта
    await expect(page.getByRole('heading', { name: 'Связаться с нами' })).toBeVisible()
    await expect(page.getByText('Запрос отправлен. Вам ответят в ближайшее время.')).toBeVisible()
    await expect(page.locator('#contact-message')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Прикрепить файл' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Отправить' })).not.toBeVisible()

    // 6. Ждем асинхронную запись фикстуры на диск и читаем её
    const mailData = await readLastEmail()

    // 7. Проверяем тему письма
    expect(mailData.subject).toBe('Запрос от пользователя')

    // 8. Проверяем получателя — email отправившего пользователя
    expect(mailData.to).toBe(consultant.email)

    // 9. Проверяем, что в тексте письма оказался текст сообщения пользователя
    expect(mailData.text).toContain(testMessage)

    // 10. Проверяем, что вложение дошло и сохранило расширение файла
    // (имя файла генерируется на сервере как UUID, расширение исходника сохраняется)
    expect(mailData.attachments).toHaveLength(1)
    expect(mailData.attachments[0].filename).toMatch(/\.png$/)
  })

  test('показывает ошибку валидации при пустом сообщении', async ({ loginAs, page }) => {
    await loginAs(consultant.id)
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    await page.locator('button[title="Связаться с администрацией"]').click()
    await expect(page.getByRole('heading', { name: 'Связаться с нами' })).toBeVisible()

    await page.getByRole('button', { name: 'Отправить' }).click()

    await expect(page.getByText('Введите сообщение')).toBeVisible()
  })
})
