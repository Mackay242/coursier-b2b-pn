import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// Helper pour vérifier l'accès à une livraison
async function canAccessDelivery(userId: string, role: string, deliveryId: string) {
  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    include: { company: true },
  })

  if (!delivery) return null

  if (role === 'admin' || role === 'livreur') return delivery

  if (role === 'client') {
    const company = await db.company.findUnique({
      where: { userId },
    })
    if (company && delivery.companyId === company.id) return delivery
    if (delivery.clientId === userId) return delivery
  }

  return null
}

// Événements de timeline associés aux changements de statut
const statusEvents: Record<string, string> = {
  prise_en_charge: 'pris_en_charge',
  en_course: 'en_livraison',
  livre: 'livre',
  annulee: 'annulee',
}

const statusComments: Record<string, string> = {
  prise_en_charge: 'Le livreur a pris en charge la commande',
  en_course: 'Le livreur est en route vers la destination',
  livre: 'La livraison a été effectuée avec succès',
  annulee: 'La commande a été annulée',
}

// GET /api/deliveries/[id] - Détail d'une livraison
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const delivery = await canAccessDelivery(session.user.id, session.user.role, id)

    if (!delivery) {
      return NextResponse.json({ erreur: 'Livraison introuvable' }, { status: 404 })
    }

    const fullDelivery = await db.delivery.findUnique({
      where: { id },
      include: {
        livreur: {
          select: { id: true, name: true, phone: true, vehicle: true, status: true, rating: true },
        },
        company: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: {
          select: { id: true, name: true, email: true },
        },
        timeline: {
          orderBy: { timestamp: 'asc' },
        },
        invoice: {
          select: { id: true, reference: true, status: true },
        },
      },
    })

    return NextResponse.json({ livraison: fullDelivery })
  } catch (error) {
    console.error('Erreur GET /api/deliveries/[id]:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération de la livraison' },
      { status: 500 }
    )
  }
}

// PATCH /api/deliveries/[id] - Mettre à jour une livraison
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    // Seuls admin et livreur peuvent modifier
    if (session.user.role !== 'admin' && session.user.role !== 'livreur') {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, livreurId, priority, instructions, description } = body

    const delivery = await db.delivery.findUnique({ where: { id } })
    if (!delivery) {
      return NextResponse.json({ erreur: 'Livraison introuvable' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const timelineEvents: Array<{ event: string; comment: string }> = []

    if (status && status !== delivery.status) {
      updateData.status = status
      const eventKey = statusEvents[status]
      if (eventKey) {
        timelineEvents.push({
          event: eventKey,
          comment: statusComments[status] || `Statut mis à jour: ${status}`,
        })
      }
    }

    if (livreurId !== undefined) {
      updateData.livreurId = livreurId
    }

    if (priority) updateData.priority = priority
    if (instructions !== undefined) updateData.instructions = instructions
    if (description !== undefined) updateData.description = description

    const updatedDelivery = await db.delivery.update({
      where: { id },
      data: {
        ...updateData,
        ...(timelineEvents.length > 0 && {
          timeline: {
            create: timelineEvents,
          },
        }),
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
    console.error('Erreur PATCH /api/deliveries/[id]:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la mise à jour de la livraison' },
      { status: 500 }
    )
  }
}
