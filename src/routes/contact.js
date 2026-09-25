import { UserRole } from '../generated/prisma/client'
import { sendContactRequestEmail } from '../services/emailService.js'
import { removeUpload, saveUpload } from '../lib/uploads.js'

export default async (fastify) => {
  fastify.post('/api/contact', {
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user) return reply.code(401).send({ error: 'Доступно только авторизованным пользователям' })
      if (user.role === UserRole.Admin) return reply.code(403).send({ error: 'Доступ запрещен' })
      if (!req.isMultipart()) return reply.code(400).send({ error: 'Ожидается multipart-запрос' })

      let message = ''
      let stored = null
      let fileMimetype = null

      const cleanup = async () => {
        if (stored) await removeUpload(stored.storedPath)
      }

      try {
        for await (const part of req.parts()) {
          if (part.type === 'field') {
            if (part.fieldname === 'message') {
              message = part.value || ''
            }
          } else if (part.type === 'file') {
            fileMimetype = part.mimetype
            stored = await saveUpload({ stream: part.file, originalName: part.filename })
          }
        }

        if (!message.trim()) {
          await cleanup()
          return reply.code(400).send({ error: 'Сообщение не может быть пустым' })
        }

        const admins = await fastify.prisma.user.findMany({
          where: { companyId: user.companyId, role: UserRole.Admin },
          select: { email: true },
        })

        if (admins.length === 0) {
          await cleanup()
          return reply.code(500).send({ error: 'Не удалось отправить запрос' })
        }

        await sendContactRequestEmail({
          user,
          message,
          adminEmails: admins.map((a) => a.email),
          attachment: stored
            ? {
                filename: stored.storedName,
                path: stored.storedPath,
                mimetype: fileMimetype,
              }
            : null,
        })

        return reply.send({ success: true })
      } catch (err) {
        await cleanup()
        req.log.error(err)
        return reply.code(500).send({ error: 'Ошибка отправки запроса' })
      }
    },
  })
}
