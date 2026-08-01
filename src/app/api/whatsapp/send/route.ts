import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppMessage, WhatsAppConfig } from '@/lib/whatsapp-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/whatsapp/send
 * Envoyer un message WhatsApp manuellement (depuis le dashboard admin)
 * Body : { to: string, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { to, message } = await request.json()

    if (!to || !message) {
      return NextResponse.json(
        { erreur: 'Numéro et message obligatoires' },
        { status: 400 }
      )
    }

    const config: WhatsAppConfig = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
      businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER || '242066105805',
    }

    const result = await sendWhatsAppMessage(to, message, config)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Message envoyé',
        simulation: !config.accessToken,
      })
    }

    return NextResponse.json(
      { erreur: "Erreur d'envoi", details: result.error },
      { status: 500 }
    )
  } catch (error) {
    console.error('[WhatsApp Send] Erreur:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
