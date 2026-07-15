import fp from 'fastify-plugin'
import bcrypt from 'bcryptjs'
import cookie from '@fastify/cookie'
import csrfProtection from '@fastify/csrf-protection'

const SESSION_COOKIE_NAME = 'session'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds
const SECURE_COOKIES = process.env.NODE_ENV === 'production'

export default fp(async (fastify) => {
  await fastify.register(cookie, {
    secret: process.env.SESSION_SECRET,
  })

  await fastify.register(csrfProtection, {
    cookieKey: '_csrf',
    cookieOpts: {
      path: '/',
      sameSite: true,
      httpOnly: true,
      signed: true,
      secure: SECURE_COOKIES,
    },
  })

  fastify.decorate('auth', {
    async login(email, password) {
      const user = await fastify.db.user.findUnique({
        where: { email },
        include: { company: true },
      })

      if (!user) {
        return null
      }

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        return null
      }

      // Strip password before returning
      const { password: _pw, ...safeUser } = user
      return safeUser
    },

    setSession(reply, userId) {
      reply.setCookie(SESSION_COOKIE_NAME, userId, {
        path: '/',
        httpOnly: true,
        sameSite: true,
        signed: true,
        secure: SECURE_COOKIES,
        maxAge: SESSION_MAX_AGE,
      })
    },

    clearSession(reply) {
      reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
    },

    async getUser(req) {
      const sessionCookie = req.cookies[SESSION_COOKIE_NAME]
      if (!sessionCookie) {
        return null
      }

      const userId = req.unsignCookie(sessionCookie).value
      if (!userId) {
        return null
      }

      const user = await fastify.db.user.findUnique({
        where: { id: userId },
        include: { company: true },
      })

      if (!user) {
        return null
      }

      const { password: _pw, ...safeUser } = user
      return safeUser
    },
  })
})
