import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Supprimer un compte par email (usage unique, à supprimer après)
export async function DELETE(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    // Supprimer les données liées
    await db.notification.deleteMany({ where: { user: { email } } })
    await db.payment.deleteMany({ where: { user: { email } } })
    await db.timeline.deleteMany({ where: { delivery: { client: { email } } } })
    await db.invoice.deleteMany({ where: { client: { email } } })
    await db.delivery.deleteMany({ where: { client: { email } } })
    await db.company.deleteMany({ where: { user: { email } } })
    await db.user.delete({ where: { email } })

    return NextResponse.json({ message: `Compte ${email} supprime` })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
