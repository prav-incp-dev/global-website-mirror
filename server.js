import 'dotenv/config'
import fastifyVite from '@fastify/vite'
import fastifyCron from 'fastify-cron'
import { buildBackendApp } from './backend.js'
import { checkUpcomingInteractions } from './src/jobs/interactionReminder.js'
import { orphantUsers } from './src/jobs/inactivityChecker.js'
import { checkPayments } from './src/jobs/paymentsChecker.js'

const server = await buildBackendApp({ logger: true })

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
  ],
})

await server.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' })

server.cron.startAllJobs()
