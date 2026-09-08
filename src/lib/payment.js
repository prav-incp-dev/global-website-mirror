import { getAddress, parseUnits, parseEventLogs } from 'viem'
import { getPublicClient } from './chain.js'

const HOURS24 = 24 * 60 * 60 * 1000
const MINUTES15 = 15 * 60 * 1000

const PAYMENT_STATUSES = {
  Pending: 'В обработке',
  Completed: 'Оплачен',
  ToRefund: 'Отмена',
  Refunded: 'Отменен',
  Canceled: 'Отозван',
  Failed: 'Ошибка',
}

const transferEventAbi = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: false, name: 'value', type: 'uint256' },
  ],
}

const verifyPaymentOnChain = async (payment) => {
  const publicClient = getPublicClient()
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
    // Passthrough fields
    id: payment.id,
    uid: payment.uid,
    orderId: payment.orderId,
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
    refundRequestedAt: payment.refundRequestedAt,
    refundedAt: payment.refundedAt,

    // Decorated fields
    quantity: payment.order?.quantity ?? null,
    amountUsd: Number(payment.amount),
  }
}

export { HOURS24, MINUTES15, PAYMENT_STATUSES, serializePayment, verifyPaymentOnChain }
