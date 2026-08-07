import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Supprimer un compte par email (usage unique, à supprimer après usage)
export async function DELETE(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }
    return await deleteUser(email)
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Version GET pour pouvoir ouvrir depuis le navigateur (téléphone)
// Ex: /api/auth/delete?email=loic@gmail.com
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')
    if (!email) {
      return new Response(
        '<html><body><h2>Email manquant</h2><p>Usage: /api/auth/delete?email=votre@email.com</p><p><a href="/">Retour</a></p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }
    const result = await deleteUser(email)
    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2 style="color:green">${result.message}</h2><p><a href="/">Retour à l\'app</a></p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  } catch (error) {
    console.error('Delete error:', error)
    return new Response(
      '<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2 style="color:red">Erreur serveur</h2><p><a href="/">Retour</a></p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}

async function deleteUser(email: string) {
  await db.notification.deleteMany({ where: { user: { email } } })
  await db.payment.deleteMany({ where: { user: { email } } })
  await db.timeline.deleteMany({ where: { delivery: { client: { email } } } })
  await db.invoice.deleteMany({ where: { client: { email } } })
  await db.delivery.deleteMany({ where: { client: { email } } })
  await db.company.deleteMany({ where: { user: { email } } })
  await db.user.delete({ where: { email } })
  return { message: `Compte ${email} supprime avec succes` }
}
