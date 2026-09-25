import { useRef, useState } from 'react'
import classNames from 'classnames'
import { useRouteContext } from '@fastify/react/client'
import { UserRole } from '@/generated/prisma/enums'
import UserProfile from '@/components/UserProfile'
import InvitationModal from '@/components/InvitationModal'
import ContactUsModal from '@/components/ContactUsModal'
import Payments from '@/components/Payments'
import StatsDashboard from '@/components/StatsDashboard'
import Structure from '@/components/Structure'
import Wage from '@/components/Wages'
import LandingPage from '@/components/LandingPage'
import ContactIcon from '@/assets/icons/ContactIcon.svg?react'
import ProfileIcon from '@/assets/icons/ProfileIcon.svg?react'
import PaymentsIcon from '@/assets/icons/PaymentsIcon.svg?react'
import StatsIcon from '@/assets/icons/StatsIcon.svg?react'
import StructureIcon from '@/assets/icons/StructureIcon.svg?react'
import WagesIcon from '@/assets/icons/WagesIcon.svg?react'
import { DescendantsProvider } from '@/components/Structure/DescendantsContext'
import styles from './index.module.css'

export const getData = async ({ server, req, reply }) => {
  const user = await server.auth.getUser(req)
  if (!user) {
    const csrfToken = reply.generateCsrf()
    return { isLanding: true, csrfToken }
  }

  // Redirect Admin users to the admin panel
  if (user.role === UserRole.Admin) return reply.redirect('/admin')

  const csrfToken = reply.generateCsrf()
  const payments = await server.payment.getPayments(user)
  const descendants = await server.user.getDescendants(user)
  const { score, groupScore } = await server.user.getScores(user)
  const setting = await server.admin.getSetting(user)
  const { staleDays, refundFee } = setting.general
  const prices = setting.prices
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
    prices,
    csrfToken,
  }
}

const TABS = (role) => {
  const commonTabs = [
    { key: 'profile', label: 'Профиль', icon: ProfileIcon },
    { key: 'payments', label: 'Покупки', icon: PaymentsIcon },
  ]

  const consultantTabs = [
    { key: 'stats', label: 'Статистика', icon: StatsIcon },
    { key: 'structure', label: 'Структура', icon: StructureIcon },
    { key: 'wages', label: 'Начисления', icon: WagesIcon },
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
    prices = {},
    csrfToken = '',
    isLanding = false,
  } = data

  const [activeTab, setActiveTab] = useState('profile')
  const [invitationOpen, setInvitationOpen] = useState(false)
  const [profileData, setProfileData] = useState(profile)
  const [contactOpen, setContactOpen] = useState(false)
  const [flash, setFlash] = useState('')
  const flashTimer = useRef(null)

  const handleLogout = async (e) => {
    e.preventDefault()
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'x-csrf-token': csrfToken,
      },
    })
    const result = await res.json()
    if (result.success) window.location.href = result.redirect
  }

  const showFlash = (message) => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash(message)
    flashTimer.current = setTimeout(() => {
      setFlash('')
      flashTimer.current = null
    }, 2500)
  }

  const handleContactSent = () => {
    setContactOpen(false)
    showFlash('Запрос отправлен. Вам ответят в ближайшее время.')
  }

  const handleUpdateProfile = (updatedProfile) => {
    setProfileData({ ...profileData, ...updatedProfile })
  }

  if (isLanding) return <LandingPage />

  return (
    <DescendantsProvider descendants={descendants} staleDays={staleDays} currentUserId={currentUserId}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.headerTitle}>Профиль</h1>
          <div className={styles.headerActions}>
            <button
              className={styles.contactButton}
              onClick={() => setContactOpen(true)}
              title="Связаться с администрацией"
            >
              <ContactIcon className={styles.contactIcon} />
            </button>
            <button className={styles.logoutButton} onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </div>

        {flash && <div className={styles.flash}>{flash}</div>}

        {contactOpen && (
          <ContactUsModal onClose={() => setContactOpen(false)} csrfToken={csrfToken} onSent={handleContactSent} />
        )}

        {profileData.role === UserRole.Consultant && (
          <>
            <button className={styles.inviteButton} onClick={() => setInvitationOpen(true)}>
              Сгенерировать пригласительную ссылку
            </button>

            {invitationOpen && <InvitationModal onClose={() => setInvitationOpen(false)} csrfToken={csrfToken} />}
          </>
        )}
        <div className={styles.tabs}>
          {TABS(profileData.role).map((tab) => {
            const Icon = tab.icon

            return (
              <button
                key={tab.key}
                className={classNames(styles.tab, { [styles.tabActive]: activeTab === tab.key })}
                onClick={() => setActiveTab(tab.key)}
                title={tab.label}
              >
                <Icon className={styles.tabIcon} />
                <span className={styles.tabLabel}>{tab.label}</span>
              </button>
            )
          })}
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
              prices={prices}
            />
          )}
          {activeTab === 'stats' && <StatsDashboard profile={profileData} />}
          {activeTab === 'structure' && <Structure csrfToken={csrfToken} />}
          {activeTab === 'wages' && <Wage csrfToken={csrfToken} />}
        </div>
      </div>
    </DescendantsProvider>
  )
}

export default Index
