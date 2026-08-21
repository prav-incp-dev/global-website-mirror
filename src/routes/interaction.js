import { UserRole } from '../generated/prisma/client'

export default async (fastify) => {
  fastify.post('/api/interaction/complete', {
    schema: {
      body: {
        type: 'object',
        required: ['completedAt', 'description', 'targetId'],
        properties: {
          completedAt: { type: 'string' },
          description: { type: 'string', minLength: 1 },
          targetId: { type: 'number' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user) {
        return reply.code(401).send({ error: 'Доступно только авторизованным пользователям' })
      }

      if (user.role === UserRole.Candidate) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { completedAt, description, targetId } = req.body
      const completedAtDate = new Date(completedAt)
      const now = new Date()

      if (completedAtDate > now) {
        return reply.code(400).send({ error: 'Дата завершения не может быть в будущем' })
      }

      // Check if there's an existing open interaction for this target
      const existingOpen = await fastify.prisma.interaction.findFirst({
        where: {
          targetId,
          status: 'Open',
        },
      })

      if (existingOpen) {
        // Update existing open interaction to closed
        const updated = await fastify.prisma.interaction.update({
          where: { id: existingOpen.id },
          data: {
            status: 'Closed',
            description,
            completedAt: completedAtDate,
          },
        })

        return reply.send({ success: true, interaction: updated })
      }

      // Create new interaction as closed
      const created = await fastify.prisma.interaction.create({
        data: {
          status: 'Closed',
          plannedAt: completedAtDate,
          completedAt: completedAtDate,
          description,
          initiatorId: user.id,
          targetId,
        },
      })

      return reply.send({ success: true, interaction: created })
    },
  })

  fastify.post('/api/interaction/schedule', {
    schema: {
      body: {
        type: 'object',
        required: ['plannedAt', 'targetId'],
        properties: {
          plannedAt: { type: 'string' },
          targetId: { type: 'number' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user) {
        return reply.code(401).send({ error: 'Доступно только авторизованным пользователям' })
      }

      if (user.role === UserRole.Candidate) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { plannedAt, targetId } = req.body
      const plannedAtDate = new Date(plannedAt)
      const now = new Date()

      if (plannedAtDate < now) {
        return reply.code(400).send({ error: 'Дата планирования не может быть в прошлом' })
      }

      // Check if there's an existing open interaction for this target
      const existingOpen = await fastify.prisma.interaction.findFirst({
        where: {
          targetId,
          status: 'Open',
        },
      })

      if (existingOpen) {
        // Update existing open interaction's plannedAt
        const updated = await fastify.prisma.interaction.update({
          where: { id: existingOpen.id },
          data: {
            plannedAt: plannedAtDate,
            reminderSent: false,
          },
        })

        return reply.send({ success: true, interaction: updated })
      }

      // Create new open interaction
      const created = await fastify.prisma.interaction.create({
        data: {
          status: 'Open',
          plannedAt: plannedAtDate,
          completedAt: null,
          description: 'Запланировано',
          initiatorId: user.id,
          targetId,
        },
      })

      return reply.send({ success: true, interaction: created })
    },
  })
}
