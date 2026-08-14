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
  buildServiceListResponse,
  buildTaskCreateIncompleteResponse,
  buildTaskCreateConfirmResponse,
  buildTaskTrackResponse,
  buildTaskHistoryResponse,
  getServiceFamilies,
  sendWhatsAppMessage,
  IncomingMessage,
  WhatsAppConfig,
} from '@/lib/whatsapp-service'
import { db } from '@/lib/db'

// GET = Vérification webhook Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'coursier-pn-verify-2024'

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp] Webhook vérifié avec succès')
    return new NextResponse(challenge, {
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  console.warn('[WhatsApp] Échec vérification webhook', { mode, token, challenge })
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// POST = Réception messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Vérifier le hub signature (optionnel en dev)
    if (process.env.NODE_ENV === 'production') {
      const signature = request.headers.get('x-hub-signature-256')
      if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }
      // TODO: vérifier HMAC avec app secret
    }

    // Parser le webhook Meta
    const entry = body.entry?.[0]
    if (!entry?.changes?.[0]?.value?.messages?.[0]) {
      // Pas un message texte (ex: statut delivery, echo)
      console.log('[WhatsApp] Webhook non-message reçu:', JSON.stringify(body).substring(0, 200))
      return NextResponse.json({ ok: true })
    }

    const messageData = entry.changes[0].value.messages[0]
    const from = messageData.from
    const msgBody = messageData.text?.body || ''
    const timestamp = messageData.timestamp
    const messageId = messageData.id

    // Ignorer les messages vides
    if (!msgBody.trim()) {
      return NextResponse.json({ ok: true })
    }

    console.log(`[WhatsApp] Message de ${from}: ${msgBody}`)

    // Traiter le message
    const incoming: IncomingMessage = {
      from,
      body: msgBody,
      timestamp,
      messageId,
      type: 'text',
    }

    const responseText = await processWhatsAppMessage(incoming)

    // Envoyer la réponse
    const config: WhatsAppConfig = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
      businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER || '242066105805',
    }

    await sendWhatsAppMessage(from, responseText, config)

    // Sauvegarder le log
    await saveWhatsAppLog(incoming, responseText)

    return NextResponse.json({ ok: true, reply: responseText })
  } catch (error) {
    console.error('[WhatsApp] Erreur webhook:', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}

// ========================
// LOGIQUE DE TRAITEMENT
// ========================

async function processWhatsAppMessage(msg: IncomingMessage): Promise<string> {
  const command = parseWhatsAppCommand(msg.body)
  console.log(`[WhatsApp] Commande parsée: ${command.action}`, command.params)

  switch (command.action) {
    case 'aide':
      return buildAideResponse()

    case 'service_list':
      return buildServiceListResponse()

    case 'task_create':
      return await handleTaskCreate(msg, command.params)

    case 'task_track':
      return await handleTaskTrack(command.params.reference)

    case 'task_history':
      return await handleTaskHistory(msg.from)

    case 'commander':
      return await handleCommander(msg, command.params)

    case 'suivi':
      return await handleSuivi(command.params.reference)

    case 'historique':
      return await handleHistorique(msg.from)

    case 'annuler':
      return await handleAnnuler(command.params.reference)

    default:
      return buildUnknownResponse()
  }
}

// Créer une course via WhatsApp
async function handleCommander(
  msg: IncomingMessage,
  params: Record<string, string>
): Promise<string> {
  // Si freeform (juste une adresse), demander plus de détails
  if (params._freeform) {
    return `📍 J'ai détecté une adresse ! Pour créer la course, utilisez le format :

commander:
départ=${params._freeform}
destination=Adresse de livraison

Tapez *aide* pour voir tous les formats disponibles.`
  }

  // Vérifier les champs obligatoires
  if (!params.pickup || !params.dropoff) {
    return buildCommanderIncompleteResponse(params)
  }

  // Trouver ou créer l'utilisateur/entreprise associée au numéro
  let user = await db.user.findFirst({
    where: { phone: msg.from },
  })

  let company = user
    ? await db.company.findUnique({ where: { userId: user.id } })
    : null

  // Si pas d'utilisateur, on utilise le premier compte client comme fallback
  if (!user || !company) {
    // Prendre le premier client existant
    user = await db.user.findFirst({ where: { role: 'client' } })
    if (user) {
      company = await db.company.findUnique({ where: { userId: user.id } })
    }
  }

  if (!company) {
    return `⚠️ *Erreur de configuration*

Aucune entreprise cliente n'est configurée dans le système. Contactez l'administrateur au ${process.env.WHATSAPP_BUSINESS_NUMBER || '242066105805'}.`
  }

  // Générer la référence
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

  // Déterminer le type et le prix
  const type = params.type === 'express' ? 'express' as const
    : params.type === 'inter-arrondissement' ? 'inter-arrondissement' as const
    : 'standard' as const

  const price = type === 'express' ? 5000
    : type === 'inter-arrondissement' ? 4000
    : 2500

  // Créer la livraison
  const delivery = await db.delivery.create({
    data: {
      reference,
      type,
      status: 'en_attente',
      priority: params.priority === 'urgente' ? 'urgente' as const
        : params.priority === 'haute' ? 'haute' as const
        : 'normale' as const,
      pickup: params.pickup,
      dropoff: params.dropoff,
      recipientName: params.recipientName || null,
      recipientPhone: params.recipientPhone || null,
      description: params.description || `Commande WhatsApp — ${msg.from}`,
      paymentMode: 'forfait',
      price,
      clientId: user!.id,
      companyId: company.id,
      timeline: {
        create: {
          event: 'commande_creee',
          comment: 'Commande créée via WhatsApp Bot',
        },
      },
    },
    include: {
      company: { select: { name: true } },
    },
  })

  console.log(`[WhatsApp] Livraison ${reference} créée via WhatsApp par ${msg.from}`)

  // Créer une notification pour l'admin
  const admin = await db.user.findFirst({ where: { role: 'admin' } })
  if (admin) {
    await db.notification.create({
      data: {
        type: 'new_delivery',
        title: 'Nouvelle commande WhatsApp',
        message: `Course ${reference} — ${params.pickup} → ${params.dropoff} (via WhatsApp)`,
        userId: admin.id,
        link: '/suivi',
      },
    })
  }

  return buildCommanderConfirmResponse({
    reference: delivery.reference,
    pickup: delivery.pickup,
    dropoff: delivery.dropoff,
    recipientName: delivery.recipientName,
    price: delivery.price,
    type: delivery.type,
  })
}

// ========================
// ADMINISTRATIVE TASK HANDLERS
// ========================

// Create an administrative task via WhatsApp
async function handleTaskCreate(
  msg: IncomingMessage,
  params: Record<string, string>
): Promise<string> {
  // Validate service number
  if (!params.serviceNumber || !params.title) {
    return buildTaskCreateIncompleteResponse(params)
  }

  const serviceNum = parseInt(params.serviceNumber, 10)
  if (isNaN(serviceNum) || serviceNum < 1 || serviceNum > 6) {
    return `⚠️ *Numéro de service invalide*

Le service doit être un numéro entre 1 et 6.

Tapez *services* pour voir la liste des services disponibles.`
  }

  const serviceFamily = getServiceFamilies()[serviceNum - 1]
  if (!serviceFamily) {
    return `⚠️ *Service introuvable*

Tapez *services* pour voir la liste des services disponibles.`
  }

  // Determine priority and SLA hours
  const priority = (params.priority === 'urgente' || params.priority === 'haute') ? params.priority : 'normale'
  let slaHours = serviceFamily.slaHours
  if (priority === 'urgente') {
    // Urgent SLA: 1h for 4h services, 4h for 24h services
    slaHours = serviceFamily.slaHours <= 4 ? 1 : 4
  }

  // Find or fallback to a client user
  let user = await db.user.findFirst({ where: { phone: msg.from } })
  let company = user ? await db.company.findUnique({ where: { userId: user.id } }) : null

  if (!user || !company) {
    user = await db.user.findFirst({ where: { role: 'client' } })
    if (user) {
      company = await db.company.findUnique({ where: { userId: user.id } })
    }
  }

  // Generate reference TSK-YYYYMMDD-NNN
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const todayTasks = await db.task.count({
    where: {
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      },
    },
  })
  const seq = String(todayTasks + 1).padStart(3, '0')
  const reference = `TSK-${dateStr}-${seq}`

  // Calculate SLA deadline
  const slaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000)
  const isUrgent = priority === 'urgente'

  // Create the task
  const task = await db.task.create({
    data: {
      reference,
      title: params.title,
      family: serviceFamily.family,
      status: 'en_attente',
      priority,
      urgent: isUrgent,
      slaDeadline,
      price: serviceFamily.price,
      paymentMode: 'forfait',
      clientId: user?.id || null,
      companyId: company?.id || null,
 timeline: {
        create: {
          event: 'demande_creee',
          comment: `Demande créée via WhatsApp Bot — ${serviceFamily.name}`,
        },
      },
    },
  })

  console.log(`[WhatsApp] Tâche ${reference} créée via WhatsApp par ${msg.from}`)

  // Notify admin
  const admin = await db.user.findFirst({ where: { role: 'admin' } })
  if (admin) {
    await db.notification.create({
      data: {
        type: 'system',
        title: 'Nouvelle demande WhatsApp (ProDesk)',
        message: `Tâche ${reference} — ${params.title} (${serviceFamily.name}) — via WhatsApp`,
        userId: admin.id,
        link: '/prodesk',
      },
    })
  }

  const slaDeadlineStr = slaDeadline.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  return buildTaskCreateConfirmResponse({
    reference: task.reference,
    title: task.title,
    family: serviceFamily.name,
    priority,
    price: serviceFamily.price,
    slaDeadline: slaDeadlineStr,
  })
}

// Track an administrative task
async function handleTaskTrack(reference: string): Promise<string> {
  const task = await db.task.findUnique({
    where: { reference },
    include: {
      timeline: { orderBy: { timestamp: 'asc' } },
    },
  })

  if (!task) {
    return `❌ *Non trouvé*

La référence *${reference}* n'existe pas.

Vérifiez et réessayez, ou tapez *mes_taches* pour voir vos demandes.`
  }

  return buildTaskTrackResponse({
    reference: task.reference,
    title: task.title,
    family: task.family,
    status: task.status,
    priority: task.priority,
    slaBreached: task.slaBreached,
    createdAt: task.createdAt.toISOString(),
    completedAt: task.completedAt?.toISOString() || null,
    timeline: task.timeline.map((t) => ({
      event: t.event,
      comment: t.comment,
      timestamp: t.timestamp.toISOString(),
    })),
  })
}

// Task history for a phone number
async function handleTaskHistory(phone: string): Promise<string> {
  // Find user by phone, then get their tasks
  const user = await db.user.findFirst({ where: { phone } })
  if (!user) {
    return '📋 *Aucune demande administrative trouvée.*\n\nCommencez par faire une demande avec :\ndemande'
  }

  const tasks = await db.task.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      reference: true,
      title: true,
      family: true,
      status: true,
      createdAt: true,
      price: true,
    },
  })

  return buildTaskHistoryResponse(tasks.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  })))
}

// Suivi d'une livraison
async function handleSuivi(reference: string): Promise<string> {
  const delivery = await db.delivery.findUnique({
    where: { reference },
    include: {
      livreur: { select: { name: true, phone: true } },
      timeline: { orderBy: { timestamp: 'asc' } },
    },
  })

  if (!delivery) {
    return `❌ *Non trouvé*

La référence *${reference}* n'existe pas.

Vérifiez et réessayez, ou tapez *historique* pour voir vos courses.`
  }

  return buildSuiviResponse({
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

// Historique des courses
async function handleHistorique(phone: string): Promise<string> {
  // Chercher les livraisons par numéro de téléphone du client
  const deliveries = await db.delivery.findMany({
    where: {
      OR: [
        { description: { contains: phone } },
        { recipientPhone: phone },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      reference: true,
      status: true,
      pickup: true,
      dropoff: true,
      createdAt: true,
      price: true,
    },
  })

  return buildHistoriqueResponse(deliveries)
}

// Annuler une course
async function handleAnnuler(reference: string): Promise<string> {
  const delivery = await db.delivery.findUnique({ where: { reference } })

  if (!delivery) {
    return buildAnnulerResponse(false, reference)
  }

  // Seules les courses en_attente peuvent être annulées
  if (delivery.status !== 'en_attente') {
    return buildAnnulerResponse(false, reference)
  }

  await db.delivery.update({
    where: { id: delivery.id },
    data: { status: 'annulee' },
  })

  // Ajouter un événement timeline
  await db.timeline.create({
    data: {
      event: 'annulee',
      comment: 'Annulée via WhatsApp par le client',
      deliveryId: delivery.id,
    },
  })

  console.log(`[WhatsApp] Livraison ${reference} annulée via WhatsApp`)
  return buildAnnulerResponse(true, reference)
}

// Sauvegarder le log de conversation WhatsApp
async function saveWhatsAppLog(
  incoming: IncomingMessage,
  reply: string
): Promise<void> {
  try {
    // Utiliser une table simple — on stocke dans les notifications
    // (pas de table WhatsApp dédiée pour éviter la migration)
    // En production on ajouterait une table WhatsAppConversation
    await db.notification.create({
      data: {
        type: 'system',
        title: `WhatsApp: ${incoming.from}`,
        message: `📥 ${incoming.body}\n📤 ${reply.substring(0, 200)}`,
        userId: (await db.user.findFirst({ where: { role: 'admin' } }))?.id || '',
      },
    })
  } catch (e) {
    // Ne pas bloquer le flow principal
    console.warn('[WhatsApp] Impossible de sauvegarder le log:', e)
  }
}
