import { disconnectDatabase } from './db.js'

const globalTeardown = async () => {
  await disconnectDatabase()
}

export default globalTeardown
