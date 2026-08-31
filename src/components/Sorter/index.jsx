import { useRef, useState, useEffect } from 'react'
import SortIcon from '@/assets/icons/SortIcon.svg?react'
import styles from './index.module.css'

const SORT_OPTIONS = [
  { value: 'id', label: 'По умолчанию' },
  { value: 'name', label: 'В алфавитном порядке' },
  { value: 'level', label: 'С высоким уровнем' },
  { value: 'role', label: 'По статусу' },
  { value: 'score', label: 'Лидеры продаж' },
]

const Sorter = ({ sortBy, onSortChange }) => {
  const [open, setOpen] = useState(false)
  const sortRef = useRef(null)

  const handleSelect = (value) => {
    setOpen(false)
    onSortChange(value)
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className={styles.sortWrapper} ref={sortRef}>
      <button
        className={`${styles.sortButton} ${sortBy !== 'id' ? styles.sortButtonActive : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        title="Сортировка"
      >
        <SortIcon className={styles.sortIcon} />
      </button>
      {open && (
        <ul className={styles.sortDropdown}>
          {SORT_OPTIONS.map((option) => (
            <li
              key={option.value}
              className={`${styles.sortOption} ${sortBy === option.value ? styles.sortOptionActive : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Sorter
