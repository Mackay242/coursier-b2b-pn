import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// PATCH /api/notifications/[id] - Marquer une notification comme lue
// PATCH /api/notifications/[id]?all=true - Marquer toutes les notifications comme lues
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const markAll = searchParams.get('all') === 'true'

    // Marquer toutes les notifications comme lues
    if (markAll) {
      const result = await db.notification.updateMany({
        where: {
          userId: session.user.id,
          read: false,
        },
        data: {
          read: true,
        },
      })

      return NextResponse.json({
        message: `${result.count} notification(s) marquée(s) comme lue(s)`,
        count: result.count,
      })
    }

    // Vérifier que la notification appartient à l'utilisateur
    const notification = await db.notification.findUnique({
      where: { id },
    })

    if (!notification) {
      return NextResponse.json({ erreur: 'Notification introuvable' }, { status: 404 })
    }

    if (notification.userId !== session.user.id) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 403 })
    }

    // Marquer la notification comme lue
    const updated = await db.notification.update({
      where: { id },
      data: { read: true },
    })

    return NextResponse.json({ notification: updated })
  } catch (error) {
    console.error('Erreur PATCH /api/notifications/[id]:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la mise à jour de la notification' },
      { status: 500 }
    )
  }
}
