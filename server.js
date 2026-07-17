import 'dotenv/config'
import fastifyVite from '@fastify/vite'
import { buildBackendApp } from './backend.js'

const server = await buildBackendApp({ logger: true })

await server.register(fastifyVite, {
  root: import.meta.url,
  renderer: '@fastify/react',
})

await server.vite.ready()

server.setNotFoundHandler((req, reply) => {
  reply.redirect('/404')
})

await server.listen({ port: process.env.PORT || 3000 })
