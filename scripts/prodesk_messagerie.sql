-- ═══════════════════════════════════════════════════════════════
-- PRODESK CONGO — MODULE MESSAGERIE INTERNE (Phase 1)
-- Exécuter chaque bloc séparément dans le Neon SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ═══ BLOC 1 : Création des tables ═══
CREATE TABLE IF NOT EXISTS "Conversation" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title"         TEXT NOT NULL DEFAULT '',
  "type"          TEXT NOT NULL DEFAULT 'dossier' CHECK ("type" IN ('dossier','interne','service')),
  "taskId"        TEXT REFERENCES "Task"("id") ON DELETE SET NULL,
  "serviceId"     TEXT REFERENCES "Service"("id") ON DELETE SET NULL,
  "lastMessageAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt"     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt"     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "conversationId"  TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "userId"         TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role"           TEXT NOT NULL DEFAULT 'member' CHECK ("role" IN ('admin','member')),
  "joinedAt"       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "conversationId"  TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "senderId"       TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "content"        TEXT NOT NULL DEFAULT '',
  "type"           TEXT NOT NULL DEFAULT 'text' CHECK ("type" IN ('text','system','note_interne')),
  "isRead"         BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══ BLOC 2 : Index ═══
CREATE INDEX IF NOT EXISTS idx_conv_participant_user ON "ConversationParticipant"("userId");
CREATE INDEX IF NOT EXISTS idx_conv_participant_conv ON "ConversationParticipant"("conversationId");
CREATE INDEX IF NOT EXISTS idx_msg_conv ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_msg_sender ON "Message"("senderId");
CREATE INDEX IF NOT EXISTS idx_msg_read ON "Message"("isRead") WHERE "isRead" = FALSE;
CREATE INDEX IF NOT EXISTS idx_conv_last_msg ON "Conversation"("lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS idx_conv_task ON "Conversation"("taskId");
CREATE INDEX IF NOT EXISTS idx_conv_service ON "Conversation"("serviceId");
