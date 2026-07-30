import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/companies - Liste de toutes les entreprises (admin uniquement)
export async function GET() {
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

    const companies = await db.company.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        _count: {
          select: {
            deliveries: true,
            invoices: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Enrichir avec des stats mensuelles
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

        const monthlyDeliveries = await db.delivery.count({
          where: {
            companyId: company.id,
            createdAt: { gte: monthStart, lte: monthEnd },
          },
        })

        const monthlySpending = await db.delivery.aggregate({
          _sum: { price: true },
          where: {
            companyId: company.id,
            createdAt: { gte: monthStart, lte: monthEnd },
          },
        })

        const pendingInvoices = await db.invoice.count({
          where: {
            companyId: company.id,
            status: 'en_attente',
          },
        })

        return {
          ...company,
          stats: {
            coursesMensuelles: monthlyDeliveries,
            depensesMensuelles: monthlySpending._sum.price || 0,
            facturesEnAttente: pendingInvoices,
            totalLivraisons: company._count.deliveries,
            totalFactures: company._count.invoices,
          },
        }
      })
    )

    return NextResponse.json({ entreprises: companiesWithStats })
  } catch (error) {
    console.error('Erreur GET /api/companies:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des entreprises' },
      { status: 500 }
    )
  }
}
