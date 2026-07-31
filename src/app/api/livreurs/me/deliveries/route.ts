import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/livreurs/me/deliveries - Livraisons du livreur connecté
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

    // Chercher le livreur par nom correspondant au nom du user
    let livreurRecord = await db.livreur.findFirst({
      where: { name: user.name },
    })

    // Si pas trouvé par nom, chercher par téléphone
    if (!livreurRecord && user.phone) {
      livreurRecord = await db.livreur.findFirst({
        where: { phone: user.phone },
      })
    }

    if (!livreurRecord) {
      return NextResponse.json({
        livraisons: [],
        statistiques: {
          totalAujourdhui: 0,
          completesAujourdhui: 0,
          actives: 0,
        },
      })
    }

    // Début et fin de la journée
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // Toutes les livraisons du livreur
    const deliveries = await db.delivery.findMany({
      where: { livreurId: livreurRecord.id },
      include: {
        company: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, name: true, email: true },
        },
        timeline: {
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Statistiques du jour
    const todayDeliveries = await db.delivery.findMany({
      where: {
        livreurId: livreurRecord.id,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    })

    const totalAujourdhui = todayDeliveries.length
    const completesAujourdhui = todayDeliveries.filter((d) => d.status === 'livre').length
    const actives = deliveries.filter(
      (d) => !['livre', 'annulee'].includes(d.status)
    ).length

    return NextResponse.json({
      livraisons: deliveries,
      statistiques: {
        totalAujourdhui,
        completesAujourdhui,
        actives,
      },
    })
  } catch (error) {
    console.error('Erreur GET /api/livreurs/me/deliveries:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des livraisons' },
      { status: 500 }
    )
  }
}
