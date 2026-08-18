import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const VALID_TRANSITIONS: Record<string, string[]> = {
  en_attente: ['prise_en_charge', 'annulee'],
  prise_en_charge: ['en_course', 'annulee'],
  en_course: ['livre', 'annulee'],
  livre: [],
  annulee: [],
}

const STATUS_EVENT_MAP: Record<string, string> = {
  prise_en_charge: 'pris_en_charge',
  en_course: 'en_livraison',
  livre: 'livre',
  annulee: 'annulee',
}

// PATCH /api/dispatch/[id]/status - Mettre à jour le statut d'une livraison
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    if (session.user.role !== 'admin' && session.user.role !== 'livreur') {
      return NextResponse.json(
        { erreur: 'Accès réservé aux administrateurs et livreurs' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status, comment } = body

    if (!status) {
      return NextResponse.json(
        { erreur: 'Le statut est obligatoire' },
        { status: 400 }
      )
    }

    if (!VALID_TRANSITIONS[status] && status !== 'en_attente') {
      return NextResponse.json(
        { erreur: 'Statut invalide' },
        { status: 400 }
      )
    }

    // Vérifier que la livraison existe
    const delivery = await db.delivery.findUnique({
      where: { id },
      include: {
        livreur: {
          select: { id: true },
        },
      },
    })

    if (!delivery) {
      return NextResponse.json(
        { erreur: 'Livraison introuvable' },
        { status: 404 }
      )
    }

    // Vérifier la transition de statut
    const currentStatus = delivery.status
    const allowedTransitions = VALID_TRANSITIONS[currentStatus]
    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        { erreur: `Transition de statut non autorisée : ${currentStatus} → ${status}` },
        { status: 400 }
      )
    }

    // Si le rôle est livreur, vérifier que la livraison lui est assignée
    if (session.user.role === 'livreur') {
      if (!delivery.livreurId) {
        return NextResponse.json(
          { erreur: 'Cette livraison n\'est assignée à aucun livreur' },
          { status: 403 }
        )
      }
      // Resoudre l'ID Livreur a partir du User (pas de FK direct)
      const livreur = await db.livreur.findFirst({
        where: { OR: [
          { phone: (session.user as Record<string, string>)?.phone },
          { name: session.user.name },
        ]},
        select: { id: true },
      })
      if (!livreur || delivery.livreurId !== livreur.id) {
        return NextResponse.json(
          { erreur: 'Cette livraison ne vous est pas assignée' },
          { status: 403 }
        )
      }
    }

    // Mettre à jour la livraison
    const timelineEvent = STATUS_EVENT_MAP[status]
    const timelineComment = comment || `Statut mis à jour : ${status}`

    const updatedDelivery = await db.delivery.update({
      where: { id },
      data: {
        status,
        timeline: {
          create: {
            event: timelineEvent || 'statut_modifie',
            comment: timelineComment,
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

    // Notifier le service de suivi
    try {
      await fetch('/?XTransformPort=3003', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'dispatch:status',
          data: {
            deliveryId: id,
            status,
          },
        }),
      })
    } catch {
      // Le service de suivi est optionnel
    }

    return NextResponse.json({ livraison: updatedDelivery })
  } catch (error) {
    console.error('Erreur PATCH /api/dispatch/[id]/status:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la mise à jour du statut' },
      { status: 500 }
    )
  }
}
