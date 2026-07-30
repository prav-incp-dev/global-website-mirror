import { useState } from 'react'
import { bscTestnet } from 'viem/chains'
import { createPublicClient, createWalletClient, custom, getAddress, http, parseUnits } from 'viem'
import styles from './index.module.css'
import CloseIcon from '@/assets/icons/CloseIcon.svg?react'
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

const ensureChain = async (provider, chainId, rpcUrl) => {
  const hexChainId = `0x${chainId.toString(16)}`
  const currentChainId = await provider.request({ method: 'eth_chainId' })

  if (currentChainId?.toLowerCase() === hexChainId.toLowerCase()) {
    return
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    })
  } catch (switchErr) {
    if (switchErr?.code !== 4902) {
      throw switchErr
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: hexChainId,
          chainName: bscTestnet.name,
          nativeCurrency: bscTestnet.nativeCurrency,
          rpcUrls: [rpcUrl],
          blockExplorerUrls: [bscTestnet.blockExplorers.default.url],
        },
      ],
    })
  }
}

const PurchaseModal = ({ onClose, onCreate, profile, csrfToken }) => {
  const [quantity, setQuantity] = useState(0)
  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [loaderText, setLoaderText] = useState('')

  const chainId = Number(import.meta.env.VITE_BSC_TESTNET_CHAIN_ID || 97)
  const usdtAddress = import.meta.env.VITE_BSC_TESTNET_USDT_ADDRESS || ''
  const usdtDecimals = Number(import.meta.env.VITE_BSC_TESTNET_USDT_DECIMALS || 18)
  const rpcUrl = import.meta.env.VITE_BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545'

  const decrement = () => {
    setQuantity((prev) => Math.max(MIN_QTY, prev - 1))
  }

  const increment = () => {
    setQuantity((prev) => Math.min(MAX_QTY, prev + 1))
  }

  const price = PRICE_MAP[quantity]

  const handlePay = async () => {
    setPayError('')
    setIsPaying(true)
    setLoaderText('Ожидаем подпись...')

    try {
      if (!window.ethereum) {
        throw new Error('Кошелек не найден. Установите MetaMask или Trust Wallet.')
      }

      const companyWallet = getAddress(profile.companyPrimaryWallet)
      const tokenAddress = getAddress(usdtAddress)

      // Step 1: Init payment on server
      const initResponse = await fetch('/api/payments/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          quantity,
          chainId,
          tokenContract: tokenAddress,
          tokenDecimals: usdtDecimals,
        }),
      })

      const initResult = await initResponse.json()
      if (!initResponse.ok) {
        throw new Error(initResult.error || 'Ошибка инициализации платежа')
      }

      const { paymentId } = initResult

      // Step 2: Ensure chain and get wallet account
      await ensureChain(window.ethereum, chainId, rpcUrl)

      const walletClient = createWalletClient({
        chain: bscTestnet,
        transport: custom(window.ethereum),
      })

      const [account] = await walletClient.requestAddresses()
      if (!account) {
        throw new Error('Не удалось получить адрес кошелька пользователя')
      }

      // Step 3: Send transaction
      const transferValue = parseUnits(String(price), usdtDecimals)
      const txHash = await walletClient.writeContract({
        account,
        chain: bscTestnet,
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
      const publicClient = createPublicClient({
        chain: bscTestnet,
        transport: http(rpcUrl),
      })

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

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <button className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.stepper}>
            <button
              className={styles.stepperButton}
              onClick={decrement}
              disabled={quantity <= MIN_QTY}
              aria-label="Уменьшить"
            >
              −
            </button>
            <span className={styles.stepperValue}>{quantity}</span>
            <button
              className={styles.stepperButton}
              onClick={increment}
              disabled={quantity >= MAX_QTY}
              aria-label="Увеличить"
            >
              +
            </button>
          </div>

          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>Сумма</span>
            <span className={styles.priceValue}>{price} USD</span>
          </div>

          <button className={styles.payButton} onClick={handlePay} disabled={isPaying}>
            {isPaying ? loaderText || 'Ожидаем подтверждение...' : 'Оплатить'}
          </button>

          {payError && <p className={styles.errorText}>{payError}</p>}
        </div>
      </div>
    </div>
  )
}

export default PurchaseModal
