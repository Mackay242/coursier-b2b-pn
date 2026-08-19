import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';

// GET /api/users — lister les utilisateurs (pour sélecteur de destinataire)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || null;

    let where = '';
    const params: any[] = [];

    // Exclure l'utilisateur courant
    where += 'WHERE u."id" != $1';
    params.push(user.id);

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    if (role) {
      params.push(role);
      where += ` AND u.role = $${params.length}`;
    }

    const users = await db.$queryRawUnsafe(`
      SELECT u."id", u.name, u.email, u.role, u."createdAt"
      FROM "User" u
      ${where}
      ORDER BY u.name ASC
      LIMIT 50
    `, ...params);

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('GET /api/users error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
