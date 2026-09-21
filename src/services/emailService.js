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
    requireTLS: process.env.SMTP_TLS === 'true' ? true : false,
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
    text: `Здравствуйте ${user.firstName || user.nick || 'уважаемый пользователь'},\n\nВот ваш 6-значный код подтверждения:\n\n${code}\n\nЭтот код действителен в течение 10 минут. Если вы не запрашивали этот код, просто проигнорируйте это письмо.\n\n— Наш Дом`,
  })

  processMailResult(info, user)

  return info
}

/**
 * Sends a password reset email with a link containing the JWT token.
 */
export const sendPasswordResetEmail = async (user, token) => {
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@ourhouse.app'
  const transport = createTransport()
  const link = `${process.env.BASE_URL}/reset?token=${token}`

  const info = await transport.sendMail({
    from: `"Наш Дом" <${fromEmail}>`,
    to: user.email,
    subject: 'Сброс пароля',
    text: `Здравствуйте ${user.firstName || 'уважаемый пользователь'}!\n\nВы запросили сброс пароля. Для установки нового пароля перейдите по ссылке:\n${link}\n\nСсылка действительна в течение 1 часа. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.\n\n— Наш Дом`,
    html: `<p>Здравствуйте ${user.firstName || 'уважаемый пользователь'}!</p>
          <p>Вы запросили сброс пароля. Для установки нового пароля <a href="${link}">нажмите здесь</a>.</p>
          <p>Ссылка действительна в течение 1 часа. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
          <p>— Наш Дом</p>`,
  })

  processMailResult(info, user)

  return info
}

/**
 * Sends a registration confirmation email to the user.
 */
export const sendRegistrationConfirmation = async (user) => {
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@ourhouse.app'
  const transport = createTransport()
  const link = `${process.env.BASE_URL}/auth`

  const info = await transport.sendMail({
    from: `"Наш Дом" <${fromEmail}>`,
    to: user.email,
    subject: 'Добро пожаловать в Наш Дом!',
    text: `Здравствуйте ${user.firstName || 'уважаемый пользователь'}!\n\nБлагодарим вас за регистрацию в системе "Наш Дом".\n\nДля входа в систему, пожалуйста, перейдите по следующей ссылке:\n${link}\n\nС уважением,\nКоманда "Наш Дом"`,
    html: `<p>Здравствуйте ${user.firstName || 'уважаемый пользователь'}!</p>
          <p>Благодарим вас за регистрацию в системе "Наш Дом".</p>
          <p>Для входа в систему, пожалуйста, <a href="${link}">нажмите здесь</a>.</p>
          <p>С уважением,<br>Команда "Наш Дом"</p>`,
  })

  processMailResult(info, user)

  return info
}

/**
 * Sends a reminder email about a scheduled interaction.
 */
export const sendInteractionReminder = async (initiator, targetName) => {
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@ourhouse.app'
  const transport = createTransport()

  const info = await transport.sendMail({
    from: `"Наш Дом" <${fromEmail}>`,
    to: initiator.email,
    subject: 'Напоминание о взаимодействии',
    text: `Здравствуйте ${initiator.firstName || initiator.nick || 'уважаемый пользователь'}!\n\nНапоминаем, что у вас запланировано взаимодействие с ${targetName}\n\n— Наш Дом`,
  })

  processMailResult(info, initiator)

  return info
}
