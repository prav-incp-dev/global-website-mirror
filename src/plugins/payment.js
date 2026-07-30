import fp from 'fastify-plugin'
import { createPublicClient, getAddress, http, parseEventLogs, parseUnits } from 'viem'
import { PaymentStatus } from '../generated/prisma/enums'

const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000

const transferEventAbi = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: false, name: 'value', type: 'uint256' },
  ],
}

const canCancelPayment = (payment) => {
  if (payment.status !== PaymentStatus.Completed) return false
  return Date.now() - new Date(payment.createdAt).getTime() <= PAYMENT_WINDOW_MS
}

const verifyPaymentOnChain = async (payment, rpcUrl) => {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  })
  const receipt = await publicClient.getTransactionReceipt({ hash: payment.txHash })
  if (!receipt || receipt.status !== 'success') {
    throw new Error('Transaction not confirmed on chain')
  }

  if (getAddress(receipt.to) !== getAddress(payment.tokenContract)) {
    throw new Error('Token contract mismatch')
  }

  if (getAddress(receipt.from) !== getAddress(payment.fromWallet)) {
    throw new Error('Sender mismatch')
  }

  const expectedAmount = parseUnits(payment.amount.toString(), payment.tokenDecimals)

  const logs = parseEventLogs({
    abi: [transferEventAbi],
    eventName: 'Transfer',
    logs: receipt.logs,
  })

  const transferLog = logs.find(
    (log) => getAddress(log.args.to) === getAddress(payment.toWallet) && log.args.value === expectedAmount,
  )

  if (!transferLog) {
    throw new Error('Transfer details do not match expected payment parameters')
  }

  return receipt
}

const serializePayment = (payment) => {
  return {
    id: payment.id,
    orderId: payment.orderId,
    quantity: payment.order?.quantity ?? null,
    amountUsd: Number(payment.amount),
    status: payment.status,
    txHash: payment.txHash,
    fromWallet: payment.fromWallet,
    toWallet: payment.toWallet,
    chainId: payment.chainId,
    tokenSymbol: payment.tokenSymbol,
    tokenContract: payment.tokenContract,
    tokenDecimals: payment.tokenDecimals,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    cancelRequestedAt: payment.cancelRequestedAt,
    canceledAt: payment.canceledAt,
    canCancel: canCancelPayment(payment),
  }
}

const getPayments = async (server, user) => {
  const payments = await server.prisma.payment.findMany({
    where: { userId: user.id },
    include: { order: true },
    orderBy: { createdAt: 'desc' },
  })

  return payments.map(serializePayment)
}

const paymentPlugin = (server, opts, done) => {
  server.decorate('payment', {
    getPayments: (user) => getPayments(server, user),
  })
  done()
}

paymentPlugin[Symbol.for('skip-override')] = true

export default fp(paymentPlugin, {
  name: 'payment',
})

export { PAYMENT_WINDOW_MS, canCancelPayment, serializePayment, verifyPaymentOnChain }
