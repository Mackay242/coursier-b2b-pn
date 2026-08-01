import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * GET /api/whatsapp/logs
 * Récupérer les logs de conversations WhatsApp (stockés dans les notifications)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const logs = await db.notification.findMany({
      where: {
        type: 'system',
        title: { startsWith: 'WhatsApp:' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        message: true,
        createdAt: true,
        read: true,
      },
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[WhatsApp Logs] Erreur:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
