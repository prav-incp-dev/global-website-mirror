import Fastify from 'fastify'
import dbPlugin from './src/plugins/db'
import authPlugin from './src/plugins/auth'
import registerPlugin from './src/plugins/register'
import authRoutes from './src/routes/auth'
import registerRoutes from './src/routes/register'
import invitationRoutes from './src/routes/invitation'
import adminRoutes from './src/routes/admin'

export const buildBackendApp = async (opts = {}) => {
  const backend = Fastify(opts)

  await backend.register(dbPlugin)
  await backend.register(authPlugin)
  await backend.register(registerPlugin)
  await backend.register(authRoutes)
  await backend.register(registerRoutes)
  await backend.register(invitationRoutes)
  await backend.register(adminRoutes)

  return backend
}
