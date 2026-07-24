import { useState } from 'react'
import { useRouteContext } from '@fastify/react/client'
import { UserRole } from '../../src/generated/prisma/enums'
import AdminProfile from '../../src/components/AdminProfile'
import CompanyProfile from '../../src/components/CompanyProfile'
import styles from './index.module.css'

export const getData = async ({ server, req, reply }) => {
  const user = await server.auth.getUser(req)
  if (!user) return reply.redirect('/auth')
  if (user.role !== UserRole.Admin) return reply.redirect('/')

  const csrfToken = reply.generateCsrf()
  const company = await server.admin.getCompany(user)

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
    company: company,
    csrfToken,
  }
}

const TABS = [
  { key: 'admin', label: 'Профиль администратора' },
  { key: 'company', label: 'Профиль компании' },
]

const Admin = () => {
  const { data } = useRouteContext()
  const { profile = {}, company = null, csrfToken = '' } = data
  const [activeTab, setActiveTab] = useState('admin')

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
        {activeTab === 'admin' && <AdminProfile profile={profile} csrfToken={csrfToken} />}
        {activeTab === 'company' && <CompanyProfile company={company} csrfToken={csrfToken} />}
      </div>
    </div>
  )
}

export default Admin
