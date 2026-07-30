import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/livreurs - Liste de tous les livreurs avec stats
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorise' }, { status: 401 })
    }

    const livreurs = await db.livreur.findMany({
      include: {
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Enrichir avec les stats des livraisons actives
    const livreursWithStats = await Promise.all(
      livreurs.map(async (livreur) => {
        const activeDeliveries = await db.delivery.count({
          where: {
            livreurId: livreur.id,
            status: { in: ['prise_en_charge', 'en_course'] },
          },
        })

        const completedToday = await db.delivery.count({
          where: {
            livreurId: livreur.id,
            status: 'livre',
            updatedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        })

        return {
          ...livreur,
          deliveriesCount: livreur._count.deliveries,
          activeDeliveries,
          completedToday,
        }
      })
    )

    return NextResponse.json({ livreurs: livreursWithStats })
  } catch (error) {
    console.error('Erreur GET /api/livreurs:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la recuperation des livreurs' },
      { status: 500 }
    )
  }
}
