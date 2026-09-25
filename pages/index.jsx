import LandingPage from '@/components/LandingPage'
import { UserRole } from '@/generated/prisma/enums'

export const getData = async ({ server, req, reply }) => {
  const user = await server.auth.getUser(req)
  if (user) {
    // Authorized visitors are sent to their dashboard:
    // admins go to the admin panel, everyone else to the profile page.
    if (user.role === UserRole.Admin) return reply.redirect('/admin')
    return reply.redirect('/home')
  }
  return {}
}

const Index = () => {
  return <LandingPage />
}

export default Index
