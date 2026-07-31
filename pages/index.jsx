import { useState } from 'react'
import { useRouteContext } from '@fastify/react/client'
import { UserRole } from '@/generated/prisma/enums'
import UserProfile from '@/components/UserProfile'
import InvitationModal from '@/components/InvitationModal'
import Payments from '@/components/Payments'
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

  const payments = await server.payment.getPayments(user)

  return {
    profile: {
      nick: user.nick,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      memberId: user.memberId,
      wallet: user.wallet,
      companyName: user.company?.name ?? null,
      companyPrimaryWallet: user.company?.primaryWallet ?? null,
      parent: user.parent,
      role: user.role,
    },
    payments,
    csrfToken,
  }
}

const TABS = [
  { key: 'profile', label: 'Профиль' },
  { key: 'payments', label: 'Покупки' },
]

const Index = () => {
  const { data } = useRouteContext()
  const { profile = {}, payments = [], csrfToken = '' } = data
  const [activeTab, setActiveTab] = useState('profile')
  const [invitationOpen, setInvitationOpen] = useState(false)
  const [profileData, setProfileData] = useState(profile)

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

  const handleUpdateProfile = (updatedProfile) => {
    setProfileData({ ...profileData, ...updatedProfile })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Профиль</h1>
        <button className={styles.logoutButton} onClick={handleLogout}>
          Выйти
        </button>
      </div>
      {profileData.role === UserRole.Consultant && (
        <>
          <button className={styles.inviteButton} onClick={() => setInvitationOpen(true)}>
            Сгенерировать пригласительную ссылку
          </button>

          <InvitationModal isOpen={invitationOpen} onClose={() => setInvitationOpen(false)} csrfToken={csrfToken} />
        </>
      )}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'profile' && (
          <UserProfile profile={profileData} csrfToken={csrfToken} onUpdate={handleUpdateProfile} />
        )}
        {activeTab === 'payments' && (
          <Payments profile={profileData} initialPayments={payments} csrfToken={csrfToken} />
        )}
      </div>
    </div>
  )
}

export default Index
