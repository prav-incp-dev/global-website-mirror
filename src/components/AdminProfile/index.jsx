import { useState } from 'react'
import styles from './index.module.css'
import InvitationModal from '../InvitationModal/index'

const AdminProfile = ({ profile, csrfToken }) => {
  const [invitationOpen, setInvitationOpen] = useState(false)

  return (
    <div>
      <div className={styles.row}>
        <span className={styles.label}>Фамилия и имя:</span>
        <span className={styles.value}>{profile.fullName || '—'}</span>
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
