import { onTestFinished } from 'vitest'
import { buildBackendApp } from '../backend.js'

export const createApp = async () => {
  const app = await buildBackendApp({
    logger: false,
  })
  onTestFinished(async () => {
    await app.close()
  })
  return app
}

export const createNoCsrfApp = async () => {
  const app = await buildBackendApp({
    logger: false,
    auth: {
      enableCsrf: false,
    },
  })
  onTestFinished(async () => {
    await app.close()
  })
  return app
}
