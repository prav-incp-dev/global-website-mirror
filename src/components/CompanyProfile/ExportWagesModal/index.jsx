import { useState } from 'react'
import Modal from '../../Modal'
import styles from './index.module.css'

const ExportWagesModal = ({ onClose, wallet, walletLabel }) => {
  const today = () => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  }

  const oneMonthAgo = () => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  }

  const [fromDate, setFromDate] = useState(oneMonthAgo)
  const [toDate, setToDate] = useState(today)

  const handleConfirm = () => {
    const params = new URLSearchParams({
      fromDate,
      toDate,
      wallet,
    })
    window.open(`/api/admin/company/wages/export?${params}`, '_blank')
    onClose()
  }

  return (
    <Modal title={`Выгрузка начислений на ${walletLabel}`} onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="fromDate">
            С
          </label>
          <input
            id="fromDate"
            type="date"
            className={styles.input}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="toDate">
            По
          </label>
          <input
            id="toDate"
            type="date"
            className={styles.input}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.actionButton} disabled={!fromDate || !toDate} onClick={handleConfirm}>
            Сформировать
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ExportWagesModal
