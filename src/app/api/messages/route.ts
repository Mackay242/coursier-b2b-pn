import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';

// GET /api/messages?conversationId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId requis' }, { status: 400 });
    }

    // Vérifier que l'utilisateur est participant
    const participant = await db.$queryRawUnsafe(`
      SELECT 1 FROM "ConversationParticipant" WHERE "conversationId" = $1 AND "userId" = $2
    `, conversationId, user.id);

    if (!(participant as any[]).length) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    const messages = await db.$queryRawUnsafe(`
      SELECT m.*, u.name as senderName, u.email as senderEmail, u.role as senderRole
      FROM "Message" m
      LEFT JOIN "User" u ON u."id" = m."senderId"
      WHERE m."conversationId" = $1
      ORDER BY m."createdAt" ASC
    `, conversationId);

    // Marquer comme lu (sauf notes internes et messages système)
    await db.$queryRawUnsafe(`
      UPDATE "Message" SET "isRead" = TRUE
      WHERE "conversationId" = $1 AND "senderId" != $2 AND "isRead" = FALSE AND "type" = 'text'
    `, conversationId, user.id);

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('GET /api/messages error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/messages — envoyer un message
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

    const body = await req.json();
    const { conversationId, content, type } = body;

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'conversationId et contenu requis' }, { status: 400 });
    }

    // Vérifier que l'utilisateur est participant
    const participant = await db.$queryRawUnsafe(`
      SELECT 1 FROM "ConversationParticipant" WHERE "conversationId" = $1 AND "userId" = $2
    `, conversationId, user.id);

    if (!(participant as any[]).length) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    // Les notes internes sont réservées aux admins
    const msgType = type === 'note_interne' && user.role === 'admin' ? 'note_interne' : 'text';

    const result = await db.$queryRawUnsafe(`
      INSERT INTO "Message" ("id", "conversationId", "senderId", "content", "type")
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
      RETURNING *
    `, conversationId, user.id, content, msgType);

    const message = (result as any[])[0];

    // Mettre à jour lastMessageAt
    await db.$queryRawUnsafe(`
      UPDATE "Conversation" SET "lastMessageAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1
    `, conversationId);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/messages error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
