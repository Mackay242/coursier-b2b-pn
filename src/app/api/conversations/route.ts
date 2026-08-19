import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';

// GET /api/conversations
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || null;

    let typeFilter = '';
    const params: any[] = [user.id];
    if (type) {
      typeFilter = ' AND c."type" = $2';
      params.push(type);
    }

    const conversations = await db.$queryRawUnsafe(`
      SELECT c.*, 
        cp."role" as myRole,
        m.content as lastMessage,
        m."createdAt" as lastMessageAt,
        m."type" as lastMessageType,
        su.name as lastSenderName,
        (SELECT COUNT(*)::int FROM "Message" msg 
          WHERE msg."conversationId" = c."id" AND msg."isRead" = FALSE AND msg."senderId" != $1
        ) as unreadCount
      FROM "Conversation" c
      JOIN "ConversationParticipant" cp ON cp."conversationId" = c."id"
      LEFT JOIN LATERAL (
        SELECT content, "createdAt", "type", "senderId" 
        FROM "Message" 
        WHERE "conversationId" = c."id" 
        ORDER BY "createdAt" DESC LIMIT 1
      ) m ON true
      LEFT JOIN "User" su ON su."id" = m."senderId"
      WHERE cp."userId" = $1 ${typeFilter}
      ORDER BY c."lastMessageAt" DESC NULLS LAST
    `, ...params);

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('GET /api/conversations error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/conversations
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

    const body = await req.json();
    const { title, type, taskId, serviceId, participantIds } = body;

    const convTitle = title || (type === 'dossier' ? 'Dossier ' + (taskId || '').slice(0, 8) : 'Conversation');

    const conv = await db.$queryRawUnsafe(`
      INSERT INTO "Conversation" ("id", "title", "type", "taskId", "serviceId")
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
      RETURNING *
    `, convTitle, type || 'dossier', taskId || null, serviceId || null);

    const conversation = (conv as any[])[0];

    await db.$queryRawUnsafe(`
      INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "role")
      VALUES (gen_random_uuid()::text, $1, $2, 'admin')
    `, conversation.id, user.id);

    if (participantIds && Array.isArray(participantIds) && participantIds.length > 0) {
      for (const pid of participantIds) {
        await db.$queryRawUnsafe(`
          INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "role")
          VALUES (gen_random_uuid()::text, $1, $2, 'member')
        `, conversation.id, pid);
      }
    }

    await db.$queryRawUnsafe(`
      INSERT INTO "Message" ("id", "conversationId", "senderId", "content", "type")
      VALUES (gen_random_uuid()::text, $1, $2, $3, 'system')
    `, conversation.id, user.id, 'Conversation creee par ' + (user.name || user.email));

    await db.$queryRawUnsafe(`
      UPDATE "Conversation" SET "lastMessageAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1
    `, conversation.id);

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/conversations error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
