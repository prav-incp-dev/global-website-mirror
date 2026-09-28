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

  return (
    <Modal title="Выгрузка клиентов" onClose={onClose}>
      <form
        className={styles.container}
        action="/api/admin/clients/export"
        method="get"
        onSubmit={() => setTimeout(onClose, 0)}
      >
        <p className={styles.info}>Будут выгружены все клиенты с учетом текущих фильтров.</p>

        <input type="hidden" name="query" value={query} />
        <input type="hidden" name="orphansOnly" value={String(orphansOnly)} />
        <input type="hidden" name="sortBy" value={sortBy} />
        <input type="hidden" name="fromLevel" value={String(fromLevel)} />
        <input type="hidden" name="toLevel" value={String(toLevel)} />

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="fromDate">
            Единицы с
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
            Единицы по
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

export default ExportModal
