import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/livreurs/me/stats - Statistiques personnelles du livreur
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    if (session.user.role !== 'livreur') {
      return NextResponse.json(
        { erreur: 'Accès réservé aux livreurs' },
        { status: 403 }
      )
    }

    // Récupérer le user pour trouver le livreur correspondant
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })
    }

    // Chercher le livreur par nom puis par téléphone
    let livreurRecord = await db.livreur.findFirst({
      where: { name: user.name },
    })

    if (!livreurRecord && user.phone) {
      livreurRecord = await db.livreur.findFirst({
        where: { phone: user.phone },
      })
    }

    if (!livreurRecord) {
      return NextResponse.json({
        totalCourses: 0,
        note: 0,
        livraisonsActives: 0,
        completesAujourdhui: 0,
        revenusMois: 0,
      })
    }

    // Début et fin de la journée
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // Début et fin du mois en cours
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)

    // Requêtes parallèles pour les statistiques
    const [
      totalCourses,
      activeDeliveries,
      completedToday,
      monthlyDelivered,
    ] = await Promise.all([
      // Total des courses (livrées)
      db.delivery.count({
        where: {
          livreurId: livreurRecord.id,
          status: 'livre',
        },
      }),
      // Livraisons actives (ni livrées ni annulées)
      db.delivery.count({
        where: {
          livreurId: livreurRecord.id,
          status: {
            notIn: ['livre', 'annulee'],
          },
        },
      }),
      // Complétées aujourd'hui
      db.delivery.count({
        where: {
          livreurId: livreurRecord.id,
          status: 'livre',
          updatedAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),
      // Livraisons livrées ce mois (pour calculer les revenus)
      db.delivery.findMany({
        where: {
          livreurId: livreurRecord.id,
          status: 'livre',
          updatedAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: { price: true },
      }),
    ])

    // Calculer les revenus du mois
    const revenusMois = monthlyDelivered.reduce((sum, d) => sum + d.price, 0)

    return NextResponse.json({
      totalCourses,
      note: livreurRecord.rating,
      livraisonsActives: activeDeliveries,
      completesAujourdhui: completedToday,
      revenusMois,
    })
  } catch (error) {
    console.error('Erreur GET /api/livreurs/me/stats:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
