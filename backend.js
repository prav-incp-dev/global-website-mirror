import Fastify from 'fastify'
import dbPlugin from './src/plugins/db'
import authPlugin from './src/plugins/auth'
import registerPlugin from './src/plugins/register'
import adminPlugin from './src/plugins/admin'
import authRoutes from './src/routes/auth'
import registerRoutes from './src/routes/register'
import invitationRoutes from './src/routes/invitation'
import adminRoutes from './src/routes/admin'
import { WALLET_REGEXP, PHONE_REGEXP } from './src/lib/regexps.js'

export const buildBackendApp = async (opts = {}) => {
  const backend = Fastify({
    ...opts,
    ajv: {
      ...opts.ajv,
      plugins: [
        ...(opts.ajv?.plugins || []),
        (ajv) => {
          ajv.addFormat('phone', PHONE_REGEXP)
          ajv.addFormat('wallet', WALLET_REGEXP)
        },
      ],
    },
  })

  await backend.register(dbPlugin)
  await backend.register(authPlugin)
  await backend.register(registerPlugin)
  await backend.register(adminPlugin)
  await backend.register(authRoutes)
  await backend.register(registerRoutes)
  await backend.register(invitationRoutes)
  await backend.register(adminRoutes)

  return backend
}
