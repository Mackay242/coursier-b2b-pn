import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/dispatch - Panneau de dispatch pour l'admin
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

    // Récupérer toutes les livraisons non terminées ni annulées
    // Ordonnées par priorité (urgente > haute > normale) puis par createdAt
    const priorityOrder: Record<string, number> = {
      urgente: 0,
      haute: 1,
      normale: 2,
    }

    const deliveries = await db.delivery.findMany({
      where: {
        status: {
          notIn: ['livre', 'annulee'],
        },
      },
      include: {
        livreur: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicle: true,
            status: true,
            zone: true,
          },
        },
        company: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, name: true, email: true },
        },
        timeline: {
          orderBy: { timestamp: 'asc' },
          take: 1,
        },
      },
    })

    // Trier par priorité puis par date de création
    const sortedDeliveries = deliveries.sort((a, b) => {
      const pA = priorityOrder[a.priority] ?? 2
      const pB = priorityOrder[b.priority] ?? 2
      if (pA !== pB) return pA - pB
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

    // Récupérer tous les livreurs avec leur statut et nombre de livraisons actives
    const livreurs = await db.livreur.findMany({
      include: {
        _count: {
          select: {
            deliveries: {
              where: {
                status: {
                  notIn: ['livre', 'annulee'],
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const livreursWithStats = livreurs.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      vehicle: l.vehicle,
      zone: l.zone,
      rating: l.rating,
      status: l.status,
      coursesDone: l.coursesDone,
      activeDeliveries: l._count.deliveries,
    }))

    return NextResponse.json({
      livraisons: sortedDeliveries,
      livreurs: livreursWithStats,
    })
  } catch (error) {
    console.error('Erreur GET /api/dispatch:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors du chargement du panneau de dispatch' },
      { status: 500 }
    )
  }
}
