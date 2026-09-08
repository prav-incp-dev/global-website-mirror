import { useState } from 'react'
import classNames from 'classnames'
import { UserRole } from '@/generated/prisma/enums'
import { userName } from '@/lib/user'
import styles from './index.module.css'

const ViewProfile = ({ profile, onEdit }) => {
  const [balance, setBalance] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState(null)
  const getParent = () => {
    const parent = profile.parent
    if (!parent) return null

    return parent.nick || userName(parent)
  }
  const parent = getParent()

  const walletPreview = () => {
    if (!profile.wallet) return '—'

    return `${profile.wallet.slice(0, 10)}...${profile.wallet.slice(-8)}`
  }

  const handleCheckBalance = async () => {
    setBalanceLoading(true)
    setBalanceError('')
    try {
      const res = await fetch('/api/user/balance')
      const data = await res.json()
      if (data.success) {
        setBalance(data.balance)
      } else {
        setBalanceError(data.error || 'Ошибка')
      }
    } catch {
      setBalanceError('Не удалось получить баланс')
    } finally {
      setBalanceLoading(false)
    }
  }

  return (
    <div>
      <div className={styles.row}>
        <span className={styles.label}>Имя:</span>
        <span className={styles.value}>{profile.firstName || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Фамилия:</span>
        <span className={styles.value}>{profile.lastName || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Почта:</span>
        <span className={styles.value}>{profile.email || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Номер телефона:</span>
        <span className={styles.value}>{profile.phone || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Номер пайщика:</span>
        <span className={styles.value}>{profile.memberId || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Ник в Телеграм:</span>
        <span className={styles.value}>{profile.nick || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Номер кошелька в сети BNB:</span>
        <span className={classNames(styles.value, styles.wallet)} title={profile.wallet || '—'}>
          {walletPreview()}
        </span>
      </div>
      {profile.wallet && (
        <div className={styles.row}>
          <span className={styles.label}>Баланс кошелька:</span>
          <div className={styles.balanceRow}>
            <button className={styles.balanceButton} disabled={balanceLoading} onClick={handleCheckBalance}>
              {balanceLoading ? 'Загрузка...' : 'Проверить баланс'}
            </button>
            {balance !== null && <span className={styles.balanceValue}>{balance} USDT</span>}
            {balanceError && <span className={styles.balanceError}>{balanceError}</span>}
          </div>
        </div>
      )}
      <div className={styles.row}>
        <span className={styles.label}>Компания:</span>
        <span className={styles.value}>{profile.companyName || '—'}</span>
      </div>
      {!!parent && profile.role === UserRole.Candidate && (
        <div className={styles.row}>
          <span className={styles.label}>Ваш пригласитель:</span>
          <span className={styles.value}>{parent}</span>
        </div>
      )}
      <button className={styles.editButton} onClick={onEdit}>
        Редактировать
      </button>
    </div>
  )
}

export default ViewProfile
