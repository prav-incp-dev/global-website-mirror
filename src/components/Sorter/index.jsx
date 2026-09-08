import { useRef, useState, useEffect } from 'react'
import classNames from 'classnames'
import SortIcon from '@/assets/icons/SortIcon.svg?react'
import styles from './index.module.css'

const Sorter = ({ sortBy, onSortChange, options }) => {
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
        className={classNames(styles.sortButton, { [styles.sortButtonActive]: sortBy !== 'id' })}
        onClick={() => setOpen((prev) => !prev)}
        title="Сортировка"
      >
        <SortIcon className={styles.sortIcon} />
      </button>
      {open && (
        <ul className={styles.sortDropdown}>
          {options.map((option) => (
            <li
              key={option.value}
              className={classNames(styles.sortOption, { [styles.sortOptionActive]: sortBy === option.value })}
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
