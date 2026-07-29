import { useState } from 'react'
import ViewProfile from './ViewProfile'
import EditProfile from './EditProfile'

const UserProfile = ({ profile, csrfToken, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false)

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const handleUpdate = (updatedProfile) => {
    onUpdate(updatedProfile)
    setIsEditing(false)
  }

  return (
    <div>
      {isEditing ? (
        <EditProfile profile={profile} csrfToken={csrfToken} onUpdate={handleUpdate} onCancel={handleCancel} />
      ) : (
        <ViewProfile profile={profile} onEdit={handleEdit} />
      )}
    </div>
  )
}

export default UserProfile
