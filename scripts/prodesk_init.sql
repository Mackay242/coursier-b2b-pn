-- =============================================================
-- PRODESK MODULE — Script d'initialisation complet
-- CoursierB2B / Neon PostgreSQL
-- 
-- Utilisation :
--   1. Ouvrir https://dashboard.neon.tech
--   2. Sélectionner ton projet → onglet "SQL Editor"
--   3. Coller ce script entier et cliquer "Run"
--   4. Vérifier les messages dans la colonne "Messages"
-- 
-- Ce script est idempotent : IL PEUT ETRE RELANCE PLUSIEURS FOIS
-- sans erreur ni perte de données.
-- =============================================================

BEGIN;

-- =============================================================
-- ÉTAPE 1 : Créer les 5 tables PRODESK (si elles n'existent pas)
-- =============================================================

CREATE TABLE IF NOT EXISTS "Service" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "name"           TEXT NOT NULL,
  "slug"           TEXT NOT NULL,
  "family"         TEXT NOT NULL,
  "description"    TEXT,
  "priceUnit"      INTEGER NOT NULL DEFAULT 5000,
  "isRecurring"    BOOLEAN NOT NULL DEFAULT false,
  "slaHours"       INTEGER NOT NULL DEFAULT 4,
  "slaUrgentHours" INTEGER NOT NULL DEFAULT 1,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "icon"           TEXT NOT NULL DEFAULT 'folder',
  "order"          INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Task" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "reference"     TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "family"        TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'en_attente',
  "priority"      TEXT NOT NULL DEFAULT 'normale',
  "urgent"        BOOLEAN NOT NULL DEFAULT false,
  "clientId"      TEXT,
  "companyId"     TEXT,
  "serviceId"     TEXT,
  "mandateId"     TEXT,
  "slaDeadline"   TIMESTAMP(3),
  "slaBreached"   BOOLEAN NOT NULL DEFAULT false,
  "price"         INTEGER NOT NULL DEFAULT 0,
  "paymentMode"   TEXT NOT NULL DEFAULT 'forfait',
  "assignedTo"    TEXT,
  "invoiceId"     TEXT,
  "completionNote" TEXT,
  "completedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "TaskTimeline" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "event"     TEXT NOT NULL,
  "comment"   TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "taskId"    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "TaskDocument" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "type"      TEXT NOT NULL DEFAULT 'autre',
  "fileUrl"   TEXT,
  "fileSize"  INTEGER,
  "mimeType"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "taskId"    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Mandate" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "reference"   TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "description" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'actif',
  "clientId"    TEXT,
  "companyId"   TEXT,
  "startDate"   TIMESTAMP(3),
  "endDate"     TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================
-- ÉTAPE 2 : Index uniques et indexes de performance
-- =============================================================

-- Service
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "Service_slug_key" ON "Service"("slug");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Task
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "Task_reference_key" ON "Task"("reference");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Task_clientId_idx"  ON "Task"("clientId");
CREATE INDEX IF NOT EXISTS "Task_companyId_idx" ON "Task"("companyId");
CREATE INDEX IF NOT EXISTS "Task_serviceId_idx" ON "Task"("serviceId");
CREATE INDEX IF NOT EXISTS "Task_status_idx"    ON "Task"("status");
CREATE INDEX IF NOT EXISTS "Task_assignedTo_idx" ON "Task"("assignedTo");

-- TaskTimeline
CREATE INDEX IF NOT EXISTS "TaskTimeline_taskId_idx" ON "TaskTimeline"("taskId");

-- TaskDocument
CREATE INDEX IF NOT EXISTS "TaskDocument_taskId_idx" ON "TaskDocument"("taskId");

-- Mandate
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "Mandate_reference_key" ON "Mandate"("reference");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================
-- ÉTAPE 3 : Ajouter les colonnes manquantes aux tables existantes
-- (ces colonnes ont été ajoutées au schema.prisma après le premier déploiement)
-- =============================================================

-- Company.taskLimit (limite taches admin/mois)
DO $$ BEGIN
  ALTER TABLE "Company" ADD COLUMN "taskLimit" INTEGER NOT NULL DEFAULT 5;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Invoice.tasksCount (nombre de tâches liées à la facture)
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD COLUMN "tasksCount" INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- User : colonnes de relation PRODESK (si manquantes)
-- (ces colonnes n'existent pas physiquement, ce sont des relations
--  virtuelles gérées par Prisma via les FK dans Task/Mandate)


-- =============================================================
-- ÉTAPE 4 : Seeder les 6 services administratifs (UPSERT = idempotent)
-- =============================================================

INSERT INTO "Service" ("id", "name", "slug", "family", "description", "priceUnit", "isRecurring", "slaHours", "slaUrgentHours", "icon", "order", "createdAt", "updatedAt")
VALUES 
  ('svc_bureau_digital', 'Bureau Digital', 'bureau_digital', 'digital_office',
   'Teledeclarations, enregistrement en ligne DGID, formalites numeriques',
   5000, false, 4, 1, 'monitor', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_cnss_social', 'CNSS / Social', 'cnss_social', 'cnss_social',
   'Declarations CNSS, affiliations, mise a jour des comptes sociaux',
   7500, true, 6, 2, 'calculator', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_fiscalite', 'Fiscalite', 'fiscalite', 'fiscalite',
   'Declarations fiscales, TVA, IS, IR, restitution, conseil fiscal',
   10000, true, 8, 2, 'folder-open', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_sfec', 'SFEC', 'sfec', 'sfec',
   'Formalites des entreprises du Congo, creation et modification',
   15000, false, 12, 4, 'briefcase', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_gestion_documentaire', 'Gestion Documentaire', 'gestion_documentaire', 'documentaire',
   'Recuperation de documents administratifs, scans, certifications',
   3500, false, 3, 1, 'folder', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_secretariat', 'Secretariat', 'secretariat', 'secretariat',
   'Redaction de courriers, traductions, comptes rendus, formalites',
   2500, false, 2, 1, 'clipboard-list', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "family" = EXCLUDED."family",
  "description" = EXCLUDED."description",
  "priceUnit" = EXCLUDED."priceUnit",
  "isRecurring" = EXCLUDED."isRecurring",
  "slaHours" = EXCLUDED."slaHours",
  "slaUrgentHours" = EXCLUDED."slaUrgentHours",
  "icon" = EXCLUDED."icon",
  "order" = EXCLUDED."order",
  "updatedAt" = CURRENT_TIMESTAMP;


-- =============================================================
-- ÉTAPE 5 : Vérification — lister les tables créées
-- =============================================================

SELECT 'PRODESK tables creees :' AS info;
SELECT tablename, schemaname
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('Service', 'Task', 'TaskTimeline', 'TaskDocument', 'Mandate')
ORDER BY tablename;

SELECT 'Services initialises :' AS info;
SELECT "slug", "name", "priceUnit", "isRecurring", "slaHours" || 'h / ' || "slaUrgentHours" || 'h urgent' AS sla
FROM "Service"
ORDER BY "order";

COMMIT;

-- =============================================================
-- FIN — Si tu vois "COMMIT" sans erreur, tout est OK.
-- Tu peux maintenant aller sur l'app et utiliser le module PRODESK.
-- =============================================================