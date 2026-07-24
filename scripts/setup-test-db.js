import { config } from 'dotenv'
import { Client } from 'pg'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const projectRoot = join(import.meta.dirname, '..')

// Load test env, overriding any existing values so .env cannot clobber the test DB URL
config({ path: join(projectRoot, '.env.test'), override: true })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

// Parse the connection string to extract the target database name
const url = new URL(databaseUrl)
const dbName = url.pathname.replace(/^\//, '')
if (!dbName) {
  throw new Error('Could not determine database name from DATABASE_URL')
}

const ensureDatabase = async () => {
  // To create a new database we must connect to an existing one (the maintenance DB)
  const adminUrl = new URL(databaseUrl)
  adminUrl.pathname = '/postgres'

  const client = new Client({ connectionString: adminUrl.toString() })
  await client.connect()
  try {
    await client.query(`CREATE DATABASE "${dbName}"`)
    console.log(`Created database "${dbName}"`)
  } catch (err) {
    // 42P04 = duplicate_database — safe to ignore, DB already exists
    if (err.code === '42P04') {
      console.log(`Database "${dbName}" already exists`)
    } else {
      throw err
    }
  } finally {
    await client.end()
  }
}

const main = async () => {
  await ensureDatabase()

  console.log('Pushing Prisma schema to test database...')
  execSync('npx prisma db push --force-reset --accept-data-loss', {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
  })

  console.log('Seeding test database...')
  execSync('npm run db:seed', {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
  })

  console.log('\n✅ Test database is ready.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
