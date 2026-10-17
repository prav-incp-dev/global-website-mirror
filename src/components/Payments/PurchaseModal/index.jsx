import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { getAddress, parseUnits } from 'viem'
import {
  getPublicClient,
  getWalletClient,
  ensureChain,
  usdtAddress,
  usdtDecimals,
  ERC20_ABI,
  chainId,
} from '@/lib/chain.js'
import Modal from '../../Modal'
import Stepper from '../../Stepper'
import styles from './index.module.css'
import { usePaymentsContext } from '../PaymentsContext'

const TX_HASH_REGEXP = /^0x[a-fA-F0-9]{64}$/
const WALLET_REGEXP = /^0x[a-fA-F0-9]{40}$/

const PurchaseModal = ({ onClose, retryPayment = null }) => {
  const { csrfToken, addPayment, profile = {}, prices = {} } = usePaymentsContext()
  const [quantity, setQuantity] = useState(retryPayment?.quantity ?? 0)
  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [loaderText, setLoaderText] = useState('')

  // QR payment state
  const [mode, setMode] = useState(retryPayment ? 'qr' : 'wallet')
  const [qrPaymentId, setQrPaymentId] = useState(retryPayment?.paymentId ?? null)
  const [txHash, setTxHash] = useState('')
  const [fromWallet, setFromWallet] = useState('')
  const [qrError, setQrError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const priceKeys = Object.keys(prices).map(Number)
  const minQuantity = priceKeys.length > 0 ? Math.min(...priceKeys) : 0
  const maxQuantity = Math.max(0, ...priceKeys)
  const price = retryPayment ? retryPayment.amountUsd : (prices[quantity] ?? 0)

  const companyWallet = profile?.companyWallet || ''

  const initPayment = async () => {
    const response = await fetch('/api/payments/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ quantity }),
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || 'Ошибка инициализации платежа')
    }
    return result.paymentId
  }

  const attachTX = async (paymentId, paymentTxHash, account) => {
    const response = await fetch(`/api/payments/${paymentId}/attach-tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        txHash: paymentTxHash,
        fromWallet: account,
      }),
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || 'Ошибка привязки транзакции')
    }
    return result
  }

  const verifyPayment = async (paymentId) => {
    const response = await fetch(`/api/payments/${paymentId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({}),
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || 'Ошибка верификации платежа')
    }
    return result
  }

  const cancelPayment = async (paymentId) => {
    return await fetch(`/api/payments/${paymentId}/cancel`, {
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

    let paymentId = null
    let txHashValue = null

    try {
      if (!window.ethereum) {
        throw new Error('Кошелек не найден. Установите MetaMask или Trust Wallet.')
      }

      const companyWalletAddress = getAddress(profile.companyWallet)
      const tokenAddress = getAddress(usdtAddress)

      // Step 1: Init payment on server
      paymentId = await initPayment()

      // Step 2: Ensure chain and get wallet account
      await ensureChain(window.ethereum)

      const walletClient = getWalletClient(window.ethereum)

      const [account] = await walletClient.requestAddresses()
      if (!account) {
        throw new Error('Не удалось получить адрес кошелька пользователя')
      }

      // Verify the connected wallet matches the user's wallet
      if (getAddress(account) !== getAddress(profile.wallet)) {
        throw new Error(
          `Подключенный кошелек (${account}) не совпадает с вашим кошельком (${profile.wallet}). Подключите свой кошелек.`,
        )
      }

      // Step 3: Send transaction
      const transferValue = parseUnits(String(price), usdtDecimals)
      txHashValue = await walletClient.writeContract({
        account,
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [companyWalletAddress, transferValue],
      })

      // Step 4: Attach txHash to payment immediately
      await attachTX(paymentId, txHashValue, account)
      setLoaderText('Ожидаем подтверждение сети...')

      // Step 5: Wait for on-chain confirmation (UI feedback only)
      const publicClient = getPublicClient()

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHashValue })
      if (receipt.status !== 'success') {
        throw new Error('Транзакция не была подтверждена сетью')
      }

      // Step 6: Verify payment on server
      const verifyResult = await verifyPayment(paymentId)
      addPayment(verifyResult)
      onClose()
    } catch (err) {
      setPayError(err.shortMessage ? `Ошибка сети: ${err.shortMessage}` : err.message)
      if (paymentId && !txHashValue) await cancelPayment(paymentId)
    } finally {
      setIsPaying(false)
      setLoaderText('')
    }
  }

  const startQrPayment = async () => {
    setPayError('')

    try {
      const paymentId = await initPayment()
      setQrPaymentId(paymentId)
      setTxHash('')
      setFromWallet('')
      setQrError('')
      setMode('qr')
    } catch (err) {
      setPayError(err.message)
    }
  }

  const handleQrCancel = async () => {
    if (qrPaymentId) {
      try {
        await cancelPayment(qrPaymentId)
      } catch {
        // ignore cancel errors
      }
    }
    onClose()
  }

  const handleQrSave = async () => {
    setQrError('')

    if (!TX_HASH_REGEXP.test(txHash.trim())) {
      setQrError('Хеш транзакции должен быть в формате 0x + 64 hex-символа')
      return
    }

    if (!WALLET_REGEXP.test(fromWallet.trim())) {
      setQrError('Адрес кошелька должен быть в формате 0x + 40 hex-символов')
      return
    }

    setIsSaving(true)

    try {
      try {
        await attachTX(qrPaymentId, txHash.trim(), fromWallet.trim())
      } catch (attachErr) {
        // Если транзакция уже привязана к платежу — просто переходим к верификации
        if (!attachErr.message || !attachErr.message.includes('уже')) {
          throw attachErr
        }
      }

      const verifyResult = await verifyPayment(qrPaymentId)
      addPayment(verifyResult)
      onClose()
    } catch (err) {
      setQrError(err.message || 'Не удалось сохранить платёж')
    } finally {
      setIsSaving(false)
    }
  }

  const qrValue = companyWallet
    ? `ethereum:${usdtAddress}@${chainId}/transfer?address=${companyWallet}&uint256=${parseUnits(String(price), usdtDecimals)}`
    : ''

  if (mode === 'qr') {
    return (
      <Modal title="Оплата по QR-коду" onClose={handleQrCancel} isStatic className={styles.purchaseModal}>
        <div className={styles.purchaseModalBody}>
          <p className={styles.qrHint}>
            Отсканируйте QR-код в кошельке, отправьте указанную сумму USDT, затем вставьте хеш транзакции и адрес
            отправителя.
          </p>

          <div className={styles.qrCodeWrap}>
            {qrValue ? (
              <QRCodeSVG value={qrValue} size={220} bgColor="#ffffff" fgColor="#0a192f" level="M" />
            ) : (
              <p className={styles.errorText}>Не указан кошелёк компании для приёма платежей</p>
            )}
          </div>

          <div className={styles.qrDetails}>
            <div className={styles.qrRow}>
              <span className={styles.qrLabel}>Сеть</span>
              <span className={styles.qrValue}>{chainId}</span>
            </div>
            <div className={styles.qrRow}>
              <span className={styles.qrLabel}>Получатель</span>
              <span className={styles.qrValue}>{companyWallet}</span>
            </div>
            <div className={styles.qrRow}>
              <span className={styles.qrLabel}>Сумма</span>
              <span className={styles.qrValue}>{price} USDT</span>
            </div>
            <div className={styles.qrRow}>
              <span className={styles.qrLabel}>Контракт USDT</span>
              <span className={styles.qrValue}>{usdtAddress}</span>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="txHash">
              Хеш транзакции
            </label>
            <input
              id="txHash"
              className={styles.input}
              placeholder="0x..."
              value={txHash}
              onChange={(event) => setTxHash(event.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="fromWallet">
              Адрес кошелька плательщика
            </label>
            <input
              id="fromWallet"
              className={styles.input}
              placeholder="0x..."
              value={fromWallet}
              onChange={(event) => setFromWallet(event.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {qrError && <p className={styles.errorText}>{qrError}</p>}

          <button className={styles.payButton} onClick={handleQrSave} disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>

          <button className={styles.secondaryButton} onClick={handleQrCancel} disabled={isSaving}>
            Отмена
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Количество единиц" onClose={onClose} isStatic className={styles.purchaseModal}>
      <div className={styles.purchaseModalBody}>
        <Stepper min={minQuantity} max={maxQuantity} value={quantity} onChange={setQuantity} />

        <div className={styles.priceRow}>
          <span className={styles.priceLabel}>Сумма</span>
          <span className={styles.priceValue}>{price} USD</span>
        </div>

        <button className={styles.payButton} onClick={handlePay} disabled={isPaying}>
          {isPaying ? loaderText || 'Ожидаем подтверждение...' : 'Оплатить кошельком'}
        </button>

        <button className={styles.secondaryButton} onClick={startQrPayment} disabled={isPaying}>
          Показать QR для оплаты
        </button>

        {payError && <p className={styles.errorText}>{payError}</p>}
      </div>
    </Modal>
  )
}

export default PurchaseModal
