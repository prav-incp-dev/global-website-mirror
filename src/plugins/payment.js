import fp from 'fastify-plugin'
import { serializePayment } from '../lib/payment'

export default fp(async (server) => {
  server.decorate('payment', {
    getPayments: async (user) => {
      const payments = await server.prisma.payment.findMany({
        where: { userId: user.id },
        include: { order: true },
        orderBy: { createdAt: 'desc' },
      })

      return payments.map(serializePayment)
    },
  })
})
