import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// PATCH /api/dispatch/assign - Assigner un livreur à une livraison
export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { deliveryId, livreurId } = body

    if (!deliveryId || !livreurId) {
      return NextResponse.json(
        { erreur: 'Les identifiants de livraison et de livreur sont obligatoires' },
        { status: 400 }
      )
    }

    // Vérifier que la livraison existe
    const delivery = await db.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        livreur: {
          select: { id: true, name: true },
        },
      },
    })

    if (!delivery) {
      return NextResponse.json(
        { erreur: 'Livraison introuvable' },
        { status: 404 }
      )
    }

    if (delivery.status === 'livre' || delivery.status === 'annulee') {
      return NextResponse.json(
        { erreur: 'Impossible d\'assigner un livreur à une livraison terminée ou annulée' },
        { status: 400 }
      )
    }

    // Vérifier que le livreur existe
    const livreur = await db.livreur.findUnique({ where: { id: livreurId } })

    if (!livreur) {
      return NextResponse.json(
        { erreur: 'Livreur introuvable' },
        { status: 404 }
      )
    }

    if (livreur.status === 'hors_service') {
      return NextResponse.json(
        { erreur: 'Ce livreur n\'est pas disponible (hors service)' },
        { status: 400 }
      )
    }

    // Assigner le livreur et mettre à jour le statut
    const updatedDelivery = await db.delivery.update({
      where: { id: deliveryId },
      data: {
        livreurId,
        status: 'prise_en_charge',
        timeline: {
          create: {
            event: 'pris_en_charge',
            comment: `Assigné au livreur ${livreur.name} via le panneau de dispatch`,
          },
        },
      },
      include: {
        livreur: {
          select: { id: true, name: true, phone: true, vehicle: true, status: true, zone: true },
        },
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
    })

    // Notifier le service de suivi (mise à jour DB uniquement pour le moment)
    try {
      await fetch('/?XTransformPort=3003', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'dispatch:assign',
          data: {
            deliveryId: updatedDelivery.id,
            livreurId,
            status: 'prise_en_charge',
          },
        }),
      })
    } catch {
      // Le service de suivi est optionnel, on ne bloque pas l'assignation
    }

    return NextResponse.json({ livraison: updatedDelivery })
  } catch (error) {
    console.error('Erreur PATCH /api/dispatch/assign:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de l\'assignation du livreur' },
      { status: 500 }
    )
  }
}
