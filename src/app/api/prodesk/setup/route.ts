import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// SQL pour créer les tables PRODESK si elles n'existent pas
// + ajouter les colonnes manquantes aux tables existantes
const SETUP_SQL = `
-- Colonnes manquantes sur tables existantes
DO $$ BEGIN
  ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "taskLimit" INTEGER NOT NULL DEFAULT 5;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tasksCount" INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Table Service
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Service_slug_key" ON "Service"("slug");

-- Table Task
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Task_reference_key" ON "Task"("reference");
CREATE INDEX IF NOT EXISTS "Task_clientId_idx" ON "Task"("clientId");
CREATE INDEX IF NOT EXISTS "Task_companyId_idx" ON "Task"("companyId");
CREATE INDEX IF NOT EXISTS "Task_serviceId_idx" ON "Task"("serviceId");
CREATE INDEX IF NOT EXISTS "Task_mandateId_idx" ON "Task"("mandateId");
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");
CREATE INDEX IF NOT EXISTS "Task_family_idx" ON "Task"("family");
CREATE INDEX IF NOT EXISTS "Task_assignedTo_idx" ON "Task"("assignedTo");
CREATE INDEX IF NOT EXISTS "Task_invoiceId_idx" ON "Task"("invoiceId");

-- Table TaskTimeline
CREATE TABLE IF NOT EXISTS "TaskTimeline" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "event" TEXT NOT NULL,
  "comment" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "taskId" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "TaskTimeline_taskId_idx" ON "TaskTimeline"("taskId");

-- Table TaskDocument
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

CREATE INDEX IF NOT EXISTS "TaskDocument_taskId_idx" ON "TaskDocument"("taskId");

-- Table Mandate
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Mandate_reference_key" ON "Mandate"("reference");
CREATE INDEX IF NOT EXISTS "Mandate_clientId_idx" ON "Mandate"("clientId");
CREATE INDEX IF NOT EXISTS "Mandate_companyId_idx" ON "Mandate"("companyId");

-- Contraintes FK (idempotentes via DO $$)
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TaskTimeline" ADD CONSTRAINT "TaskTimeline_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TaskDocument" ADD CONSTRAINT "TaskDocument_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;

// Les 6 services PRODESK à initialiser
const SERVICES = [
  {
    name: 'Bureau Digital',
    slug: 'bureau_digital',
    family: 'digital_office',
    description: 'Télédéclarations, enregistrement en ligne DGID, formalités numériques',
    priceUnit: 5000,
    isRecurring: false,
    slaHours: 4,
    slaUrgentHours: 1,
    icon: 'monitor',
    order: 1,
  },
  {
    name: 'CNSS / Social',
    slug: 'cnss_social',
    family: 'cnss_social',
    description: 'Déclarations CNSS, affiliations, mise à jour des comptes sociaux',
    priceUnit: 7500,
    isRecurring: true,
    slaHours: 6,
    slaUrgentHours: 2,
    icon: 'calculator',
    order: 2,
  },
  {
    name: 'Fiscalité',
    slug: 'fiscalite',
    family: 'fiscalite',
    description: 'Déclarations fiscales, TVA, IS, IR, restitution, conseil fiscal',
    priceUnit: 10000,
    isRecurring: true,
    slaHours: 8,
    slaUrgentHours: 2,
    icon: 'folder-open',
    order: 3,
  },
  {
    name: 'SFEC',
    slug: 'sfec',
    family: 'sfec',
    description: 'Service des formalités des entreprises du Congo, création et modification',
    priceUnit: 15000,
    isRecurring: false,
    slaHours: 12,
    slaUrgentHours: 4,
    icon: 'briefcase',
    order: 4,
  },
  {
    name: 'Gestion Documentaire',
    slug: 'gestion_documentaire',
    family: 'documentaire',
    description: 'Récupération de documents administratifs, scans, certifications',
    priceUnit: 3500,
    isRecurring: false,
    slaHours: 3,
    slaUrgentHours: 1,
    icon: 'folder',
    order: 5,
  },
  {
    name: 'Secrétariat',
    slug: 'secretariat',
    family: 'secretariat',
    description: 'Rédaction de courriers, traductions, comptes rendus, formalités diverses',
    priceUnit: 2500,
    isRecurring: false,
    slaHours: 2,
    slaUrgentHours: 1,
    icon: 'clipboard-list',
    order: 6,
  },
];

export async function POST(request: NextRequest) {
  try {
    const results: string[] = [];

    // 1. Créer les tables via SQL brut
    try {
      // Exécuter le SQL morceau par morceau pour éviter les erreurs de parsing
      const statements = SETUP_SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        try {
          await prisma.$executeRawUnsafe(stmt);
        } catch (err: any) {
          // Ignorer les erreurs "already exists" - c'est idempotent
          if (!err.message?.includes('already exists') &&
              !err.message?.includes('duplicate') &&
              !err.message?.includes('relation')) {
            console.error('SQL Error:', err.message);
          }
        }
      }
      results.push('Tables créées/vérifiées');
    } catch (err: any) {
      results.push(`Erreur tables: ${err.message}`);
    }

    // 2. Seeder les 6 services via Prisma
    try {
      for (const svc of SERVICES) {
        await prisma.service.upsert({
          where: { slug: svc.slug },
          update: { ...svc, updatedAt: new Date() },
          create: { id: svc.slug + '_' + Date.now().toString(36), ...svc },
        });
      }
      results.push('6 services initialisés');
    } catch (err: any) {
      results.push(`Erreur services: ${err.message}`);
    }

    // 3. Vérifier que les tables sont accessibles
    try {
      const tableCheck = await prisma.$queryRawUnsafe(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('Service', 'Task', 'TaskTimeline', 'TaskDocument', 'Mandate') ORDER BY tablename`
      );
      results.push(`Tables vérifiées: ${(tableCheck as any[]).map((t: any) => t.tablename).join(', ')}`);
    } catch (err: any) {
      results.push(`Erreur vérification: ${err.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration PRODESK terminée',
      details: results,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: 'Erreur lors de la configuration',
      error: err.message,
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// GET: page HTML avec bouton (comme /api/services/seed)
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Configuration PRODESK</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#e2e8f0}
  .card{background:#1e293b;border-radius:16px;padding:40px;max-width:480px;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,.4)}
  h1{font-size:1.5rem;margin:0 0 8px}p{color:#94a3b8;margin:0 0 24px;font-size:.95rem}
  button{background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;padding:14px 32px;border-radius:12px;font-size:1rem;font-weight:600;cursor:pointer;transition:transform .15s}
  button:hover{transform:scale(1.05)}button:active{transform:scale(.97)}
  #result{margin-top:20px;padding:16px;border-radius:8px;font-size:.85rem;display:none;text-align:left;white-space:pre-wrap}
  .ok{background:#064e3b;color:#6ee7b7}.err{background:#450a0a;color:#fca5a5}
  .loader{display:inline-block;width:20px;height:20px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;margin-right:8px;vertical-align:middle}
  @keyframes spin{to{transform:rotate(360deg)}}
</style></head>
<body>
<div class="card">
  <h1>Configuration PRODESK</h1>
  <p>Créer les tables de la base de données et initialiser les 6 services administratifs (Bureau Digital, CNSS, Fiscalité, SFEC, Gestion Documentaire, Secrétariat).</p>
  <button id="btn" onclick="setup()">Initialiser PRODESK</button>
  <div id="result"></div>
</div>
<script>
async function setup(){
  const btn=document.getElementById('btn'),res=document.getElementById('result');
  btn.disabled=true;btn.innerHTML='<span class="loader"></span>Installation...';
  try{
    const r=await fetch('/api/prodesk/setup',{method:'POST'});
    const d=await r.json();
    res.style.display='block';
    if(d.success){
      res.className='ok';
      res.textContent='OK : '+d.details.join('\n');
      btn.textContent='Terminé';
    }else{
      res.className='err';
      res.textContent='ERREUR : '+(d.error||d.message);
      btn.disabled=false;btn.textContent='Réessayer';
    }
  }catch(e){
    res.style.display='block';res.className='err';
    res.textContent='ERREUR : '+e.message;
    btn.disabled=false;btn.textContent='Réessayer';
  }
}
</script>
</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
