import { useState } from 'react'
import { useRouteContext } from '@fastify/react/client'
import { UserRole } from '@/generated/prisma/enums'
import AdminProfile from '@/components/AdminProfile'
import CompanyProfile from '@/components/CompanyProfile'
import ClientsTable from '@/components/ClientsTable'
import InvitationModal from '@/components/InvitationModal'
import styles from './index.module.css'

export const getData = async ({ server, req, reply }) => {
  const user = await server.auth.getUser(req)
  if (!user) return reply.redirect('/auth')
  if (user.role !== UserRole.Admin) return reply.redirect('/')

  const csrfToken = reply.generateCsrf()
  const company = await server.admin.getCompany(user)
  const [clientsData, orphansCount] = await Promise.all([
    server.admin.getClients(user),
    server.admin.getOrphansCount(user),
  ])

  return {
    profile: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    company: company,
    clients: clientsData,
    orphansCount,
    csrfToken,
  }
}

const TABS = [
  { key: 'admin', label: 'Профиль администратора' },
  { key: 'company', label: 'Профиль компании' },
  { key: 'clients', label: 'Клиенты' },
]

const Admin = () => {
  const { data } = useRouteContext()
  const { profile = {}, company = null, clients = {}, orphansCount = 0, csrfToken = '' } = data
  const [activeTab, setActiveTab] = useState('admin')
  const [invitationOpen, setInvitationOpen] = useState(false)
  const [profileData, setProfileData] = useState(profile)
  const [companyData, setCompanyData] = useState(company)

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

  const handleUpdateCompany = (updatedCompany) => {
    setCompanyData({ ...profileData, ...updatedCompany })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Панель администратора</h1>
        <button className={styles.logoutButton} onClick={handleLogout}>
          Выйти
        </button>
      </div>

      <>
        <button className={styles.inviteButton} onClick={() => setInvitationOpen(true)}>
          Сгенерировать пригласительную ссылку
        </button>
        {invitationOpen && <InvitationModal onClose={() => setInvitationOpen(false)} csrfToken={csrfToken} />}
      </>

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
        {activeTab === 'admin' && (
          <AdminProfile profile={profileData} csrfToken={csrfToken} onUpdate={handleUpdateProfile} />
        )}
        {activeTab === 'company' && (
          <CompanyProfile company={companyData} csrfToken={csrfToken} onUpdate={handleUpdateCompany} />
        )}
        {activeTab === 'clients' && clients && (
          <ClientsTable
            initialUsers={clients.users}
            initialPagination={{
              total: clients.total,
              page: clients.page,
              limit: clients.limit,
              totalPages: clients.totalPages,
            }}
            initialOrphansCount={orphansCount}
            csrfToken={csrfToken}
          />
        )}
      </div>
    </div>
  )
}

export default Admin
