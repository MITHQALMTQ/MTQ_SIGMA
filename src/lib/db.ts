import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Use Turso URL if available, otherwise fall back to local SQLite
const dbUrl = process.env.TURSO_DB_URL 
  ? process.env.TURSO_DB_URL + "?authToken=" + process.env.TURSO_AUTH_TOKEN
  : process.env.DATABASE_URL || "file:/home/z/my-project/db/custom.db"

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
