import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/tasks - Liste des tâches avec filtres et pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const family = searchParams.get('family')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    // Filtrage par rôle : le client ne voit que les tâches de son entreprise
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

    // Filtres optionnels
    if (status) where.status = status
    if (family) where.family = family
    if (priority) where.priority = priority

    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { title: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        include: {
          service: {
            select: { id: true, name: true, slug: true, icon: true, family: true },
          },
          company: {
            select: { id: true, name: true },
          },
          client: {
            select: { id: true, name: true, email: true },
          },
          assignedUser: {
            select: { id: true, name: true, email: true },
          },
          timeline: {
            orderBy: { timestamp: 'asc' },
            take: 1, // dernier événement pour la liste
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.task.count({ where }),
    ])

    return NextResponse.json({
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Erreur GET /api/tasks:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des tâches' },
      { status: 500 }
    )
  }
}

// POST /api/tasks - Créer une nouvelle tâche
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
    const {
      title,
      description,
      family,
      serviceId,
      mandateId,
      priority = 'normale',
      urgent = false,
      paymentMode = 'forfait',
    } = body

    if (!title || !family) {
      return NextResponse.json(
        { erreur: 'Le titre et la famille de service sont obligatoires' },
        { status: 400 }
      )
    }

    // Récupérer l'entreprise du client (ou de l'utilisateur si admin)
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

    // Récupérer le service pour le prix et le SLA
    let slaDeadline: Date | null = null
    let price = 0

    if (serviceId) {
      const service = await db.service.findUnique({ where: { id: serviceId } })
      if (service) {
        price = service.priceUnit
        const slaHours = urgent ? service.slaUrgentHours : service.slaHours
        slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000)
      }
    }

    // Générer la référence TSK-YYYYMMDD-NNN
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const todayCount = await db.task.count({
      where: { createdAt: { gte: startOfDay, lt: endOfDay } },
    })
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const seq = String(todayCount + 1).padStart(3, '0')
    const reference = `TSK-${dateStr}-${seq}`

    // Créer la tâche avec l'événement timeline initial
    const task = await db.task.create({
      data: {
        reference,
        title,
        description: description || null,
        family,
        status: 'en_attente',
        priority,
        urgent,
        clientId,
        companyId,
        serviceId: serviceId || null,
        mandateId: mandateId || null,
        slaDeadline,
        price,
        paymentMode,
        timeline: {
          create: {
            event: 'demande_creee',
            comment: 'Demande de service créée avec succès',
          },
        },
      },
      include: {
        service: {
          select: { id: true, name: true, slug: true, icon: true },
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

    // Créer une notification pour les administrateurs
    const admins = await db.user.findMany({
      where: { role: 'admin' },
      select: { id: true },
    })

    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'new_delivery',
          title: 'Nouvelle demande de service',
          message: `Une nouvelle tâche ${reference} a été créée : ${title}`,
          link: `/admin/tasks/${task.id}`,
        })),
      })
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Erreur POST /api/tasks:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la création de la tâche' },
      { status: 500 }
    )
  }
}
