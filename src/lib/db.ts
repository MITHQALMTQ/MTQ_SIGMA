import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const url = process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db'

  // Turso / libSQL remote: use the driver adapter
  if (url.startsWith('libsql:') || url.startsWith('libsql+ws:') || url.startsWith('libsql+http:')) {
    const client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    const adapter = new PrismaLibSql(client)
    return new PrismaClient({ adapter, log: ['error'] })
  }

  // Local SQLite fallback (development)
  return new PrismaClient({
    log: ['error'],
    datasources: { db: { url } },
  })
}

export const db = globalForPrisma.prisma ?? createDb()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
