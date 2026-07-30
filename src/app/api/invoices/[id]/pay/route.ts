import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// PATCH /api/invoices/[id]/pay - Marquer une facture comme payée
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { erreur: 'Seul un administrateur peut valider un paiement' },
        { status: 403 }
      )
    }

    const { id } = await params
    const invoice = await db.invoice.findUnique({ where: { id } })

    if (!invoice) {
      return NextResponse.json({ erreur: 'Facture introuvable' }, { status: 404 })
    }

    if (invoice.status === 'payee') {
      return NextResponse.json(
        { erreur: 'Cette facture est déjà payée' },
        { status: 400 }
      )
    }

    const updatedInvoice = await db.invoice.update({
      where: { id },
      data: {
        status: 'payee',
        paidDate: new Date(),
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

    return NextResponse.json({ facture: updatedInvoice })
  } catch (error) {
    console.error('Erreur PATCH /api/invoices/[id]/pay:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors du paiement de la facture' },
      { status: 500 }
    )
  }
}
