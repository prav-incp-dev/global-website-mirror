import { useRouteContext } from '@fastify/react/client'
import styles from './index.module.css'

export const getData = async ({ server, req, reply }) => {
  // Protect the route — redirect to login if not authenticated
  const user = await server.auth.getUser(req)
  if (!user) {
    return reply.redirect('/auth')
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
        <h1 className={styles.headerTitle}>Profile</h1>
        <button className={styles.logoutButton} onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className={styles.profileCard}>
        <div className={styles.row}>
          <span className={styles.label}>Nick:</span>
          <span className={styles.value}>{profile.nick || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Full Name:</span>
          <span className={styles.value}>{profile.fullName || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Email:</span>
          <span className={styles.value}>{profile.email || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Phone:</span>
          <span className={styles.value}>{profile.phone || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Member ID:</span>
          <span className={styles.value}>{profile.memberId || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Wallet:</span>
          <span className={styles.value}>{profile.wallet || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Company:</span>
          <span className={styles.value}>{profile.companyName || '—'}</span>
        </div>
      </div>
    </div>
  )
}

export default Index
