import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/notifications - Récupérer les notifications de l'utilisateur connecté
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'

    const where: Record<string, unknown> = {
      userId: session.user.id,
    }

    if (unreadOnly) {
      where.read = false
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await db.notification.count({
      where: {
        userId: session.user.id,
        read: false,
      },
    })

    return NextResponse.json({
      notifications,
      nonLues: unreadCount,
    })
  } catch (error) {
    console.error('Erreur GET /api/notifications:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des notifications' },
      { status: 500 }
    )
  }
}

// POST /api/notifications - Créer une notification (usage interne)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, type, title, message, link } = body

    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { erreur: 'Les champs userId, type, title et message sont obligatoires' },
        { status: 400 }
      )
    }

    // Seuls admin et système peuvent créer des notifications pour d'autres utilisateurs
    if (session.user.role !== 'admin' && userId !== session.user.id) {
      return NextResponse.json(
        { erreur: 'Non autorisé à créer des notifications pour un autre utilisateur' },
        { status: 403 }
      )
    }

    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
      },
    })

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('Erreur POST /api/notifications:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la création de la notification' },
      { status: 500 }
    )
  }
}

// Fonction exportable pour créer des notifications depuis d'autres routes
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string
) {
  try {
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
      },
    })
    return notification
  } catch (error) {
    console.error('Erreur createNotification:', error)
    return null
  }
}
