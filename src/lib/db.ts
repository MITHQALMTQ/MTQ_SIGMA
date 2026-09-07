import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Lazy: only create when accessed, not at module load (prevents prerender crash)
function createDb(): PrismaClient {
  return new PrismaClient({
    log: ['error'],
    datasources: { db: { url: process.env.DATABASE_URL || "file:/home/z/my-project/db/custom.db" } },
  })
}

export const db = globalForPrisma.prisma ?? createDb()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
