import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification } from '@/app/api/notifications/route'

// POST /api/payments/mobile-money/confirm - Confirmer un paiement Mobile Money (simulation USSD)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorise' }, { status: 401 })
    }

    const body = await request.json()
    const { transactionId } = body

    if (!transactionId || typeof transactionId !== 'string') {
      return NextResponse.json(
        { erreur: 'Le identifiant de transaction est obligatoire' },
        { status: 400 }
      )
    }

    // Trouver le paiement
    const payment = await db.payment.findUnique({
      where: { transactionId },
    })

    if (!payment) {
      return NextResponse.json(
        { erreur: 'Transaction introuvable' },
        { status: 404 }
      )
    }

    if (payment.status !== 'en_cours') {
      return NextResponse.json(
        { erreur: `Cette transaction est deja ${payment.status}` },
        { status: 400 }
      )
    }

    // Verifier les droits (admin ou proprietaire du paiement)
    if (session.user.role !== 'admin' && payment.userId !== session.user.id) {
      return NextResponse.json(
        { erreur: "Vous n'etes pas autorise a confirmer cette transaction" },
        { status: 403 }
      )
    }

    // Simuler le delai de traitement USSD (2 secondes)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 90% de chance de succes, 10% d'echec
    const isSuccess = Math.random() < 0.9

    if (isSuccess) {
      // Mise a jour du paiement vers reussi
      const updatedPayment = await db.payment.update({
        where: { id: payment.id },
        data: { status: 'reussi' },
      })

      // Mise a jour de la facture si liee
      if (payment.invoiceId) {
        await db.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: 'payee',
            paidDate: new Date(),
          },
        })
      }

      // Creer une notification pour l'utilisateur
      if (payment.userId) {
        await createNotification(
          payment.userId,
          'payment',
          'Paiement recu',
          `Votre paiement de ${payment.amount} FCFA a ete effectue avec succes. Transaction: ${payment.transactionId}`
        )
      }

      return NextResponse.json({
        status: 'reussi',
        transactionId: updatedPayment.transactionId,
        message: 'Paiement effectue avec succes. Votre facture a ete mise a jour.',
      })
    } else {
      // Mise a jour du paiement vers echoue
      const updatedPayment = await db.payment.update({
        where: { id: payment.id },
        data: { status: 'echoue' },
      })

      return NextResponse.json(
        {
          status: 'echoue',
          transactionId: updatedPayment.transactionId,
          message: 'Le paiement a echoue. Veuillez reessayer ou contacter votre operateur.',
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Erreur POST /api/payments/mobile-money/confirm:', error)
    return NextResponse.json(
      { erreur: "Erreur serveur lors de la confirmation du paiement" },
      { status: 500 }
    )
  }
}
