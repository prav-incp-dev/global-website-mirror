import { useState } from 'react'
import { useRouteContext } from '@fastify/react/client'
import { UserRole } from '@/generated/prisma/enums'
import UserProfile from '@/components/UserProfile'
import InvitationModal from '@/components/InvitationModal'
import Payments from '@/components/Payments'
import StatsDashboard from '@/components/StatsDashboard'
import Structure from '@/components/Structure'
import { DescendantsProvider } from '@/components/Structure/DescendantsContext'
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

  const csrfToken = reply.generateCsrf()
  const payments = await server.payment.getPayments(user)
  const descendants = await server.user.getDescendants(user)
  const { score, groupScore } = await server.user.getScores(user)
  const staleDays = parseInt(process.env.STALE_INTERACTION_DAYS, 10) || 30
  const refundFee = parseInt(process.env.REFUND_FEE, 10) || 5
  const currentUserId = user.id

  return {
    profile: {
      nick: user.nick,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      memberId: user.memberId,
      wallet: user.wallet,
      parent: user.parent,
      role: user.role,
      level: user.level,
      score,
      groupScore,
      companyName: user.company?.name ?? null,
      companyWallet: user.company?.wallet ?? null,
    },
    currentUserId,
    payments,
    descendants,
    staleDays,
    refundFee,
    csrfToken,
  }
}

const TABS = (role) => {
  const commonTabs = [
    { key: 'profile', label: 'Профиль' },
    { key: 'payments', label: 'Покупки' },
  ]

  const consultantTabs = [
    { key: 'stats', label: 'Статистика' },
    { key: 'structure', label: 'Структура' },
  ]
  return commonTabs.concat(role === UserRole.Consultant ? consultantTabs : [])
}

const Index = () => {
  const { data } = useRouteContext()
  const {
    profile = {},
    currentUserId,
    payments = [],
    descendants = [],
    staleDays = 30,
    refundFee = 5,
    csrfToken = '',
  } = data
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
    <DescendantsProvider descendants={descendants} staleDays={staleDays} currentUserId={currentUserId}>
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

            {invitationOpen && <InvitationModal onClose={() => setInvitationOpen(false)} csrfToken={csrfToken} />}
          </>
        )}
        <div className={styles.tabs}>
          {TABS(profileData.role).map((tab) => (
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
            <Payments
              profile={profileData}
              initialPayments={payments}
              csrfToken={csrfToken}
              refundFee={refundFee}
            />
          )}
          {activeTab === 'stats' && <StatsDashboard profile={profileData} />}
          {activeTab === 'structure' && <Structure csrfToken={csrfToken} />}
        </div>
      </div>
    </DescendantsProvider>
  )
}

export default Index
