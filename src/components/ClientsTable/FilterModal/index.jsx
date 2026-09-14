import { useState } from 'react'
import { useClientsContext } from '../ClientsContext'
import Modal from '../../Modal'
import { MIN_LEVEL, MAX_LEVEL } from '@/lib/constants'
import styles from './index.module.css'

const LevelFilterModal = ({ onClose }) => {
  const { fromLevel, toLevel, setFromLevel, setToLevel, fetchClients, orphansOnly, query, sortBy } = useClientsContext()

  const [from, setFrom] = useState(fromLevel)
  const [to, setTo] = useState(toLevel)
  const [applying, setApplying] = useState(false)

  const isValidLevel = (value) => {
    return value >= MIN_LEVEL && value <= MAX_LEVEL
  }

  const handleFromChange = (value) => {
    const parsedValue = Number(value).toString()
    setFrom(isValidLevel(parsedValue) ? parsedValue : MIN_LEVEL)
  }

  const handleToChange = (value) => {
    const parsedValue = Number(value).toString()
    setTo(isValidLevel(parsedValue) ? parsedValue : MAX_LEVEL)
  }

  const handleApply = async () => {
    setApplying(true)
    try {
      setFromLevel(from)
      setToLevel(to)
      await fetchClients(1, query, orphansOnly, sortBy, from, to)
      onClose()
    } finally {
      setApplying(false)
    }
  }

  const handleReset = async () => {
    setApplying(true)
    try {
      setFromLevel(MIN_LEVEL)
      setToLevel(MAX_LEVEL)
      await fetchClients(1, query, orphansOnly, sortBy, MIN_LEVEL, MAX_LEVEL)
      onClose()
    } finally {
      setApplying(false)
    }
  }

  const hasLevelFilter = fromLevel !== MIN_LEVEL || toLevel !== MAX_LEVEL

  return (
    <Modal title="Фильтрация" isStatic onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Уровень пользователя</label>
          <div className={styles.rangeRow}>
            <input
              type="number"
              className={styles.input}
              placeholder="от"
              value={from}
              onChange={(e) => handleFromChange(e.target.value)}
              min={MIN_LEVEL}
              max={MAX_LEVEL}
            />
            <span className={styles.rangeSeparator}>—</span>
            <input
              type="number"
              className={styles.input}
              placeholder="до"
              value={to}
              onChange={(e) => handleToChange(e.target.value)}
              min={MIN_LEVEL}
              max={MAX_LEVEL}
            />
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.applyButton} onClick={handleApply} disabled={applying}>
            {applying ? 'Применение...' : 'Применить'}
          </button>
          {hasLevelFilter && (
            <button className={styles.resetButton} onClick={handleReset} disabled={applying}>
              Сбросить фильтр
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default LevelFilterModal
