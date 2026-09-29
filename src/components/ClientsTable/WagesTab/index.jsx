import { useState, useEffect } from 'react'
import { useClientsContext } from '../ClientsContext'
import { CLIENT_WAGES_LIMIT } from '@/lib/constants'
import AddWageModal from '../AddWageModal'
import styles from './index.module.css'

const WagesTab = ({ active }) => {
  const { selectedUser } = useClientsContext()
  const [wages, setWages] = useState()
  const [loading, setLoading] = useState(true)
  const [showAddWage, setShowAddWage] = useState(false)

  const fetchWages = async () => {
    try {
      const res = await fetch(`/api/admin/user/${selectedUser.id}/wages`)
      const result = await res.json()
      if (result.wages) setWages(result.wages)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (active && !wages) fetchWages()
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleWageSuccess = () => {
    setShowAddWage(false)
    setLoading(true)
    fetchWages()
  }

  const renderLoading = () => {
    return <div className={styles.loading}>Загрузка...</div>
  }

  const renderEmptyList = () => {
    return <div className={styles.wagesEmpty}>Начислений пока нет</div>
  }

  const renderWages = () => {
    return (
      <div className={styles.wagesList}>
        <p className={styles.wagesTitle}>{`До ${CLIENT_WAGES_LIMIT} последних начислений пользователю`}</p>
        {wages.map((wage) => (
          <div key={wage.id} className={styles.wageRecord}>
            <div className={styles.wageRow}>
              <span className={styles.wageAmount}>{Number(wage.amount).toFixed(2)} USDT</span>
              <span className={styles.wageDate}>{new Date(wage.createdAt).toLocaleString('ru-RU')}</span>
            </div>
            <span className={styles.wageDescription}>{wage.description || '—'}</span>
          </div>
        ))}
      </div>
    )
  }

  const renderContent = () => {
    if (loading || !wages) return renderLoading()
    if (!wages.length) return renderEmptyList()
    return renderWages()
  }

  return (
    <>
      {showAddWage && <AddWageModal onClose={() => setShowAddWage(false)} onSuccess={handleWageSuccess} />}

      {renderContent()}

      <div className={styles.actions}>
        <button className={styles.actionButton} onClick={() => setShowAddWage(true)}>
          Добавить начисление
        </button>
      </div>
    </>
  )
}

export default WagesTab
