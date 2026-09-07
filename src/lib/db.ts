import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const tursoUrl = process.env.TURSO_DB_URL || process.env.DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN

  // If Turso env vars present AND we're in a runtime (not build/prerender), use Turso
  if (tursoUrl && tursoToken && typeof window !== 'undefined' === false) {
    try {
      const libsql = createClient({
        url: tursoUrl as string,
        authToken: tursoToken as string,
      })
      const adapter = new PrismaLibSql(libsql)
      return new PrismaClient({ adapter, log: ['error'] })
    } catch {
      // Fall back to local SQLite
    }
  }

  // Local SQLite (for dev / build / fallback)
  return new PrismaClient({
    log: ['error'],
    datasources: { db: { url: process.env.DATABASE_URL || "file:/home/z/my-project/db/custom.db" } },
  })
}

// Only create the client on first access (not during module load / build)
export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
