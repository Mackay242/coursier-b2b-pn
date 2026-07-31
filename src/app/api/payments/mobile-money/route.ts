import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/payments/mobile-money - Initier un paiement Mobile Money (simulation USSD)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorise' }, { status: 401 })
    }

    const body = await request.json()
    const { invoiceId, provider, phoneNumber } = body

    if (!invoiceId) {
      return NextResponse.json(
        { erreur: "L'identifiant de la facture est obligatoire" },
        { status: 400 }
      )
    }

    if (!provider || !['airtel_money', 'moov_money'].includes(provider)) {
      return NextResponse.json(
        { erreur: "Operateur invalide. Choisissez airtel_money ou moov_money" },
        { status: 400 }
      )
    }

    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length < 8) {
      return NextResponse.json(
        { erreur: 'Le numero de telephone est invalide' },
        { status: 400 }
      )
    }

    // Verifier que la facture existe
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: {
          select: { id: true, name: true, userId: true },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { erreur: 'Facture introuvable' },
        { status: 404 }
      )
    }

    if (invoice.status === 'payee') {
      return NextResponse.json(
        { erreur: 'Cette facture a deja ete payee' },
        { status: 400 }
      )
    }

    // Verifier que l'utilisateur possede cette facture (ou est admin)
    if (session.user.role === 'client') {
      if (invoice.companyId) {
        if (!invoice.company || invoice.company.userId !== session.user.id) {
          return NextResponse.json(
            { erreur: "Vous n'etes pas autorise a payer cette facture" },
            { status: 403 }
          )
        }
      } else if (invoice.clientId !== session.user.id) {
        return NextResponse.json(
          { erreur: "Vous n'etes pas autorise a payer cette facture" },
          { status: 403 }
        )
      }
    }

    // Generer le prefixe et le transactionId selon le provider
    const prefix = provider === 'airtel_money' ? 'AM' : 'MM'
    const now = new Date()
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0')
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase()
    const transactionId = `${prefix}-${dateStr}-${randomSuffix}`

    // Creer le paiement avec le statut en_cours
    const payment = await db.payment.create({
      data: {
        transactionId,
        provider,
        phoneNumber: phoneNumber.trim(),
        amount: invoice.amount,
        status: 'en_cours',
        invoiceId: invoice.id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({
      status: 'initiated',
      transactionId: payment.transactionId,
      montant: payment.amount,
      message: 'Veuillez confirmer le paiement sur votre telephone. Un menu USSD a ete envoye.',
    })
  } catch (error) {
    console.error('Erreur POST /api/payments/mobile-money:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de l\'initiation du paiement' },
      { status: 500 }
    )
  }
}
