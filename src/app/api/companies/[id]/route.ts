import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/companies/[id] - Detail d'une entreprise
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorise' }, { status: 401 })
    }

    const { id } = await params

    // Clients ne peuvent voir que leur propre entreprise
    if (session.user.role === 'client') {
      const ownCompany = await db.company.findUnique({
        where: { userId: session.user.id },
      })
      if (!ownCompany || ownCompany.id !== id) {
        return NextResponse.json(
          { erreur: 'Acces non autorise' },
          { status: 403 }
        )
      }
    } else if (session.user.role !== 'admin') {
      return NextResponse.json(
        { erreur: 'Acces reserve aux administrateurs' },
        { status: 403 }
      )
    }

    const company = await db.company.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, createdAt: true },
        },
        _count: {
          select: { deliveries: true, invoices: true },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ erreur: 'Entreprise introuvable' }, { status: 404 })
    }

    // Stats detaillees
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const monthlyDeliveries = await db.delivery.count({
      where: {
        companyId: id,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    })

    const statusBreakdown = await db.delivery.groupBy({
      by: ['status'],
      where: { companyId: id },
      _count: true,
    })

    const unpaidTotal = await db.invoice.aggregate({
      _sum: { amount: true },
      where: {
        companyId: id,
        status: 'en_attente',
      },
    })

    return NextResponse.json({
      entreprise: {
        ...company,
        stats: {
          coursesMensuelles: monthlyDeliveries,
          repartitionStatut: statusBreakdown.map((s) => ({
            statut: s.status,
            nombre: s._count,
          })),
          totalImpaye: unpaidTotal._sum.amount || 0,
        },
      },
    })
  } catch (error) {
    console.error('Erreur GET /api/companies/[id]:', error)
    return NextResponse.json(
      { erreur: "Erreur serveur lors de la recuperation de l'entreprise" },
      { status: 500 }
    )
  }
}

// PATCH /api/companies/[id] - Mettre a jour une entreprise
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorise' }, { status: 401 })
    }

    const { id } = await params

    // Clients peuvent mettre a jour leur propre entreprise
    if (session.user.role === 'client') {
      const ownCompany = await db.company.findUnique({
        where: { userId: session.user.id },
      })
      if (!ownCompany || ownCompany.id !== id) {
        return NextResponse.json(
          { erreur: 'Acces non autorise' },
          { status: 403 }
        )
      }
    } else if (session.user.role !== 'admin') {
      return NextResponse.json(
        { erreur: 'Acces reserve aux administrateurs' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, nif, rccm, address, sector, email, phone, plan, planLimit } = body

    const company = await db.company.findUnique({ where: { id } })
    if (!company) {
      return NextResponse.json({ erreur: 'Entreprise introuvable' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (nif !== undefined) updateData.nif = nif
    if (rccm !== undefined) updateData.rccm = rccm
    if (address !== undefined) updateData.address = address
    if (sector !== undefined) updateData.sector = sector
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (plan !== undefined) updateData.plan = plan
    if (planLimit !== undefined) updateData.planLimit = planLimit

    const updatedCompany = await db.company.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ entreprise: updatedCompany })
  } catch (error) {
    console.error('Erreur PATCH /api/companies/[id]:', error)
    return NextResponse.json(
      { erreur: "Erreur serveur lors de la mise a jour de l'entreprise" },
      { status: 500 }
    )
  }
}
