import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/mandates - Liste des mandats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    // Le client ne voit que les mandats de son entreprise
    if (session.user.role === 'client') {
      const company = await db.company.findUnique({
        where: { userId: session.user.id },
      })
      if (company) {
        where.companyId = company.id
      } else {
        where.clientId = session.user.id
      }
    }

    if (status) where.status = status
    if (type) where.type = type

    const [mandates, total] = await Promise.all([
      db.mandate.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true },
          },
          client: {
            select: { id: true, name: true, email: true },
          },
          tasks: {
            select: { id: true, reference: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.mandate.count({ where }),
    ])

    return NextResponse.json({
      mandates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Erreur GET /api/mandates:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des mandats' },
      { status: 500 }
    )
  }
}

// POST /api/mandates - Créer un mandat
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }
    if (session.user.role === 'livreur') {
      return NextResponse.json({ erreur: 'Accès non autorisé pour ce rôle' }, { status: 403 })
    }

    const body = await request.json()
    const { type, description, startDate, endDate } = body

    if (!type) {
      return NextResponse.json(
        { erreur: 'Le type de mandat est obligatoire' },
        { status: 400 }
      )
    }

    // Récupérer l'entreprise du client
    let companyId: string | null = null
    let clientId: string | null = session.user.id

    if (session.user.role === 'client') {
      const company = await db.company.findUnique({
        where: { userId: session.user.id },
      })
      if (company) companyId = company.id
    } else if (session.user.role === 'admin' && body.companyId) {
      companyId = body.companyId
      clientId = body.clientId || null
    }

    // Générer la référence MND-YYYYMMDD-NNN
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const todayCount = await db.mandate.count({
      where: { createdAt: { gte: startOfDay, lt: endOfDay } },
    })
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const seq = String(todayCount + 1).padStart(3, '0')
    const reference = `MND-${dateStr}-${seq}`

    const mandate = await db.mandate.create({
      data: {
        reference,
        type,
        description: description || null,
        status: 'actif',
        clientId,
        companyId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      include: {
        company: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ mandate }, { status: 201 })
  } catch (error) {
    console.error('Erreur POST /api/mandates:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la création du mandat' },
      { status: 500 }
    )
  }
}

// PATCH /api/mandates - Mettre à jour le statut d'un mandat (admin uniquement)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ erreur: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json(
        { erreur: 'L\'identifiant et le statut sont obligatoires' },
        { status: 400 }
      )
    }

    const validStatuses = ['actif', 'expire', 'revoque']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { erreur: `Statut invalide. Valeurs autorisées : ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const existing = await db.mandate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ erreur: 'Mandat introuvable' }, { status: 404 })
    }

    const mandate = await db.mandate.update({
      where: { id },
      data: { status },
      include: {
        company: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, name: true, email: true },
        },
        tasks: {
          select: { id: true, reference: true, status: true },
        },
      },
    })

    // Notifier le client du changement
    if (mandate.clientId) {
      const statusLabels: Record<string, string> = {
        actif: 'Actif',
        expire: 'Expiré',
        revoque: 'Révoqué',
      }
      await db.notification.create({
        data: {
          userId: mandate.clientId,
          type: 'status_change',
          title: 'Mise à jour de votre mandat',
          message: `Le mandat ${mandate.reference} est maintenant : ${statusLabels[status]}`,
          link: `/mandates/${mandate.id}`,
        },
      })
    }

    return NextResponse.json({ mandate })
  } catch (error) {
    console.error('Erreur PATCH /api/mandates:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la mise à jour du mandat' },
      { status: 500 }
    )
  }
}
