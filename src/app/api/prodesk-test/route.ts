import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/prodesk-test - Cree les tables PRODESK si elles n'existent pas
export async function GET() {
  const results: Record<string, string> = {}

  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Service" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "family" TEXT NOT NULL,
        "description" TEXT,
        "priceUnit" INTEGER NOT NULL DEFAULT 5000,
        "isRecurring" BOOLEAN NOT NULL DEFAULT false,
        "slaHours" INTEGER NOT NULL DEFAULT 4,
        "slaUrgentHours" INTEGER NOT NULL DEFAULT 1,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "icon" TEXT NOT NULL DEFAULT 'folder',
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Service_slug_key" UNIQUE ("slug")
      );
    `)
    results.Service = 'OK'

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Mandate" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "reference" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'actif',
        "clientId" TEXT,
        "companyId" TEXT,
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Mandate_reference_key" UNIQUE ("reference")
      );
    `)
    results.Mandate = 'OK'

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Task" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "reference" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "family" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'en_attente',
        "priority" TEXT NOT NULL DEFAULT 'normale',
        "urgent" BOOLEAN NOT NULL DEFAULT false,
        "clientId" TEXT,
        "companyId" TEXT,
        "serviceId" TEXT,
        "mandateId" TEXT,
        "slaDeadline" TIMESTAMP(3),
        "slaBreached" BOOLEAN NOT NULL DEFAULT false,
        "price" INTEGER NOT NULL DEFAULT 0,
        "paymentMode" TEXT NOT NULL DEFAULT 'forfait',
        "assignedTo" TEXT,
        "invoiceId" TEXT,
        "completionNote" TEXT,
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Task_reference_key" UNIQUE ("reference")
      );
    `)
    results.Task = 'OK'

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TaskTimeline" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "event" TEXT NOT NULL,
        "comment" TEXT,
        "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "taskId" TEXT NOT NULL
      );
    `)
    results.TaskTimeline = 'OK'

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TaskDocument" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'autre',
        "fileUrl" TEXT,
        "fileSize" INTEGER,
        "mimeType" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "taskId" TEXT NOT NULL
      );
    `)
    results.TaskDocument = 'OK'

    // Ajouter colonnes manquantes aux tables existantes
    try { await db.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN "tasksCount" INTEGER NOT NULL DEFAULT 0;`); results['Invoice.tasksCount'] = 'ajoutee' } catch { results['Invoice.tasksCount'] = 'existe' }
    try { await db.$executeRawUnsafe(`ALTER TABLE "Company" ADD COLUMN "taskLimit" INTEGER NOT NULL DEFAULT 5;`); results['Company.taskLimit'] = 'ajoutee' } catch { results['Company.taskLimit'] = 'existe' }

    return NextResponse.json({ success: true, message: 'Tables PRODESK pretes', tables: results })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Erreur', error: error instanceof Error ? error.message : String(error), results }, { status: 500 })
  }
}
