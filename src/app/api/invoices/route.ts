import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/invoices - Liste des factures
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

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
    }

    if (status) {
      where.status = status
    }

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, nif: true, rccm: true },
          },
          client: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { deliveries: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.invoice.count({ where }),
    ])

    return NextResponse.json({
      factures: invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Erreur GET /api/invoices:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des factures' },
      { status: 500 }
    )
  }
}

// POST /api/invoices - Générer une facture mensuelle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    // Admin peut générer pour n'importe quelle entreprise, client pour la sienne
    const body = await request.json()
    const { companyId: targetCompanyId, month, year } = body

    let companyId = targetCompanyId

    if (session.user.role === 'client') {
      const company = await db.company.findUnique({
        where: { userId: session.user.id },
      })
      if (!company) {
        return NextResponse.json(
          { erreur: 'Aucune entreprise associée' },
          { status: 400 }
        )
      }
      companyId = company.id
    }

    if (!companyId) {
      return NextResponse.json(
        { erreur: 'L\'identifiant de l\'entreprise est requis' },
        { status: 400 }
      )
    }

    // Déterminer la période
    const now = new Date()
    const invoiceMonth = month !== undefined ? parseInt(month) : now.getMonth() + 1
    const invoiceYear = year !== undefined ? parseInt(year) : now.getFullYear()

    const periodStart = new Date(invoiceYear, invoiceMonth - 1, 1)
    const periodEnd = new Date(invoiceYear, invoiceMonth, 0, 23, 59, 59, 999)

    const periodLabel = `${String(invoiceMonth).padStart(2, '0')}/${invoiceYear}`

    // Vérifier s'il existe déjà une facture pour cette période
    const existingInvoice = await db.invoice.findFirst({
      where: {
        companyId,
        period: periodLabel,
      },
    })

    if (existingInvoice) {
      return NextResponse.json(
        { erreur: `Une facture existe déjà pour la période ${periodLabel}` },
        { status: 400 }
      )
    }

    // Trouver toutes les livraisons livrées pas encore facturées pour cette période
    const deliveriesToInvoice = await db.delivery.findMany({
      where: {
        companyId,
        status: 'livre',
        invoiceId: null,
        updatedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    })

    if (deliveriesToInvoice.length === 0) {
      return NextResponse.json(
        { erreur: 'Aucune livraison livrée à facturer pour cette période' },
        { status: 400 }
      )
    }

    // Calculer le montant total
    const totalAmount = deliveriesToInvoice.reduce((sum, d) => sum + d.price, 0)

    // Générer la référence de facture
    const refDate = `${invoiceYear}${String(invoiceMonth).padStart(2, '0')}`
    const invoiceCount = await db.invoice.count()
    const refSeq = String(invoiceCount + 1).padStart(3, '0')
    const reference = `FAC-${refDate}-${refSeq}`

    // Récupérer les infos de l'entreprise
    const company = await db.company.findUnique({ where: { id: companyId } })

    // Créer la facture et lier les livraisons
    const invoice = await db.invoice.create({
      data: {
        reference,
        period: periodLabel,
        amount: totalAmount,
        coursesCount: deliveriesToInvoice.length,
        status: 'en_attente',
        clientId: session.user.role === 'client' ? session.user.id : deliveriesToInvoice[0].clientId,
        companyId,
        deliveries: {
          connect: deliveriesToInvoice.map((d) => ({ id: d.id })),
        },
      },
      include: {
        company: {
          select: { id: true, name: true, nif: true, rccm: true, address: true },
        },
        deliveries: true,
      },
    })

    return NextResponse.json({ facture: invoice }, { status: 201 })
  } catch (error) {
    console.error('Erreur POST /api/invoices:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la génération de la facture' },
      { status: 500 }
    )
  }
}
