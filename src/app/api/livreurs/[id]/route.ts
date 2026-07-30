import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/livreurs/[id] - Détail d'un livreur avec stats
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { erreur: 'Accès réservé aux administrateurs' },
        { status: 403 }
      )
    }

    const { id } = await params
    const livreur = await db.livreur.findUnique({
      where: { id },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            reference: true,
            type: true,
            status: true,
            pickup: true,
            dropoff: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!livreur) {
      return NextResponse.json({ erreur: 'Livreur introuvable' }, { status: 404 })
    }

    // Stats agrégées
    const totalDeliveries = await db.delivery.count({
      where: { livreurId: id },
    })

    const activeDeliveries = await db.delivery.count({
      where: {
        livreurId: id,
        status: { in: ['prise_en_charge', 'en_course'] },
      },
    })

    const completedDeliveries = await db.delivery.count({
      where: { livreurId: id, status: 'livre' },
    })

    const cancelledDeliveries = await db.delivery.count({
      where: { livreurId: id, status: 'annulee' },
    })

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
    const completedToday = await db.delivery.count({
      where: {
        livreurId: id,
        status: 'livre',
        updatedAt: { gte: todayStart },
      },
    })

    // Courses du mois en cours
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const monthDeliveries = await db.delivery.count({
      where: {
        livreurId: id,
        status: 'livre',
        updatedAt: { gte: monthStart, lte: monthEnd },
      },
    })

    return NextResponse.json({
      livreur: {
        ...livreur,
        stats: {
          totalDeliveries,
          activeDeliveries,
          completedDeliveries,
          cancelledDeliveries,
          completedToday,
          monthDeliveries,
        },
      },
    })
  } catch (error) {
    console.error('Erreur GET /api/livreurs/[id]:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération du livreur' },
      { status: 500 }
    )
  }
}
