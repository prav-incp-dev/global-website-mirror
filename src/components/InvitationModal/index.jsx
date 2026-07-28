import { useState, useRef, useEffect } from 'react'
import styles from './index.module.css'
import CopyIcon from '@/assets/icons/CopyIcon.svg?react'
import CheckIcon from '@/assets/icons/CheckIcon.svg?react'
import CloseIcon from '@/assets/icons/CloseIcon.svg?react'

const ModalContent = ({ onClose, csrfToken }) => {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    const generateLink = async () => {
      setLoading(true)
      setError('')

      try {
        const res = await fetch('/api/invitation/generate', {
          method: 'POST',
          headers: {
            'x-csrf-token': csrfToken,
          },
        })
        const data = await res.json()
        if (data.token) {
          setToken(data.token)
        } else {
          setError(data.error || 'Ошибка генерации ссылки')
        }
      } catch (err) {
        setError(err.message || 'Что-то пошло не так. Попробуйте еще раз.')
      } finally {
        setLoading(false)
      }
    }

    generateLink()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCopy = async () => {
    if (!textareaRef.current) return

    try {
      await navigator.clipboard.writeText(textareaRef.current.value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      textareaRef.current.select()
    }
  }

  const invitationUrl = token ? `${window.location.origin}/register?token=${token}` : ''

  return (
    <div className={styles.modal}>
      <div className={styles.header}>
        <h2 className={styles.title}>Пригласительная ссылка</h2>
        <button className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
          <CloseIcon />
        </button>
      </div>

      <div className={styles.body}>
        {loading && <p className={styles.loadingText}>Генерация ссылки...</p>}
        {error && <p className={styles.errorText}>{error}</p>}

        {!loading && !error && token && (
          <>
            <p className={styles.description}>
              Скопируйте ссылку и отправьте её новому пользователю. Ссылка действительна 24 часа.
            </p>
            <div className={styles.linkRow}>
              <textarea ref={textareaRef} className={styles.textarea} value={invitationUrl} readOnly rows={6} />
              <button
                className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
                onClick={handleCopy}
                title={copied ? 'Скопировано' : 'Копировать'}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const InvitationModal = ({ isOpen, onClose, csrfToken }) => {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <ModalContent onClose={onClose} csrfToken={csrfToken} />
    </div>
  )
}

export default InvitationModal
