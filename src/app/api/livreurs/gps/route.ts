import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// PATCH /api/livreurs/gps - Mise à jour position GPS du livreur
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    if (session.user.role !== 'livreur') {
      return NextResponse.json(
        { erreur: 'Accès réservé aux livreurs' },
        { status: 403 }
      )
    }

    // Parser le corps de la requête
    const body = await request.json()
    const { deliveryId, lat, lng } = body as {
      deliveryId: string
      lat: number
      lng: number
    }

    // Validation des champs
    if (!deliveryId || typeof deliveryId !== 'string') {
      return NextResponse.json(
        { erreur: 'Identifiant de livraison requis' },
        { status: 400 }
      )
    }

    if (lat === undefined || lng === undefined || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { erreur: 'Coordonnées GPS invalides (lat et lng requis)' },
        { status: 400 }
      )
    }

    if (lat < -90 || lat > 90) {
      return NextResponse.json(
        { erreur: 'Latitude invalide (doit être entre -90 et 90)' },
        { status: 400 }
      )
    }

    if (lng < -180 || lng > 180) {
      return NextResponse.json(
        { erreur: 'Longitude invalide (doit être entre -180 et 180)' },
        { status: 400 }
      )
    }

    // Récupérer l'utilisateur pour trouver le livreur correspondant
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })
    }

    // Trouver le livreur par nom correspondant au nom de l'utilisateur
    let livreurRecord = await db.livreur.findFirst({
      where: { name: user.name },
    })

    // Si pas trouvé par nom, chercher par téléphone
    if (!livreurRecord && user.phone) {
      livreurRecord = await db.livreur.findFirst({
        where: { phone: user.phone },
      })
    }

    if (!livreurRecord) {
      return NextResponse.json(
        { erreur: 'Profil livreur introuvable' },
        { status: 404 }
      )
    }

    // Vérifier que la livraison existe et est assignée à ce livreur
    const delivery = await db.delivery.findUnique({
      where: { id: deliveryId },
    })

    if (!delivery) {
      return NextResponse.json(
        { erreur: 'Livraison introuvable' },
        { status: 404 }
      )
    }

    if (delivery.livreurId !== livreurRecord.id) {
      return NextResponse.json(
        { erreur: 'Cette livraison ne vous est pas assignée' },
        { status: 403 }
      )
    }

    // La diffusion GPS en temps réel est gérée par le tracking-service (Socket.io).
    // Ici, nous retournons simplement un succès — le client mobile enverra
    // parallèlement la position au tracking-service via Socket.io pour broadcast.
    return NextResponse.json({
      succes: true,
      message: 'Position GPS enregistrée',
      deliveryId,
      lat,
      lng,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Erreur PATCH /api/livreurs/gps:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la mise à jour de la position GPS' },
      { status: 500 }
    )
  }
}
