import { useRouteContext } from '@fastify/react/client'

export const getData = async ({ server }) => {
  const users = await server.db.user.findMany()
  return { users }
}

export default function Index() {
  const { data } = useRouteContext()
  const users = data?.users ?? []

  return (
    <div>
      <h1>OurHouse MLM</h1>
      <p>Users: {users.length}</p>
    </div>
  )
}
