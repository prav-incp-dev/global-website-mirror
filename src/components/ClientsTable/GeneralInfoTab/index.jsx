import { useState } from 'react'
import { useClientsContext } from '../ClientsContext'
import { UserRole } from '@/generated/prisma/enums'
import { userName } from '@/lib/user'
import { walletPreview } from '@/lib/wallet'
import UpdateParentModal from '../UpdateParentModal'
import styles from './index.module.css'

const GeneralInfoTab = () => {
  const { selectedUser, csrfToken, setSelectedUser, fetchClients } = useClientsContext()
  const [showChangeParent, setShowChangeParent] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const isConsultant = selectedUser.role === UserRole.Consultant

  const parentName = () => {
    if (!selectedUser.parentId) return 'Нет родителя'

    return userName(selectedUser.parent)
  }

  const handleDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить пользователя? Действие необратимо.')) return

    setDeleting(true)
    setDeleteError('')

    try {
      const res = await fetch(`/api/admin/user/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': csrfToken,
        },
      })
      const result = await res.json()

      if (!res.ok) return setDeleteError(result.error || 'Не удалось удалить пользователя')

      setSelectedUser(null)
      await fetchClients()
    } catch {
      setDeleteError('Не удалось удалить пользователя')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {showChangeParent && <UpdateParentModal onClose={() => setShowChangeParent(false)} />}

      <div className={styles.infoTable}>
        <div className={styles.infoRow}>
          <span className={styles.label}>Имя:</span>
          <span className={styles.value}>{selectedUser.firstName}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Фамилия:</span>
          <span className={styles.value}>{selectedUser.lastName || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Статус:</span>
          <span className={styles.value}>{isConsultant ? 'Консультант' : 'Кандидат'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Почта:</span>
          <span className={styles.value}>{selectedUser.email}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Номер телефона:</span>
          <span className={styles.value}>{selectedUser.phone || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Номер пайщика:</span>
          <span className={styles.value}>{selectedUser.memberId || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Ник в Телеграм:</span>
          <span className={styles.value}>{selectedUser.nick || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Кошелек:</span>
          <span className={styles.value}>{walletPreview(selectedUser.wallet)}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Родитель:</span>
          <span className={styles.value}>{parentName()}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionButton} onClick={() => setShowChangeParent(true)}>
          Изменить родителя
        </button>

        {!isConsultant && (
          <button className={styles.dangerButton} onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Удаление...' : 'Удалить пользователя'}
          </button>
        )}

        {deleteError && <p className={styles.fieldError}>{deleteError}</p>}
      </div>
    </>
  )
}

export default GeneralInfoTab
