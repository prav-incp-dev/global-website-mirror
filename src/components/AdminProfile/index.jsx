import { useState } from 'react'
import styles from './index.module.css'
import InvitationModal from '../InvitationModal'

const AdminProfile = ({ profile, csrfToken }) => {
  const [invitationOpen, setInvitationOpen] = useState(false)

  return (
    <div>
      <div className={styles.row}>
        <span className={styles.label}>Имя:</span>
        <span className={styles.value}>{profile.firstName || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Фамилия:</span>
        <span className={styles.value}>{profile.lastName || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Почта:</span>
        <span className={styles.value}>{profile.email || '—'}</span>
      </div>

      <button className={styles.inviteButton} onClick={() => setInvitationOpen(true)}>
        Сгенерировать пригласительную ссылку
      </button>

      <InvitationModal isOpen={invitationOpen} onClose={() => setInvitationOpen(false)} csrfToken={csrfToken} />
    </div>
  )
}

export default AdminProfile
