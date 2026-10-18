import 'dotenv/config'
import fastifyVite from '@fastify/vite'
import fastifyCron from 'fastify-cron'
import { buildBackendApp } from './backend.js'
import { setEmailSettings } from './src/services/emailService.js'
import { decryptSecret } from './src/lib/crypto.js'
import { checkUpcomingInteractions } from './src/jobs/interactionReminder.js'
import { orphantUsers } from './src/jobs/inactivityChecker.js'
import { checkPayments } from './src/jobs/paymentsChecker.js'
import { checkLevel } from './src/jobs/levelConfirmer.js'

const server = await buildBackendApp({ logger: true })

// Load persisted email/SMTP settings into the in-memory cache used by emailService.
const setting = await server.prisma.setting.findFirst()
const storedEmail = setting?.general?.email ?? {}

setEmailSettings({
  fromEmail: storedEmail.fromEmail || process.env.FROM_EMAIL || process.env.SMTP_USER || 'support@in-cp.com',
  fromName: storedEmail.fromName || 'INCP PK ND',
  smtpHost: storedEmail.smtpHost || process.env.SMTP_HOST || 'smtp.protonmail.ch',
  smtpPort: storedEmail.smtpPort || parseInt(process.env.SMTP_PORT, 10) || 587,
  smtpUser: storedEmail.smtpUser || process.env.SMTP_USER || '',
  smtpPass: storedEmail.smtpPassEncrypted ? decryptSecret(storedEmail.smtpPassEncrypted) : process.env.SMTP_PASS,
  smtpTls: typeof storedEmail.smtpTls === 'boolean' ? storedEmail.smtpTls : process.env.SMTP_TLS === 'true',
})

await server.register(fastifyVite, {
  root: import.meta.url,
  renderer: '@fastify/react',
})

await server.vite.ready()

server.setNotFoundHandler((req, reply) => {
  reply.redirect('/404')
})

await server.register(fastifyCron, {
  jobs: [
    {
      name: 'interaction-reminders',
      cronTime: '0 9 * * *',
      timeZone: 'Europe/Moscow',
      onTick: async (server) => {
        await checkUpcomingInteractions(server.prisma, server.log)
      },
    },
    {
      name: 'inactivity-checker',
      cronTime: '0 0 * * *',
      timeZone: 'Europe/Moscow',
      onTick: async (server) => {
        await orphantUsers(server.prisma, server.log)
      },
    },
    {
      name: 'payments-checker',
      cronTime: '*/15 * * * *',
      timeZone: 'Europe/Moscow',
      onTick: async (server) => {
        await checkPayments(server.prisma, server.log)
      },
    },
    {
      name: 'level-confirmer',
      // Runs on the 1st of each month; the job evaluates the just-finished
      // (previous) month's personal sales for level confirmation.
      cronTime: '0 0 1 * *',
      timeZone: 'Europe/Moscow',
      onTick: async (server) => {
        await checkLevel(server.prisma, server.log)
      },
    },
  ],
})

await server.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' })

server.cron.startAllJobs()
