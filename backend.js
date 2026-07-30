import Fastify from 'fastify'
import dbPlugin from './src/plugins/db'
import authPlugin from './src/plugins/auth'
import registerPlugin from './src/plugins/register'
import adminPlugin from './src/plugins/admin'
import paymentPlugin from './src/plugins/payment'
import authRoutes from './src/routes/auth'
import registerRoutes from './src/routes/register'
import invitationRoutes from './src/routes/invitation'
import adminRoutes from './src/routes/admin'
import userRoutes from './src/routes/user'
import paymentRoutes from './src/routes/payment'
import { WALLET_REGEXP, PHONE_REGEXP, MEMBER_REGEXP } from './src/lib/regexps.js'

export const buildBackendApp = async (opts = {}) => {
  const { auth: authOpts, ...fastifyOpts } = opts
  const backend = Fastify({
    ...fastifyOpts,
    ajv: {
      ...fastifyOpts.ajv,
      plugins: [
        ...(fastifyOpts.ajv?.plugins || []),
        (ajv) => {
          ajv.addFormat('phone', PHONE_REGEXP)
          ajv.addFormat('wallet', WALLET_REGEXP)
          ajv.addFormat('member', MEMBER_REGEXP)
        },
      ],
    },
  })

  await backend.register(dbPlugin)
  await backend.register(authPlugin, authOpts)
  await backend.register(registerPlugin)
  await backend.register(adminPlugin)
  await backend.register(paymentPlugin)
  await backend.register(authRoutes)
  await backend.register(registerRoutes)
  await backend.register(invitationRoutes)
  await backend.register(adminRoutes)
  await backend.register(userRoutes)
  await backend.register(paymentRoutes)

  return backend
}
