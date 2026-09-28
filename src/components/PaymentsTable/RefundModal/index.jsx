import { useState } from 'react'
import { getAddress, parseUnits } from 'viem'
import { getPublicClient, getWalletClient, ensureChain, usdtAddress, usdtDecimals, ERC20_ABI } from '@/lib/chain.js'
import { PaymentStatus } from '@/generated/prisma/enums'
import { usePaymentsContext } from '../PaymentsContext'
import Modal from '../../Modal'
import styles from './index.module.css'

const RefundModal = ({ onClose }) => {
  const { selectedPayment, refundFee, companyWallet, updateSelectedPayment, csrfToken, fetchPayments } =
    usePaymentsContext()
  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [loaderText, setLoaderText] = useState('')

  if (!selectedPayment) return null

  const refundAmount = selectedPayment.amount * (1 - refundFee / 100)
  const formattedRefundAmount = `${refundAmount.toFixed(2)} USDT`

  const paymentErrorMessage = (txHash) => {
    return (
      'Произошла ошибка, но платеж был создан в сети. Хэш платежа:\n\n' +
      txHash +
      '.\n\n' +
      'Проверьте статус платежа позже и, если он завершен успешно,\n' +
      "отмените его через кнопку 'Зачесть возврат.'\n" +
      'Иначе сделайте еще одну попытку.'
    )
  }

  const walletError = (account) => {
    return `Подключенный кошелек (${account}) не совпадает с кошельком компании (${companyWallet}). Подключите кошелек компании.`
  }

  const refundPayment = async () => {
    return await fetch(`/api/admin/payments/${selectedPayment.id}/refund`, {
      method: 'POST',
      headers: {
        'x-csrf-token': csrfToken,
      },
    })
  }

  const handlePay = async () => {
    setPayError('')
    setIsPaying(true)
    setLoaderText('Ожидаем подпись...')

    let txHash = null

    try {
      if (!window.ethereum) throw new Error('Кошелек не найден. Установите MetaMask или Trust Wallet.')
      if (!companyWallet) throw new Error('Не указан кошелек компании для отправки средств')
      if (!selectedPayment.fromWallet) throw new Error('Не указан кошелек получателя для возврата')

      const destination = getAddress(selectedPayment.fromWallet)
      const tokenAddress = getAddress(usdtAddress)

      // Ensure correct chain
      await ensureChain(window.ethereum)

      const walletClient = getWalletClient(window.ethereum)

      const [account] = await walletClient.requestAddresses()
      if (!account) throw new Error('Не удалось получить адрес кошелька')

      // Verify the connected wallet matches the company wallet
      if (getAddress(account) !== getAddress(companyWallet)) throw new Error(walletError(account))

      // Send USDT transfer from company wallet to the payment's fromWallet
      const transferValue = parseUnits(refundAmount.toFixed(2), usdtDecimals)
      txHash = await walletClient.writeContract({
        account,
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [destination, transferValue],
      })

      setLoaderText('Ожидаем подтверждение сети...')

      const publicClient = getPublicClient()
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      if (receipt.status !== 'success') throw new Error('Транзакция не была подтверждена сетью')

      await refundPayment()
      updateSelectedPayment({ id: selectedPayment.id, status: PaymentStatus.Refunded })
      await fetchPayments()
      onClose()
    } catch (err) {
      if (txHash) setPayError(paymentErrorMessage(txHash))
      else setPayError(err.shortMessage ? `Ошибка сети: ${err.shortMessage}` : err.message)
    } finally {
      setIsPaying(false)
      setLoaderText('')
    }
  }

  return (
    <Modal title="Выполнить возврат" isStatic onClose={onClose}>
      <div className={styles.container}>
        <p className={styles.text}>Деньги будут отправлены на счет:</p>
        <p className={styles.accent}>{selectedPayment.fromWallet || '—'}</p>
        <p className={styles.text}>
          Сумма к отправке: <span className={styles.accent}>{formattedRefundAmount}</span>
        </p>
        <button className={styles.payButton} onClick={handlePay} disabled={isPaying}>
          {isPaying ? loaderText || 'Ожидаем подтверждение...' : 'Оплатить'}
        </button>
        {payError && <p className={styles.errorText}>{payError}</p>}
      </div>
    </Modal>
  )
}

export default RefundModal
