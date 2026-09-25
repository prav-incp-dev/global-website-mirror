import Fastify from 'fastify'
import fastifyMultipart from '@fastify/multipart'
import dbPlugin from './src/plugins/db'
import authPlugin from './src/plugins/auth'
import registerPlugin from './src/plugins/register'
import adminPlugin from './src/plugins/admin'
import paymentPlugin from './src/plugins/payment'
import userPlugin from './src/plugins/user'
import authRoutes from './src/routes/auth'
import registerRoutes from './src/routes/register'
import invitationRoutes from './src/routes/invitation'
import adminRoutes from './src/routes/admin'
import userRoutes from './src/routes/user'
import paymentRoutes from './src/routes/payment'
import interactionRoutes from './src/routes/interaction'
import contactRoutes from './src/routes/contact'
import { WALLET_REGEXP, PHONE_REGEXP, MEMBER_REGEXP, UID_REGEXP } from './src/lib/regexps.js'
import { MAX_FILE_SIZE } from './src/lib/constants.js'

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
          ajv.addFormat('paymentUid', UID_REGEXP)
        },
      ],
    },
  })

  await backend.register(dbPlugin)
  await backend.register(authPlugin, authOpts)
  await backend.register(fastifyMultipart, {
    limits: {
      fileSize: MAX_FILE_SIZE, // 1.5 MB per file
      files: 1, // at most one attached file
      fields: 5,
    },
  })
  await backend.register(registerPlugin)
  await backend.register(adminPlugin)
  await backend.register(paymentPlugin)
  await backend.register(userPlugin)
  await backend.register(authRoutes)
  await backend.register(registerRoutes)
  await backend.register(invitationRoutes)
  await backend.register(adminRoutes)
  await backend.register(userRoutes)
  await backend.register(paymentRoutes)
  await backend.register(interactionRoutes)
  await backend.register(contactRoutes)

  return backend
}
