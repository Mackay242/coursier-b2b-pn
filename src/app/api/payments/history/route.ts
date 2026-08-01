import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/payments/history - Historique des paiements de l'utilisateur
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorise' }, { status: 401 })
    }

    // Admin voit tous les paiements, client/admin voit les siens
    const where =
      session.user.role === 'admin'
        ? {}
        : { userId: session.user.id }

    const payments = await db.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        invoice: {
          select: {
            reference: true,
            period: true,
            company: {
              select: { name: true },
            },
          },
        },
      },
    })

    const historique = payments.map((p) => ({
      id: p.id,
      transactionId: p.transactionId,
      provider: p.provider,
      phoneNumber: p.phoneNumber,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      facture: p.invoice
        ? {
            reference: p.invoice.reference,
            periode: p.invoice.period,
            entreprise: p.invoice.company?.name || null,
          }
        : null,
    }))

    return NextResponse.json({
      paiements: historique,
      total: historique.length,
    })
  } catch (error) {
    console.error('Erreur GET /api/payments/history:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la recuperation de l\'historique' },
      { status: 500 }
    )
  }
}
