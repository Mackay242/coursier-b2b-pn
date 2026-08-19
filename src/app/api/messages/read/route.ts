import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';

// PUT /api/messages/read — marquer tous les messages d'une conversation comme lus
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

    const body = await req.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId requis' }, { status: 400 });
    }

    await db.$queryRawUnsafe(`
      UPDATE "Message" SET "isRead" = TRUE
      WHERE "conversationId" = $1 AND "senderId" != $2 AND "isRead" = FALSE AND "type" = 'text'
    `, conversationId, user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PUT /api/messages/read error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
