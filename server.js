import 'dotenv/config'
import Fastify from 'fastify'
import fastifyVite from '@fastify/vite'
import dbPlugin from './src/plugins/db'

const server = Fastify({ logger: true })

await server.register(dbPlugin)
await server.register(fastifyVite, {
  root: import.meta.url,
  renderer: '@fastify/react',
})

await server.vite.ready()
await server.listen({ port: process.env.PORT || 3000 })
