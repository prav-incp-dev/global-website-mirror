import { useState } from 'react'
import { getAddress, parseUnits } from 'viem'
import { getPublicClient, getWalletClient, ensureChain, usdtAddress, usdtDecimals } from '@/lib/chain.js'
import Modal from '../../Modal'
import Stepper from '../../Stepper'
import styles from './index.module.css'
import { PRICE_MAP } from '@/lib/pricing'

const MIN_QTY = 0
const MAX_QTY = 5

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
]

const PurchaseModal = ({ onClose, onCreate, profile, csrfToken }) => {
  const [quantity, setQuantity] = useState(0)
  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [loaderText, setLoaderText] = useState('')

  const price = PRICE_MAP[quantity]

  const handlePay = async () => {
    setPayError('')
    setIsPaying(true)
    setLoaderText('Ожидаем подпись...')

    try {
      if (!window.ethereum) {
        throw new Error('Кошелек не найден. Установите MetaMask или Trust Wallet.')
      }

      const companyWallet = getAddress(profile.companyWallet)
      const tokenAddress = getAddress(usdtAddress)

      // Step 1: Init payment on server
      const initResponse = await fetch('/api/payments/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ quantity }),
      })

      const initResult = await initResponse.json()
      if (!initResponse.ok) {
        throw new Error(initResult.error || 'Ошибка инициализации платежа')
      }

      const { paymentId } = initResult

      // Step 2: Ensure chain and get wallet account
      await ensureChain(window.ethereum)

      const walletClient = getWalletClient(window.ethereum)

      const [account] = await walletClient.requestAddresses()
      if (!account) {
        throw new Error('Не удалось получить адрес кошелька пользователя')
      }

      // Step 3: Send transaction
      const transferValue = parseUnits(String(price), usdtDecimals)
      const txHash = await walletClient.writeContract({
        account,
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [companyWallet, transferValue],
      })

      // Step 4: Attach txHash to payment immediately
      const attachResponse = await fetch(`/api/payments/${paymentId}/attach-tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          txHash,
          fromWallet: account,
        }),
      })

      const attachResult = await attachResponse.json()
      if (!attachResponse.ok) {
        throw new Error(attachResult.error || 'Ошибка привязки транзакции')
      }

      setLoaderText('Ожидаем подтверждение сети...')

      // Step 5: Wait for on-chain confirmation (UI feedback only)
      const publicClient = getPublicClient()

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      if (receipt.status !== 'success') {
        throw new Error('Транзакция не была подтверждена сетью')
      }

      // Step 6: Verify payment on server
      const verifyResponse = await fetch(`/api/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
      })

      const verifyResult = await verifyResponse.json()
      if (!verifyResponse.ok) {
        throw new Error(verifyResult.error || 'Ошибка верификации платежа')
      }

      onCreate(verifyResult)
    } catch (err) {
      setPayError(err.message || 'Ошибка оплаты')
    } finally {
      setIsPaying(false)
      setLoaderText('')
    }
  }

  return (
    <Modal onClose={onClose} isStatic className={styles.purchaseModal}>
      <div className={styles.purchaseModalBody}>
        <Stepper min={MIN_QTY} max={MAX_QTY} value={quantity} onChange={setQuantity} />

        <div className={styles.priceRow}>
          <span className={styles.priceLabel}>Сумма</span>
          <span className={styles.priceValue}>{price} USD</span>
        </div>

        <button className={styles.payButton} onClick={handlePay} disabled={isPaying}>
          {isPaying ? loaderText || 'Ожидаем подтверждение...' : 'Оплатить'}
        </button>

        {payError && <p className={styles.errorText}>{payError}</p>}
      </div>
    </Modal>
  )
}

export default PurchaseModal
