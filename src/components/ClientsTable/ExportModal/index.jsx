import { useState } from 'react'
import { useClientsContext } from '../ClientsContext'
import Modal from '../../Modal'
import styles from './index.module.css'

const ExportModal = ({ onClose }) => {
  const { query, orphansOnly, sortBy, fromLevel, toLevel } = useClientsContext()

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
      query,
      orphansOnly: String(orphansOnly),
      sortBy,
      fromLevel: String(fromLevel),
      toLevel: String(toLevel),
    })
    window.open(`/api/admin/clients/export?${params}`, '_blank')
    onClose()
  }

  return (
    <Modal title="Выгрузка клиентов" onClose={onClose}>
      <div className={styles.container}>
        <p className={styles.info}>
          Будут выгружены все клиенты с учетом текущих фильтров.
        </p>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="fromDate">Дата от</label>
          <input
            id="fromDate"
            type="date"
            className={styles.input}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="toDate">Дата до</label>
          <input
            id="toDate"
            type="date"
            className={styles.input}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button
            className={styles.actionButton}
            disabled={!fromDate || !toDate}
            onClick={handleConfirm}
          >
            Сформировать
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ExportModal
