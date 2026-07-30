import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/dashboard/stats - Statistiques du tableau de bord client
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer l'entreprise du client
    const company = await db.company.findUnique({
      where: { userId: session.user.id },
    })

    if (!company) {
      return NextResponse.json(
        { erreur: 'Aucune entreprise associée à votre compte' },
        { status: 400 }
      )
    }

    // Livraisons actives (en_attente, prise_en_charge, en_course)
    const activeDeliveries = await db.delivery.count({
      where: {
        companyId: company.id,
        status: { in: ['en_attente', 'prise_en_charge', 'en_course'] },
      },
    })

    // Livraisons complétées aujourd'hui
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
    const completedToday = await db.delivery.count({
      where: {
        companyId: company.id,
        status: 'livre',
        updatedAt: { gte: todayStart },
      },
    })

    // Courses du mois en cours
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const monthlyCourses = await db.delivery.count({
      where: {
        companyId: company.id,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    })

    // Dépenses du mois
    const monthlySpending = await db.delivery.aggregate({
      _sum: { price: true },
      where: {
        companyId: company.id,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    })

    // Répartition par statut
    const statusBreakdown = await db.delivery.groupBy({
      by: ['status'],
      where: { companyId: company.id },
      _count: true,
    })

    // Répartition par type
    const typeBreakdown = await db.delivery.groupBy({
      by: ['type'],
      where: { companyId: company.id },
      _count: true,
    })

    // Dernières livraisons
    const recentDeliveries = await db.delivery.findMany({
      where: { companyId: company.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reference: true,
        type: true,
        status: true,
        pickup: true,
        dropoff: true,
        createdAt: true,
        livreur: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json({
      statistiques: {
        livraisonsActives: activeDeliveries,
        completeesAujourdhui: completedToday,
        tempsMoyenPriseEnCharge: 18, // mock en minutes
        coursesMensuelles: {
          utilisees: monthlyCourses,
          limite: company.planLimit,
          restantes: Math.max(0, company.planLimit - monthlyCourses),
          pourcentage: Math.min(100, Math.round((monthlyCourses / company.planLimit) * 100)),
        },
        depensesMensuelles: monthlySpending._sum.price || 0,
        repartitionStatut: statusBreakdown.map((s) => ({
          statut: s.status,
          nombre: s._count,
        })),
        repartitionType: typeBreakdown.map((t) => ({
          type: t.type,
          nombre: t._count,
        })),
      },
      dernieresLivraisons: recentDeliveries,
      entreprise: {
        nom: company.name,
        plan: company.plan,
        planLimite: company.planLimit,
      },
    })
  } catch (error) {
    console.error('Erreur GET /api/dashboard/stats:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
