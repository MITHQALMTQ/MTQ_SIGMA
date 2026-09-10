import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url) {
    throw new Error('TURSO_DATABASE_URL or DATABASE_URL must be set')
  }

  // If it's a libsql:// URL (Turso), use the libSQL adapter
  if (url.startsWith('libsql://')) {
    const libsql = createClient({ url, authToken })
    const adapter = new PrismaLibSQL(libsql)
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
