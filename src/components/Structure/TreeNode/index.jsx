import { useState } from 'react'
import classNames from 'classnames'
import { UserRole } from '@/generated/prisma/enums'
import InfoIcon from '@/assets/icons/InfoIcon.svg?react'
import CheckIcon from '@/assets/icons/CheckIcon.svg?react'
import AttentionIcon from '@/assets/icons/AttentionIcon.svg?react'
import UserModal from '../UserModal'
import { userName } from '@/lib/user'
import styles from './index.module.css'

const TreeNode = ({ node, csrfToken, currentUserId }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const hasChildren = node.children && node.children.length > 0
  const isConsultant = node.role === UserRole.Consultant
  const isStaleBranch = node.isStale || node.hasStaleDescendant

  const isNextInteractionDue =
    node.nextInteractionDate && new Date(node.nextInteractionDate).toDateString() <= new Date().toDateString()

  const handleInfoClick = (e) => {
    e.stopPropagation()
    setShowInfoModal(true)
  }

  return (
    <div className={styles.container}>
      <div
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        className={classNames(hasChildren ? styles.row : styles.rowLeaf, { [styles.stale]: isStaleBranch })}
      >
        {hasChildren && <span className={classNames(styles.arrow, { [styles.arrowOpen]: isOpen })}>▶</span>}

        <div className={styles.userTable}>
          <div className={styles.cell}>{userName(node)}</div>
          <div className={styles.cell}>{node.lastInteractionDate?.toLocaleDateString('ru-RU') || '-'}</div>
          {isConsultant && (
            <div className={styles.cell} title="Консультант">
              <CheckIcon className={styles.checkIcon} />
            </div>
          )}
          <div className={styles.cell} title="Данные пользователя">
            <InfoIcon className={styles.infoIcon} onClick={handleInfoClick} />
          </div>
          {isNextInteractionDue && (
            <div className={styles.cell} title="Назначено взаимодействие">
              <AttentionIcon className={styles.attentionIcon} />
            </div>
          )}
        </div>
      </div>

      {isOpen && hasChildren && (
        <div className={styles.childrenContainer}>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} csrfToken={csrfToken} currentUserId={currentUserId} />
          ))}
        </div>
      )}

      {showInfoModal && (
        <UserModal
          data={{ ...node, status: isConsultant ? 'Консультант' : 'Кандидат' }}
          csrfToken={csrfToken}
          currentUserId={currentUserId}
          onClose={() => setShowInfoModal(false)}
        />
      )}
    </div>
  )
}

export default TreeNode
