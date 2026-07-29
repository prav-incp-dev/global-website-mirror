import { useState } from 'react'
import ViewProfile from './ViewProfile'
import EditProfile from './EditProfile'

const CompanyProfile = ({ company, csrfToken, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false)

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const handleUpdate = (updatedCompany) => {
    onUpdate(updatedCompany)
    setIsEditing(false)
  }

  if (isEditing) {
    return <EditProfile company={company} csrfToken={csrfToken} onUpdate={handleUpdate} onCancel={handleCancel} />
  }

  return <ViewProfile company={company} onEdit={handleEdit} />
}

export default CompanyProfile
