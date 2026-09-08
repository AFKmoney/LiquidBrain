import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// `query` logging used to flood the dev console on every poll; keep
// warnings/errors only.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
