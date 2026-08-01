import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/dispatch/stats - KPIs de dispatch pour la journée (admin uniquement)
export async function GET() {
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

    // Début et fin de la journée
    const today = new Date()
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    )

    // Exécuter toutes les requêtes en parallèle
    const [
      totalEnAttente,
      totalActives,
      totalLivreursDispo,
      totalLivreursEnCourse,
      repartitionRaw,
      livreesAujourdhui,
    ] = await Promise.all([
      // 1. Livraisons en attente (total, pas seulement aujourd'hui)
      db.delivery.count({ where: { status: 'en_attente' } }),

      // 2. Livraisons actives (non terminées, non annulées)
      db.delivery.count({
        where: {
          status: { notIn: ['livre', 'annulee'] },
        },
      }),

      // 3. Livreurs disponibles
      db.livreur.count({ where: { status: 'disponible' } }),

      // 4. Livreurs en course
      db.livreur.count({ where: { status: 'en_course' } }),

      // 5. Répartition par zone des livraisons actives (via livreurs assignés)
      db.delivery.findMany({
        where: {
          status: { notIn: ['livre', 'annulee'] },
          livreurId: { not: null },
        },
        include: {
          livreur: {
            select: { zone: true },
          },
        },
      }),

      // 6. Livraisons livrées aujourd'hui avec timeline pour calcul du temps moyen
      db.delivery.findMany({
        where: {
          status: 'livre',
          createdAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
        include: {
          timeline: {
            orderBy: { timestamp: 'asc' },
          },
        },
      }),
    ])

    // Calculer le temps moyen d'assignation (en minutes)
    // C'est le temps entre createdAt et le premier événement "pris_en_charge"
    const assignationTimes: number[] = []
    for (const delivery of livreesAujourdhui) {
      const priseEnChargeEvent = delivery.timeline.find(
        (t) => t.event === 'pris_en_charge'
      )
      if (priseEnChargeEvent) {
        const diffMs =
          priseEnChargeEvent.timestamp.getTime() - delivery.createdAt.getTime()
        const diffMinutes = diffMs / (1000 * 60)
        if (diffMinutes > 0) {
          assignationTimes.push(diffMinutes)
        }
      }
    }
    const tempsMoyenAssignation =
      assignationTimes.length > 0
        ? Math.round(
            assignationTimes.reduce((a, b) => a + b, 0) /
              assignationTimes.length
          )
        : 0

    // Répartition par zone : grouper les livraisons actives par zone du livreur
    const zoneMap = new Map<string, number>()
    for (const delivery of repartitionRaw) {
      const zone = delivery.livreur?.zone ?? 'non_assignee'
      zoneMap.set(zone, (zoneMap.get(zone) ?? 0) + 1)
    }
    const repartitionZones = Array.from(zoneMap.entries()).map(
      ([zone, count]) => ({ zone, count })
    )

    // Revenus d'aujourd'hui (somme des prix des livraisons livrées aujourd'hui)
    const revenusResult = await db.delivery.aggregate({
      where: {
        status: 'livre',
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      _sum: { price: true },
    })
    const revenusAujourdhui = revenusResult._sum.price ?? 0

    return NextResponse.json({
      totalEnAttente,
      totalActives,
      totalLivreursDispo,
      totalLivreursEnCourse,
      tempsMoyenAssignation,
      repartitionZones,
      revenusAujourdhui,
    })
  } catch (error) {
    console.error('Erreur GET /api/dispatch/stats:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors du chargement des statistiques de dispatch' },
      { status: 500 }
    )
  }
}
