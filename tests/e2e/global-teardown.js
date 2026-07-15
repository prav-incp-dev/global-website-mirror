import { disconnectDatabase } from './db.js'

export default async function globalTeardown() {
  await disconnectDatabase()
}
