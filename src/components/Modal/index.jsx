import CloseIcon from '@/assets/icons/CloseIcon.svg?react'
import styles from './index.module.css'

const Modal = ({ isOpen, onClose, title, className, children }) => {
  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={`${styles.modal} ${className || ''}`}>
        <div className={`${styles.header} ${title ? '' : styles.headerNoTitle}`}>
          {title && <h2 className={styles.title}>{title}</h2>}
          <button className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}

export default Modal
