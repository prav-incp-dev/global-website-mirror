import 'dotenv/config'
import Fastify from 'fastify'
import fastifyVite from '@fastify/vite'
import dbPlugin from './src/plugins/db'
import authPlugin from './src/plugins/auth'
import authRoutes from './src/routes/auth'

const server = Fastify({ logger: true })

await server.register(dbPlugin)
await server.register(authPlugin)
await server.register(authRoutes)
await server.register(fastifyVite, {
  root: import.meta.url,
  renderer: '@fastify/react',
})

await server.vite.ready()
server.setNotFoundHandler((req, reply) => {
  reply.redirect('/404')
})
await server.listen({ port: process.env.PORT || 3000 })
