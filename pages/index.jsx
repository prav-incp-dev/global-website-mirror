import { useState } from 'react'
import { useRouteContext } from '@fastify/react/client'
import { UserRole } from '../src/generated/prisma/enums'
import InvitationModal from '../src/components/InvitationModal'
import styles from './index.module.css'

export const getData = async ({ server, req, reply }) => {
  // Protect the route — redirect to login if not authenticated
  const user = await server.auth.getUser(req)
  if (!user) {
    return reply.redirect('/auth')
  }

  // Redirect Admin users to the admin panel
  if (user.role === UserRole.Admin) {
    return reply.redirect('/admin')
  }

  // Generate CSRF token for logout form
  const csrfToken = reply.generateCsrf()

  return {
    profile: {
      nick: user.nick,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      memberId: user.memberId,
      wallet: user.wallet,
      companyName: user.company?.name ?? null,
    },
    csrfToken,
  }
}

const Index = () => {
  const { data } = useRouteContext()
  const { profile = {}, csrfToken = '' } = data
  const [invitationOpen, setInvitationOpen] = useState(false)

  const handleLogout = async (e) => {
    e.preventDefault()
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'x-csrf-token': csrfToken,
      },
    })
    const result = await res.json()
    if (result.success) {
      window.location.href = result.redirect
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Профиль</h1>
        <button className={styles.logoutButton} onClick={handleLogout}>
          Выйти
        </button>
      </div>

      <div className={styles.profileCard}>
        <div className={styles.row}>
          <span className={styles.label}>Ник в Телеграм:</span>
          <span className={styles.value}>{profile.nick || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Фамилия и имя:</span>
          <span className={styles.value}>{profile.fullName || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Почта:</span>
          <span className={styles.value}>{profile.email || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Номер телефона:</span>
          <span className={styles.value}>{profile.phone || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Номер пайщика:</span>
          <span className={styles.value}>{profile.memberId || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Кошелек:</span>
          <span className={styles.value}>{profile.wallet || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Компания:</span>
          <span className={styles.value}>{profile.companyName || '—'}</span>
        </div>
      </div>
      <button className={styles.inviteButton} onClick={() => setInvitationOpen(true)}>
        Сгенерировать пригласительную ссылку
      </button>

      <InvitationModal isOpen={invitationOpen} onClose={() => setInvitationOpen(false)} csrfToken={csrfToken} />
    </div>
  )
}

export default Index
