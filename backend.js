import Fastify from 'fastify'
import dbPlugin from './src/plugins/db'
import authPlugin from './src/plugins/auth'
import authRoutes from './src/routes/auth'

export const buildBackendApp = async (opts = {}) => {
  const backend = Fastify(opts)

  await backend.register(dbPlugin)
  await backend.register(authPlugin)
  await backend.register(authRoutes)

  return backend
}
