import { useMemo, useState } from 'react'
import { usdtAddress } from '@/lib/chain.js'
import styles from './index.module.css'
import PaymentsList from './PaymentsList'
import PurchaseModal from './PurchaseModal'
import { PaymentsProvider } from './PaymentsContext'

const Payments = ({ profile, initialPayments = [], csrfToken, refundFee, prices = {} }) => {
  const hasTokenConfig = Boolean(usdtAddress)

  const [modalOpen, setModalOpen] = useState(false)
  const [retryPayment, setRetryPayment] = useState(null)
  const hasWallet = Boolean(profile?.wallet)
  const hasCompanyWallet = Boolean(profile?.companyWallet)

  const buyDisabledReason = useMemo(() => {
    if (!hasWallet) return 'Для совершения покупок необходимо добавить кошелёк в профиле'
    if (!hasCompanyWallet) return 'Компания еще не указала кошелек для приема платежей'
    if (!hasTokenConfig) return 'Не настроен адрес USDT для BSC Testnet'
    return ''
  }, [hasCompanyWallet, hasTokenConfig, hasWallet])

  return (
    <PaymentsProvider
      initialPayments={initialPayments}
      csrfToken={csrfToken}
      refundFee={refundFee}
      profile={profile}
      prices={prices}
      onRetry={setRetryPayment}
    >
      <div className={styles.container}>
        <button className={styles.buyButton} disabled={!!buyDisabledReason} onClick={() => setModalOpen(true)}>
          Купить
        </button>
        {buyDisabledReason && <p className={styles.walletHint}>{buyDisabledReason}</p>}

        <PaymentsList />

        {modalOpen && <PurchaseModal onClose={() => setModalOpen(false)} />}
        {retryPayment && <PurchaseModal retryPayment={retryPayment} onClose={() => setRetryPayment(null)} />}
      </div>
    </PaymentsProvider>
  )
}

export default Payments
