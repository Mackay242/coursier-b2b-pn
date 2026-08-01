import { PrismaClient } from '@prisma/client'

// Production (Vercel/Neon) : utilise l'adapter Neon serverless
// Local (SQLite) : utilise le client Prisma standard

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production'
  const dbUrl = process.env.DATABASE_URL || ''

  // Si l'URL commence par postgres://, on est en production (Neon)
  if (dbUrl.startsWith('postgres')) {
    // Neon serverless adapter pour Vercel
    const { neon } = require('@neondatabase/serverless')
    const { PrismaNeon } = require('@prisma/adapter-neon')

    const sql = neon(dbUrl)
    const adapter = new PrismaNeon(sql)

    return new PrismaClient({
      adapter,
      log: isProduction ? ['error'] : ['query'],
    })
  }

  // SQLite local
  return new PrismaClient({
    log: ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
