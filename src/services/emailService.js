import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Creates a nodemailer transport.
 * In test environment, uses jsonTransport so emails are captured
 * as JSON instead of actually being sent.
 */
const createTransport = () => {
  if (process.env.NODE_ENV === 'test') return nodemailer.createTransport({ jsonTransport: true })

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

/**
 * In test mode, saves the sent email to a fixture file for inspection.
 * This allows E2E tests to read the confirmation code from the file.
 */
const processMailResult = (info, user) => {
  if (process.env.NODE_ENV === 'test') {
    const fixturePath = path.join(__dirname, '../../tests/fixtures/last-email.json')
    const parsed = info.message ? JSON.parse(info.message.toString()) : {}
    const emailContent = {
      to: user.email,
      subject: parsed.subject || info.envelope?.subject,
      text: parsed.text,
    }
    fs.writeFileSync(fixturePath, JSON.stringify(emailContent, null, 2), 'utf-8')
  }
}

/**
 * Sends a 2FA confirmation code email to the user.
 */
export const sendTwoFactorCode = async (user, code) => {
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@ourhouse.app'

  const transport = createTransport()

  const info = await transport.sendMail({
    from: `"Наш Дом" <${fromEmail}>`,
    to: user.email,
    subject: 'Код подтверждения для входа в систему',
    text: `Здравствуйте ${user.firstName || user.nick || 'уважаемый пользователь'},

Вот ваш 6-значный код подтверждения:

${code}

Этот код действителен в течение 10 минут. Если вы не запрашивали этот код, просто проигнорируйте это письмо.

— Наш Дом`,
  })

  processMailResult(info, user)

  return info
}
