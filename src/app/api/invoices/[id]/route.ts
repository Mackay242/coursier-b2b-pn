import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/invoices/[id] - Détail d'une facture avec ses livraisons
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
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, name: true, nif: true, rccm: true, address: true, email: true, phone: true },
        },
        client: {
          select: { id: true, name: true, email: true },
        },
        deliveries: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            reference: true,
            type: true,
            pickup: true,
            dropoff: true,
            price: true,
            status: true,
            createdAt: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ erreur: 'Facture introuvable' }, { status: 404 })
    }

    // Vérifier l'accès
    if (session.user.role === 'client') {
      const company = await db.company.findUnique({
        where: { userId: session.user.id },
      })
      if (company && invoice.companyId !== company.id && invoice.clientId !== session.user.id) {
        return NextResponse.json({ erreur: 'Accès non autorisé' }, { status: 403 })
      }
    }

    return NextResponse.json({ facture: invoice })
  } catch (error) {
    console.error('Erreur GET /api/invoices/[id]:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération de la facture' },
      { status: 500 }
    )
  }
}
