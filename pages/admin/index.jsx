import { useState } from 'react'
import { useRouteContext } from '@fastify/react/client'
import AdminProfile from '../../src/components/AdminProfile/index'
import CompanyProfile from '../../src/components/CompanyProfile/index'
import styles from './index.module.css'

export const getData = async ({ server, req, reply }) => {
  const user = await server.auth.getUser(req)
  if (!user) {
    return reply.redirect('/auth')
  }

  // Only Admin users can access this page
  if (user.role !== 'Admin') {
    return reply.redirect('/')
  }

  const csrfToken = reply.generateCsrf()

  // Fetch company data for the company profile tab
  const company = user.company
    ? await server.prisma.company.findUnique({
        where: { id: user.company.id },
      })
    : null

  return {
    profile: {
      nick: user.nick,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      memberId: user.memberId,
      wallet: user.wallet,
      companyName: company?.name ?? null,
    },
    company: company
      ? {
          id: company.id,
          name: company.name,
          primaryWallet: company.primaryWallet ?? '',
          secondaryWallet: company.secondaryWallet ?? '',
        }
      : null,
    csrfToken,
  }
}

const TABS = [
  { key: 'company', label: 'Профиль компании' },
  { key: 'admin', label: 'Профиль администратора' },
]

const Admin = () => {
  const { data } = useRouteContext()
  const { profile = {}, company = null, csrfToken = '' } = data
  const [activeTab, setActiveTab] = useState('company')

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
        <h1 className={styles.headerTitle}>Панель администратора</h1>
        <button className={styles.logoutButton} onClick={handleLogout}>
          Выйти
        </button>
      </div>

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
        {activeTab === 'company' && <CompanyProfile company={company} csrfToken={csrfToken} />}
        {activeTab === 'admin' && <AdminProfile profile={profile} csrfToken={csrfToken} />}
      </div>
    </div>
  )
}

export default Admin
