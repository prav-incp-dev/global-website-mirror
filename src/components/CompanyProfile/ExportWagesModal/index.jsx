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

  return (
    <Modal title={`Выгрузка начислений на ${walletLabel}`} onClose={onClose}>
      <form
        className={styles.container}
        action="/api/admin/company/wages/export"
        method="get"
        onSubmit={() => setTimeout(onClose, 0)}
      >
        <input type="hidden" name="wallet" value={wallet} />

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="fromDate">
            С
          </label>
          <input
            id="fromDate"
            type="date"
            className={styles.input}
            name="fromDate"
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
            name="toDate"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.actionButton} type="submit" disabled={!fromDate || !toDate}>
            Сформировать
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ExportWagesModal
