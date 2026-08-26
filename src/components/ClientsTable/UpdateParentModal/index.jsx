import { useState, useRef, useEffect, useCallback } from 'react'
import Modal from '../../Modal'
import { useClientsContext } from '../ClientsContext'
import { userName } from '@/lib/user'
import styles from './index.module.css'

const UpdateParentModal = ({ onClose }) => {
  const { csrfToken, selectedUser, updateSelectedUser } = useClientsContext()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const getSelected = () => {
    if (!selectedUser.parentId) return null
    return {
      id: selectedUser.parentId,
      label: userName(selectedUser.parent),
      firstName: selectedUser.parent.firstName,
      lastName: selectedUser.parent.lastName,
    }
  }
  const initialParentId = selectedUser.parentId
  const [selectedOption, setSelectedOption] = useState(getSelected())
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const fetchResults = useCallback(
    async (searchQuery) => {
      if (searchQuery.length < 2) {
        setResults([])
        setOpen(false)
        return
      }

      setLoading(true)
      try {
        const res = await fetch(`/api/admin/clients/search?query=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'x-csrf-token': csrfToken,
          },
        })
        const result = await res.json()
        setResults(result.users || [])
        setOpen(true)
        setHighlightedIndex(-1)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [csrfToken],
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        userId: selectedUser.id,
        parentId: selectedOption?.id ?? null,
      }
      const res = await fetch('/api/admin/user/parent', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('Ошибка при смене родителя:', err.error)
        return
      }
      const result = await res.json()
      if (result.success) updateSelectedUser(result.user)
      onClose()
    } catch {
      console.error('Ошибка при смене родителя')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    setQuery(value)
    setSelectedOption(null)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchResults(value)
    }, 300)
  }

  const handleSelect = (user) => {
    setSelectedOption({ id: user.id, label: userName(user), firstName: user.firstName, lastName: user.lastName })
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const handleClear = () => {
    setSelectedOption(null)
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (open && listRef.current && highlightedIndex >= 0) {
      const item = listRef.current.children[highlightedIndex]
      if (item) {
        item.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, open])

  const showSelected = () => {
    return (
      <div className={styles.selectedChip}>
        <span className={styles.selectedLabel}>{selectedOption.label}</span>
        <button className={styles.clearButton} onClick={handleClear} type="button" aria-label="Очистить">
          ×
        </button>
      </div>
    )
  }

  const showInput = () => {
    return (
      <input
        ref={inputRef}
        type="text"
        className={styles.searchInput}
        placeholder="Начните вводить имя для поиска"
        value={query}
        onChange={handleInputChange}
        onFocus={() => {
          if (results.length > 0) setOpen(true)
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 200)
        }}
        autoFocus
      />
    )
  }

  const showOptions = () => {
    return (
      <ul ref={listRef} className={styles.dropdown} data-testid="parent-search-dropdown">
        {results.map((user, index) => (
          <li
            key={user.id}
            className={`${styles.option} ${index === highlightedIndex ? styles.optionHighlighted : ''}`}
            onMouseDown={() => handleSelect(user)}
            onMouseEnter={() => setHighlightedIndex(index)}
          >
            <span className={styles.optionName}>{userName(user)}</span>
            <span className={styles.optionLevel}>Уровень: {user.level}</span>
          </li>
        ))}
      </ul>
    )
  }

  const showNoResults = () => {
    return open && query.length >= 2 && !loading && results.length === 0
  }

  const isChanged = () => {
    const newParentId = selectedOption?.id ?? null
    return newParentId !== initialParentId
  }

  return (
    <Modal title="Установить родителя" onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.selectWrapper}>
          {selectedOption ? showSelected() : showInput()}
          {loading && <span className={styles.spinner} />}
          {open && results.length > 0 && showOptions()}
          {showNoResults() && <div className={styles.noResults}>Ничего не найдено</div>}
        </div>
        <button className={styles.saveButton} onClick={handleSave} disabled={!isChanged() || saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </Modal>
  )
}

export default UpdateParentModal
