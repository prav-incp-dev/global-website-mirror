import { onTestFinished } from 'vitest'
import { buildBackendApp } from '../backend.js'

const setupPrismaCleaner = (app) => {
  const createdRecords = new Map()
  const createManyCounts = new Map()

  app.decorate('prismaCleaner', {
    records: createdRecords,
    log() {
      if (createdRecords.size === 0 && createManyCounts.size === 0) return
      for (const [model, ids] of createdRecords) {
        if (ids.size > 0) {
          console.log(`[prisma:created] ${model}: ${[...ids].join(', ')}`)
        }
      }
      for (const [model, count] of createManyCounts) {
        console.log(`[prisma:created] ${model}: ${count} records via createMany`)
      }
    },
  })

  app.prisma = app.prisma.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args)
          if (result?.id != null) {
            const set = createdRecords.get(model) || new Set()
            set.add(result.id)
            createdRecords.set(model, set)
          }
          return result
        },
        async createMany({ model, args, query }) {
          const result = await query(args)
          if (result?.count > 0) {
            const prev = createManyCounts.get(model) || 0
            createManyCounts.set(model, prev + result.count)
          }
          return result
        },
      },
    },
  })
}

export const createApp = async () => {
  const app = await buildBackendApp({
    logger: false,
  })
  setupPrismaCleaner(app)
  onTestFinished(async () => {
    app.prismaCleaner.log()
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
  setupPrismaCleaner(app)
  onTestFinished(async () => {
    app.prismaCleaner.log()
    await app.close()
  })
  return app
}