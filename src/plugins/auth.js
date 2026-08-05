import fp from 'fastify-plugin'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import cookie from '@fastify/cookie'
import csrfProtection from '@fastify/csrf-protection'

const SESSION_COOKIE_NAME = 'session'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds
const SECURE_COOKIES = process.env.NODE_ENV === 'production'

export const parseUserId = (value) => {
  const userId = Number(value)
  if (!Number.isInteger(userId) || userId <= 0) return null

  return userId
}

export default fp(async (fastify, opts) => {
  const { enableCsrf = true } = opts

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
  if (enableCsrf) {
    fastify.addHook('onRequest', (req, reply, next) => {
      if (['HEAD', 'GET', 'OPTIONS'].includes(req.method)) {
        next()
      } else {
        fastify.csrfProtection(req, reply, next)
      }
    })
  }
  fastify.decorate('auth', {
    login: async (email, password) => {
      const user = await fastify.prisma.user.findUnique({
        where: { email },
        include: { company: true },
      })

      if (!user) return null

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) return null

      // Strip password before returning
      const { password: _pw, ...safeUser } = user
      return safeUser
    },

    setSession: (reply, userId) => {
      reply.setCookie(SESSION_COOKIE_NAME, String(userId), {
        path: '/',
        httpOnly: true,
        sameSite: true,
        signed: true,
        secure: SECURE_COOKIES,
        maxAge: SESSION_MAX_AGE,
      })
    },

    clearSession: (reply) => {
      reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
    },

    getUser: async (req) => {
      const sessionCookie = req.cookies[SESSION_COOKIE_NAME]
      if (!sessionCookie) return null

      const sessionUserId = req.unsignCookie(sessionCookie).value
      const userId = parseUserId(sessionUserId)
      if (!userId) return null

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        include: { company: true, parent: true },
      })

      if (!user) return null

      const { password: _pw, ...safeUser } = user
      return safeUser
    },

    /**
     * Generates a 6-digit OTP, stores it in the user's confirmationCode field,
     * and returns the plaintext code.
     */
    createTwoFactorCode: async (user) => {
      const code = crypto.randomInt(100000, 999999).toString()

      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { confirmationCode: code },
      })

      return code
    },

    /**
     * Verifies the provided code against the user's stored confirmationCode.
     * If valid, clears the confirmationCode and returns true.
     */
    verifyTwoFactorCode: async (userId, code) => {
      const parsedUserId = parseUserId(userId)
      if (!parsedUserId) return false

      const user = await fastify.prisma.user.findUnique({
        where: { id: parsedUserId },
      })

      if (!user || !user.confirmationCode) return false

      if (user.confirmationCode !== code) return false

      // Clear the code so it can't be reused
      await fastify.prisma.user.update({
        where: { id: parsedUserId },
        data: { confirmationCode: null },
      })

      return true
    },

    /**
     * Signs a JWT containing the userId.
     * Defaults to a 10-minute expiry.
     */
    signPendingAuth: (userId, expiresIn) => {
      return jwt.sign({ userId }, process.env.SESSION_SECRET, { expiresIn })
    },

    /**
     * Verifies a pending auth JWT and returns the userId.
     * Returns null if the token is invalid or expired.
     */
    verifyPendingAuth: (token) => {
      try {
        const decoded = jwt.verify(token, process.env.SESSION_SECRET)
        return parseUserId(decoded.userId)
      } catch {
        return null
      }
    },
  })
})
