import { useState } from 'react'
import ViewProfile from './ViewProfile'
import EditProfile from './EditProfile'

const CompanyProfile = ({ company, csrfToken }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [companyData, setCompanyData] = useState(company)

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const handleUpdate = (updatedCompany) => {
    setCompanyData(updatedCompany)
    setIsEditing(false)
  }

  if (isEditing) {
    return <EditProfile company={companyData} csrfToken={csrfToken} onUpdate={handleUpdate} onCancel={handleCancel} />
  }

  return <ViewProfile company={companyData} onEdit={handleEdit} />
}

export default CompanyProfile
