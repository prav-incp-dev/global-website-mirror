import { useMemo, useState } from 'react'
import { usdtAddress } from '@/lib/chain.js'
import styles from './index.module.css'
import PaymentsList from './PaymentsList'
import PurchaseModal from './PurchaseModal'

const Payments = ({ profile, initialPayments = [], csrfToken }) => {
  const hasTokenConfig = Boolean(usdtAddress)

  const [modalOpen, setModalOpen] = useState(false)
  const [payments, setPayments] = useState(initialPayments)
  const hasWallet = Boolean(profile?.wallet)
  const hasCompanyWallet = Boolean(profile?.companyPrimaryWallet)

  const buyDisabledReason = useMemo(() => {
    if (!hasWallet) return 'Для совершения покупок необходимо добавить кошелёк в профиле'
    if (!hasCompanyWallet) return 'Компания еще не указала кошелек для приема платежей'
    if (!hasTokenConfig) return 'Не настроен адрес USDT для BSC Testnet'
    return ''
  }, [hasCompanyWallet, hasTokenConfig, hasWallet])

  const onPaymentCancelled = (payment) => {
    setPayments((prev) => prev.map((p) => (p.id === payment.id ? payment : p)))
  }

  const onPaymentCreated = (payment) => {
    setPayments((prev) => [payment, ...prev])
    setModalOpen(false)
  }

  return (
    <div className={styles.container}>
      <button className={styles.buyButton} disabled={!!buyDisabledReason} onClick={() => setModalOpen(true)}>
        Купить
      </button>
      {buyDisabledReason && <p className={styles.walletHint}>{buyDisabledReason}</p>}

      <PaymentsList payments={payments} csrfToken={csrfToken} onCancel={onPaymentCancelled} />

      {modalOpen && (
        <PurchaseModal
          onClose={() => setModalOpen(false)}
          onCreate={onPaymentCreated}
          profile={profile}
          csrfToken={csrfToken}
          usdtAddress={usdtAddress}
        />
      )}
    </div>
  )
}

export default Payments
