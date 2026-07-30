import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// PATCH /api/deliveries/[id]/assign - Assigner un livreur
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { erreur: 'Seul un administrateur peut assigner un livreur' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { livreurId } = body

    if (!livreurId) {
      return NextResponse.json(
        { erreur: 'L\'identifiant du livreur est obligatoire' },
        { status: 400 }
      )
    }

    const delivery = await db.delivery.findUnique({ where: { id } })
    if (!delivery) {
      return NextResponse.json({ erreur: 'Livraison introuvable' }, { status: 404 })
    }

    if (delivery.status !== 'en_attente') {
      return NextResponse.json(
        { erreur: 'Seule une livraison en attente peut être assignée' },
        { status: 400 }
      )
    }

    // Vérifier que le livreur existe et est disponible
    const livreur = await db.livreur.findUnique({ where: { id: livreurId } })
    if (!livreur) {
      return NextResponse.json({ erreur: 'Livreur introuvable' }, { status: 404 })
    }

    if (livreur.status === 'hors_service') {
      return NextResponse.json(
        { erreur: 'Ce livreur n\'est pas disponible' },
        { status: 400 }
      )
    }

    // Assigner et mettre à jour
    const updatedDelivery = await db.delivery.update({
      where: { id },
      data: {
        livreurId,
        status: 'prise_en_charge',
        timeline: {
          create: {
            event: 'pris_en_charge',
            comment: `Assigné au livreur ${livreur.name}`,
          },
        },
      },
      include: {
        livreur: {
          select: { id: true, name: true, phone: true, vehicle: true, status: true },
        },
        company: {
          select: { id: true, name: true },
        },
        timeline: {
          orderBy: { timestamp: 'asc' },
        },
      },
    })

    return NextResponse.json({ livraison: updatedDelivery })
  } catch (error) {
    console.error('Erreur PATCH /api/deliveries/[id]/assign:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de l\'assignation du livreur' },
      { status: 500 }
    )
  }
}
