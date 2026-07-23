import { UserRole } from '../generated/prisma/client'

export default async (fastify) => {
  fastify.put('/api/admin/company', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          primaryWallet: { type: 'string', format: 'wallet' },
          secondaryWallet: { type: 'string', format: 'wallet' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await fastify.auth.getUser(req)
      if (!user || user.role !== UserRole.Admin) {
        return reply.code(403).send({ error: 'Доступ запрещен' })
      }

      const { name, primaryWallet, secondaryWallet } = req.body

      try {
        const company = await fastify.prisma.company.update({
          where: { id: user.company.id },
          data: {
            name,
            primaryWallet: primaryWallet || null,
            secondaryWallet: secondaryWallet || null,
          },
        })

        return reply.send({
          success: true,
          company: {
            id: company.id,
            name: company.name,
            primaryWallet: company.primaryWallet,
            secondaryWallet: company.secondaryWallet,
          },
        })
      } catch (err) {
        if (err.code === 'P2002') {
          return reply.code(409).send({ error: 'Компания с таким названием уже существует' })
        }
        return reply.code(500).send({ error: 'Ошибка обновления компании' })
      }
    },
  })
}
