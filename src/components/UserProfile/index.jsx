import { useState } from 'react'
import ViewProfile from './ViewProfile'
import EditProfile from './EditProfile'

const UserProfile = ({ profile, csrfToken }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [profileData, setProfileData] = useState(profile)

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const handleUpdate = (updatedProfile) => {
    setProfileData({ ...profile, ...updatedProfile })
    setIsEditing(false)
  }

  return (
    <div>
      {isEditing ? (
        <EditProfile profile={profileData} csrfToken={csrfToken} onUpdate={handleUpdate} onCancel={handleCancel} />
      ) : (
        <ViewProfile profile={profileData} onEdit={handleEdit} />
      )}
    </div>
  )
}

export default UserProfile
