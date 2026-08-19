import { useState } from 'react'
import { UserRole } from '@/generated/prisma/enums'
import InfoIcon from '@/assets/icons/InfoIcon.svg?react'
import AttentionIcon from '@/assets/icons/AttentionIcon.svg?react'
import UserModal from '../UserModal'
import styles from './index.module.css'

const TreeNode = ({ node, csrfToken }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const hasChildren = node.children && node.children.length > 0
  const status = node.role === UserRole.Candidate ? 'Кандидат' : 'Консультант'

  const isNextInteractionToday =
    node.nextInteractionDate && new Date(node.nextInteractionDate).toDateString() === new Date().toDateString()

  const handleInfoClick = (e) => {
    e.stopPropagation()
    setShowInfoModal(true)
  }

  return (
    <div className={styles.container}>
      <div onClick={() => hasChildren && setIsOpen(!isOpen)} className={hasChildren ? styles.row : styles.rowLeaf}>
        {hasChildren && <span className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}>▶</span>}

        <div className={styles.userTable}>
          <div className={styles.cell}>{node.firstName}</div>
          <div className={styles.cell}>{status}</div>
          <div className={styles.cell}>{node.lastInteractionDate?.toLocaleDateString('ru-RU') || '-'}</div>
          <div className={styles.cell} title="Данные пользователя">
              <InfoIcon className={styles.infoIcon} onClick={handleInfoClick} />
          </div>
          {isNextInteractionToday && (
            <div className={styles.cell} title="Взаимодействие сегодня">
              <AttentionIcon className={styles.attentionIcon} />
            </div>
          )}
        </div>
      </div>

      {isOpen && hasChildren && (
        <div className={styles.childrenContainer}>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} csrfToken={csrfToken} />
          ))}
        </div>
      )}

      {showInfoModal && (
        <UserModal data={{ ...node, status }} csrfToken={csrfToken} onClose={() => setShowInfoModal(false)} />
      )}
    </div>
  )
}

export default TreeNode
