import { useState, useEffect } from 'react'
import { getAddress, parseUnits } from 'viem'
import { walletPreview } from '@/lib/wallet'
import Modal from '../../Modal'
import {
  getPublicClient,
  getWalletClient,
  ensureChain,
  usdtAddress,
  usdtDecimals,
  splitPaymentAddress,
} from '@/lib/chain.js'
import { PaymentStatus } from '@/generated/prisma/enums'
import { usePaymentsContext } from '../PaymentsContext'
import styles from './index.module.css'

const USDT_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

const SPLIT_PAYMENT_ABI = [
  {
    inputs: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    name: 'splitPayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

const SplitPaymentModal = ({ onClose }) => {
  const { selectedPayment, companyWallet, csrfToken, updateSelectedPayment } = usePaymentsContext()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [split, setSplit] = useState(null)
  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [loaderText, setLoaderText] = useState('')

  useEffect(() => {
    const fetchSplit = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/admin/payments/${selectedPayment.id}/calculate-split`, {
          headers: {
            'x-csrf-token': csrfToken,
          },
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        setSplit(result.split)
      } catch (err) {
        setError(err.message || 'Ошибка расчета сплита')
      } finally {
        setLoading(false)
      }
    }

    fetchSplit()
  }, [selectedPayment.id, csrfToken])

  const paymentErrorMessage = (txHash, errorMessage) => {
    return (
      'Произошла ошибка, но платеж был создан в сети. Хэш платежа:\n\n' +
      txHash +
      '.\n\n' +
      'Проверьте статус платежа позже и, если он завершен успешно,\n' +
      "отмените его через кнопку 'Зачесть распределение.'\n" +
      'Иначе сделайте еще одну попытку.\n' +
      `Ошибка: ${errorMessage}`
    )
  }

  const walletError = (account) => {
    return `Подключенный кошелек (${account}) не совпадает с кошельком компании (${companyWallet}). Подключите кошелек компании.`
  }

  const confirmSplit = async (txHash) => {
    const confirmRes = await fetch(`/api/admin/payments/${selectedPayment.id}/confirm-split`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ splits: split, txHash }),
    })
    const confirmResult = await confirmRes.json()
    if (!confirmRes.ok) {
      throw new Error(`Платеж распределен в сети, но не удалось сохранить данные: ${confirmResult.error}.`)
    }
  }

  const handlePay = async () => {
    setPayError('')
    setIsPaying(true)
    setLoaderText('Ожидаем подпись...')

    let splitTxHash = null

    try {
      if (!window.ethereum) throw new Error('Кошелек не найден. Установите MetaMask или Trust Wallet.')
      if (!companyWallet) throw new Error('Не указан кошелек компании для отправки средств')
      if (!splitPaymentAddress) throw new Error('Не указан адрес контракта распределения')
      if (!usdtAddress) throw new Error('Не указан адрес USDT')

      const tokenAddress = getAddress(usdtAddress)
      const contractAddress = getAddress(splitPaymentAddress)

      await ensureChain(window.ethereum)

      const walletClient = getWalletClient(window.ethereum)

      const [account] = await walletClient.requestAddresses()
      if (!account) throw new Error('Не удалось получить адрес кошелька')

      // Verify the connected wallet matches the company wallet
      if (getAddress(account) !== getAddress(companyWallet)) throw new Error(walletError(account))

      // Derive recipients and amounts from split data
      // Split is an array of { wallet, amount, userId?, score?, groupScore? }
      const items = split || []
      if (items.length === 0) throw new Error('Нет адресов для распределения')

      const recipients = []
      const parsedAmounts = []
      let calculatedTotalAmount = BigInt(0)

      for (const item of items) {
        if (item.amount === 0) continue
        try {
          const normalized = getAddress(item.wallet)
          const amountStr = item.amount.toFixed(usdtDecimals)
          const parsedAmount = parseUnits(amountStr, usdtDecimals)
          recipients.push(normalized)
          parsedAmounts.push(parsedAmount)
          calculatedTotalAmount += parsedAmount
        } catch {
          continue
        }
      }

      if (recipients.length === 0) throw new Error('Нет валидных адресов для распределения')

      // Step 1: Approve the SplitPayment contract to spend USDT
      setLoaderText('Ожидание подтверждения Approve...')
      const approveHash = await walletClient.writeContract({
        account,
        address: tokenAddress,
        abi: USDT_ABI,
        functionName: 'approve',
        args: [contractAddress, calculatedTotalAmount],
      })

      setLoaderText('Транзакция Approve отправлена. Ожидание включения в блок...')
      const publicClient = getPublicClient()
      await publicClient.waitForTransactionReceipt({ hash: approveHash })

      // Step 2: Execute split payment
      setLoaderText('Ожидание подтверждения перевода...')
      splitTxHash = await walletClient.writeContract({
        account,
        address: contractAddress,
        abi: SPLIT_PAYMENT_ABI,
        functionName: 'splitPayment',
        args: [tokenAddress, recipients, parsedAmounts],
      })

      setLoaderText('Деньги отправляются. Ожидание подтверждения сети...')
      const receipt = await publicClient.waitForTransactionReceipt({ hash: splitTxHash })
      if (receipt.status !== 'success') throw new Error('Транзакция не была подтверждена сетью')

      setLoaderText('Сохранение информации о выплатах...')
      await confirmSplit(splitTxHash)
      updateSelectedPayment({ id: selectedPayment.id, status: PaymentStatus.Splitted })
      onClose()
    } catch (err) {
      if (splitTxHash) setPayError(paymentErrorMessage(splitTxHash, err.message))
      else setPayError(err.shortMessage ? `Ошибка сети: ${err.shortMessage}` : err.message)
    } finally {
      setIsPaying(false)
      setLoaderText('')
    }
  }

  return (
    <Modal title="Распределение платежа" onClose={onClose}>
      <div className={styles.content}>
        {loading && <p className={styles.info}>Расчет…</p>}
        {error && <p className={styles.error}>{error}</p>}

        {split && (
          <>
            <p className={styles.info}>Платеж будет распределен по следующим адресам:</p>
            <div className={styles.splitList}>
              {split.map((item) => (
                <div key={item.wallet} className={styles.splitRow}>
                  <span className={styles.amount}>{`${Number(item.amount).toFixed(2)} USDT`}</span>
                  <span className={styles.separator}>→</span>
                  <span className={styles.address}>{walletPreview(item.wallet)}</span>
                </div>
              ))}
            </div>
            <button className={styles.confirmButton} disabled={loading || isPaying} onClick={handlePay}>
              {isPaying ? loaderText || 'Обработка...' : 'Подтвердить'}
            </button>
            {payError && <p className={styles.error}>{payError}</p>}
          </>
        )}
      </div>
    </Modal>
  )
}

export default SplitPaymentModal
