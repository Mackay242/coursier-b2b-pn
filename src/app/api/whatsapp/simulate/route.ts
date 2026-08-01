import { NextRequest, NextResponse } from 'next/server'
import {
  parseWhatsAppCommand,
  buildAideResponse,
  buildCommanderIncompleteResponse,
  buildCommanderConfirmResponse,
  buildSuiviResponse,
  buildHistoriqueResponse,
  buildAnnulerResponse,
  buildUnknownResponse,
  IncomingMessage,
} from '@/lib/whatsapp-service'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/whatsapp/simulate
 * Simuler la réception d'un message WhatsApp (sans Meta API)
 * Pour tester le bot localement
 *
 * Body : {
 *   from: string (numéro téléphone),
 *   message: string (contenu du message)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { from = '242066000000', message } = await request.json()

    if (!message) {
      return NextResponse.json(
        { erreur: 'Message obligatoire' },
        { status: 400 }
      )
    }

    const incoming: IncomingMessage = {
      from: String(from),
      body: message,
      timestamp: String(Math.floor(Date.now() / 1000)),
      messageId: `sim_${Date.now()}`,
      type: 'text',
    }

    const command = parseWhatsAppCommand(message)
    let reply: string

    switch (command.action) {
      case 'aide':
        reply = buildAideResponse()
        break

      case 'commander': {
        if (command.params._freeform) {
          reply = `📍 J'ai détecté une adresse ! Pour créer la course, utilisez le format :

commander:
départ=${command.params._freeform}
destination=Adresse de livraison

Tapez *aide* pour voir tous les formats disponibles.`
          break
        }
        if (!command.params.pickup || !command.params.dropoff) {
          reply = buildCommanderIncompleteResponse(command.params)
          break
        }

        // Trouver une entreprise cliente
        let user = await db.user.findFirst({ where: { phone: from } })
        let company = user
          ? await db.company.findUnique({ where: { userId: user.id } })
          : null
        if (!user || !company) {
          user = await db.user.findFirst({ where: { role: 'client' } })
          if (user) {
            company = await db.company.findUnique({ where: { userId: user.id } })
          }
        }
        if (!company) {
          reply = '⚠️ Aucune entreprise cliente configurée.'
          break
        }

        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
        const todayDeliveries = await db.delivery.count({
          where: {
            createdAt: {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
              lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
            },
          },
        })
        const seq = String(todayDeliveries + 1).padStart(3, '0')
        const reference = `CMD-${dateStr}-${seq}`

        const type = command.params.type === 'express' ? 'express' as const
          : command.params.type === 'inter-arrondissement' ? 'inter-arrondissement' as const
          : 'standard' as const

        const price = type === 'express' ? 5000
          : type === 'inter-arrondissement' ? 4000
          : 2500

        const delivery = await db.delivery.create({
          data: {
            reference,
            type,
            status: 'en_attente',
            priority: command.params.priority === 'urgente' ? 'urgente' as const
              : command.params.priority === 'haute' ? 'haute' as const
              : 'normale' as const,
            pickup: command.params.pickup,
            dropoff: command.params.dropoff,
            recipientName: command.params.recipientName || null,
            recipientPhone: command.params.recipientPhone || null,
            description: `Commande WhatsApp Simulée — ${from}`,
            paymentMode: 'forfait',
            price,
            clientId: user!.id,
            companyId: company.id,
            timeline: {
              create: {
                event: 'commande_creee',
                comment: 'Commande créée via WhatsApp Bot (simulation)',
              },
            },
          },
        })

        // Notifier l'admin
        const admin = await db.user.findFirst({ where: { role: 'admin' } })
        if (admin) {
          await db.notification.create({
            data: {
              type: 'new_delivery',
              title: 'Nouvelle commande WhatsApp (simulée)',
              message: `Course ${reference} — ${command.params.pickup} → ${command.params.dropoff}`,
              userId: admin.id,
              link: '/suivi',
            },
          })
        }

        reply = buildCommanderConfirmResponse({
          reference: delivery.reference,
          pickup: delivery.pickup,
          dropoff: delivery.dropoff,
          recipientName: delivery.recipientName,
          price: delivery.price,
          type: delivery.type,
        })
        break
      }

      case 'suivi': {
        const ref = command.params.reference
        const delivery = await db.delivery.findUnique({
          where: { reference: ref },
          include: {
            livreur: { select: { name: true, phone: true } },
            timeline: { orderBy: { timestamp: 'asc' } },
          },
        })
        if (!delivery) {
          reply = `La référence *${ref}* n'existe pas.`
        } else {
          reply = buildSuiviResponse({
            reference: delivery.reference,
            status: delivery.status,
            pickup: delivery.pickup,
            dropoff: delivery.dropoff,
            recipientName: delivery.recipientName,
            livreurName: delivery.livreur?.name,
            livreurPhone: delivery.livreur?.phone,
            timeline: delivery.timeline,
          })
        }
        break
      }

      case 'historique': {
        const deliveries = await db.delivery.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            reference: true, status: true, pickup: true,
            dropoff: true, createdAt: true, price: true,
          },
        })
        reply = buildHistoriqueResponse(deliveries)
        break
      }

      case 'annuler': {
        const ref = command.params.reference
        const delivery = await db.delivery.findUnique({ where: { reference: ref } })
        if (!delivery || delivery.status !== 'en_attente') {
          reply = buildAnnulerResponse(false, ref)
        } else {
          await db.delivery.update({
            where: { id: delivery.id },
            data: { status: 'annulee' },
          })
          await db.timeline.create({
            data: {
              event: 'annulee',
              comment: 'Annulée via WhatsApp (simulation)',
              deliveryId: delivery.id,
            },
          })
          reply = buildAnnulerResponse(true, ref)
        }
        break
      }

      default:
        reply = buildUnknownResponse()
    }

    console.log(`[WhatsApp SIM] from=${from} msg="${message}" → action=${command.action}`)

    return NextResponse.json({
      success: true,
      from,
      message,
      parsed: command,
      reply,
    })
  } catch (error) {
    console.error('[WhatsApp Simulate] Erreur:', error)
    return NextResponse.json(
      { erreur: 'Erreur de simulation', details: String(error) },
      { status: 500 }
    )
  }
}
