import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url) {
    throw new Error('TURSO_DATABASE_URL or DATABASE_URL must be set')
  }

  // Turso (libsql://) — pass the config object to the adapter factory.
  // PrismaLibSQL v6 expects `{ url, authToken }` as the first argument,
  // NOT a pre-built libsql client instance. The factory creates the client
  // internally via createClient(config) on first connect().
  if (url.startsWith('libsql://')) {
    const adapter = new PrismaLibSQL({ url, authToken })
    return new PrismaClient({ adapter, log: ['error'] })
  }

  // Fallback to local SQLite file
  return new PrismaClient({
    log: ['error'],
    datasources: { db: { url } },
  })
}

export const db = globalForPrisma.prisma ?? createDb()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
