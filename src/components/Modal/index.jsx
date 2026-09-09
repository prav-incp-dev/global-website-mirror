import CloseIcon from '@/assets/icons/CloseIcon.svg?react'
import classNames from 'classnames'
import styles from './index.module.css'

const Modal = ({ onClose, title, className, children, isStatic = false }) => {
  const handleOverlayClick = (e) => {
    if (!isStatic && e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={classNames(styles.modal, className)}>
        <div className={classNames(styles.header, { [styles.headerNoTitle]: !title })}>
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
