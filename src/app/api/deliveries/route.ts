import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/deliveries - Liste des livraisons
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    // Filtre de recherche globale
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { pickup: { contains: search } },
        { dropoff: { contains: search } },
        { recipientName: { contains: search } },
        { recipientPhone: { contains: search } },
        { description: { contains: search } },
      ]
    }

    // Filtrer par rôle
    if (session.user.role === 'client') {
      const company = await db.company.findUnique({
        where: { userId: session.user.id },
      })
      if (company) {
        where.companyId = company.id
      } else {
        where.clientId = session.user.id
      }
    } else if (session.user.role === 'livreur') {
      // Resoudre l'ID Livreur a partir du User (pas de FK direct)
      const livreur = await db.livreur.findFirst({
        where: { OR: [
          { phone: (session.user as Record<string, string>)?.phone },
          { name: session.user.name },
        ]},
        select: { id: true },
      })
      if (livreur) {
        where.livreurId = livreur.id
      } else {
        return NextResponse.json({ livraisons: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } })
      }
    }

    // Filtres optionnels
    if (status) {
      where.status = status
    }
    if (type) {
      where.type = type
    }

    const [deliveries, total] = await Promise.all([
      db.delivery.findMany({
        where,
        include: {
          livreur: {
            select: { id: true, name: true, phone: true, vehicle: true, status: true },
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.delivery.count({ where }),
    ])

    return NextResponse.json({
      livraisons: deliveries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Erreur GET /api/deliveries:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des livraisons' },
      { status: 500 }
    )
  }
}

// POST /api/deliveries - Créer une livraison
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const {
      type = 'standard',
      priority = 'normale',
      pickup,
      dropoff,
      recipientName,
      recipientPhone,
      description,
      instructions,
      paymentMode = 'forfait',
      price,
    } = body

    if (!pickup || !dropoff) {
      return NextResponse.json(
        { erreur: 'Les adresses de départ et de destination sont obligatoires' },
        { status: 400 }
      )
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

    // Générer la référence
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const todayDeliveries = await db.delivery.count({
      where: {
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      },
    })
    const seq = String(todayDeliveries + 1).padStart(3, '0')
    const reference = `CMD-${dateStr}-${seq}`

    // Calcul du prix selon le type
    const calculatedPrice = price ||
      (type === 'express' ? 5000 :
        type === 'inter-arrondissement' ? 4000 : 2500)

    // Créer la livraison avec le premier événement timeline
    const delivery = await db.delivery.create({
      data: {
        reference,
        type,
        status: 'en_attente',
        priority,
        pickup,
        dropoff,
        recipientName: recipientName || null,
        recipientPhone: recipientPhone || null,
        description: description || null,
        instructions: instructions || null,
        paymentMode,
        price: calculatedPrice,
        clientId: session.user.id,
        companyId: company.id,
        timeline: {
          create: {
            event: 'commande_creee',
            comment: 'Commande créée avec succès',
          },
        },
      },
      include: {
        livreur: {
          select: { id: true, name: true, phone: true, vehicle: true },
        },
        company: {
          select: { id: true, name: true },
        },
        timeline: {
          orderBy: { timestamp: 'asc' },
        },
      },
    })

    return NextResponse.json({ livraison: delivery }, { status: 201 })
  } catch (error) {
    console.error('Erreur POST /api/deliveries:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la création de la livraison' },
      { status: 500 }
    )
  }
}
