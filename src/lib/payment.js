import { getAddress, parseUnits, parseEventLogs } from 'viem'
import { getPublicClient } from './chain.js'

const PAYMENT_STATUSES = {
  Pending: 'В обработке',
  Completed: 'Оплачен',
  ToRefund: 'Отмена',
  Refunded: 'Отменен',
  Canceled: 'Отозван',
  Failed: 'Ошибка',
  Splitted: 'Распределен',
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

  let receipt
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: payment.txHash })
  } catch {
    throw new Error('Transaction not confirmed on chain')
  }

  if (!receipt) {
    throw new Error('Transaction not confirmed on chain')
  }

  if (receipt.status !== 'success') {
    throw new Error('Transaction reverted')
  }

  if (getAddress(receipt.to) !== getAddress(payment.tokenContract)) {
    throw new Error('Token contract mismatch')
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

  if (getAddress(transferLog.args.from) !== getAddress(payment.fromWallet)) {
    throw new Error('Sender mismatch')
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
    finalized: payment.finalized,

    // Decorated fields
    quantity: payment.order?.quantity ?? null,
    amountUsd: Number(payment.amount),
  }
}

export { PAYMENT_STATUSES, serializePayment, verifyPaymentOnChain }
