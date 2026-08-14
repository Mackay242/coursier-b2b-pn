// Service WhatsApp - Automatisation pour Coursier B2B Pointe-Noire
// Supporte : Meta WhatsApp Business API + Mode simulation locale

export interface WhatsAppConfig {
  phoneNumberId: string
  accessToken: string
  verifyToken: string
  businessNumber: string
}

export interface IncomingMessage {
  from: string      // numéro téléphone expéditeur (format: 242066105805)
  body: string      // contenu du message
  timestamp: string
  messageId: string
  type: 'text' | 'interactive' | 'location' | 'document'
}

export interface ParsedCommand {
  action: 'commander' | 'suivi' | 'aide' | 'historique' | 'annuler' | 'service_list' | 'task_create' | 'task_track' | 'task_history' | 'unknown'
  params: Record<string, string>
  raw: string
}

// ========================
// PARSING DES COMMANDES
// ========================

/**
 * Parse un message WhatsApp en commande structurée.
 * Formats supportés :
 *
 * COMMANDE :
 *   "commander" / "cmd" / "nouvelle course"
 *   "commander: départ=...|destination=...|destinataire=...|tel=...|desc=..."
 *
 * SERVICES ADMINISTRATIFS :
 *   "service" / "services" / "admin" / "administratif" / "demarche"
 *
 * DEMANDE DE TÂCHE :
 *   "demande" / "tache" / "nouvelle_tache"
 *   Format: demande\nService: (1-6)\nTitre: (description)\nPriorite: normale/haute/urgente
 *
 * SUIVI TÂCHE :
 *   "suivi_tache TSK-xxx" / "etat_tache TSK-xxx"
 *
 * MES TÂCHES :
 *   "mes_taches" / "mes demandes"
 *
 * SUIVI LIVRAISON :
 *   "suivi CMD-2024-0001" / "status CMD-2024-0001" / "track CMD-2024-0001"
 *
 * AIDE :
 *   "aide" / "help" / "menu" / "?" / "bonjour" / "salut"
 *
 * HISTORIQUE :
 *   "historique" / "mes courses" / "mes commandes"
 *
 * ANNULER :
 *   "annuler CMD-2024-0001" / "cancel CMD-2024-0001"
 */
export function parseWhatsAppCommand(message: string): ParsedCommand {
  const raw = message.trim()
  const lower = raw.toLowerCase()

  // Aide / Menu / Salutations
  if (['aide', 'help', 'menu', '?', 'bonjour', 'salut', 'bonsoir', 'bonne nuit'].includes(lower)) {
    return { action: 'aide', params: {}, raw }
  }

  // Services administratifs — liste
  if (['service', 'services', 'admin', 'administratif', 'demarche'].some(k => lower === k || lower.startsWith(k + ' '))) {
    return { action: 'service_list', params: {}, raw }
  }

  // Mes tâches / Mes demandes administratives
  if (lower === 'mes_taches' || lower === 'mes taches' || lower === 'mes demandes' || lower === 'mes_demandes') {
    return { action: 'task_history', params: {}, raw }
  }

  // Suivi tâche — TSK-xxx
  const taskTrackMatch = lower.match(/(?:suivi_tache|etat_tache|suivi tache|etat tache|suivi_tâche|etat_tâche)\s+(tsk-[\d-]+)/i)
  if (taskTrackMatch) {
    return { action: 'task_track', params: { reference: taskTrackMatch[1].toUpperCase() }, raw }
  }

  // Demande / nouvelle tâche — parse structured message
  if (['demande', 'tache', 'nouvelle_tache', 'nouvelle tache', 'nouvelle_tâche', 'nouvelle tâche'].some(k => lower === k || lower.startsWith(k + ' ') || lower.startsWith(k + '\n'))) {
    const params: Record<string, string> = {}
    const lines = raw.split(/[\n|]/)
    for (const line of lines) {
      const eqIndex = line.indexOf(':')
      if (eqIndex === -1) continue
      const key = line.substring(0, eqIndex).trim().toLowerCase()
      const value = line.substring(eqIndex + 1).trim()
      if (!value) continue

      if (['service', 'numero service', 'n° service'].includes(key)) {
        params.serviceNumber = value.trim()
      } else if (['titre', 'title', 'description', 'desc', 'objet', 'sujet'].includes(key)) {
        params.title = value
      } else if (['priorite', 'priorité', 'urgence', 'priority'].includes(key)) {
        params.priority = value.toLowerCase()
      }
    }
    return { action: 'task_create', params, raw }
  }

  // Historique livraisons
  if (['historique', 'mes courses', 'mes commandes', 'history'].some(k => lower.includes(k))) {
    return { action: 'historique', params: {}, raw }
  }

  // Annuler
  const cancelMatch = lower.match(/(?:annuler|cancel)\s+(cmd-[\d-]+)/i)
  if (cancelMatch) {
    return { action: 'annuler', params: { reference: cancelMatch[1].toUpperCase() }, raw }
  }

  // Suivi livraison (CMD-xxx only, not TSK)
  const trackMatch = lower.match(/(?:suivi|status|track|etat)\s+(cmd-[\d-]+)/i)
  if (trackMatch) {
    return { action: 'suivi', params: { reference: trackMatch[1].toUpperCase() }, raw }
  }

  // Commander - format structuré
  if (['commander', 'cmd', 'nouvelle course', 'course', 'commande', 'envoyer', 'livrer'].some(k => lower.startsWith(k))) {
    const params: Record<string, string> = {}

    // Format clé=valeur séparé par | ou nouvelle ligne
    if (raw.includes('=')) {
      const pairs = raw.split(/[|\n]/)
      for (const pair of pairs) {
        const eqIndex = pair.indexOf('=')
        if (eqIndex === -1) continue
        const key = pair.substring(0, eqIndex).trim().toLowerCase()
        const value = pair.substring(eqIndex + 1).trim()
        if (!value) continue

        if (['départ', 'depart', 'de', 'from', 'ramassage', 'pickup'].includes(key)) {
          params.pickup = value
        } else if (['destination', 'arrivée', 'arrivee', 'to', 'livraison', 'dropoff', 'chez'].includes(key)) {
          params.dropoff = value
        } else if (['destinataire', 'nom', 'recipient', 'name', 'pour'].includes(key)) {
          params.recipientName = value
        } else if (['tel', 'téléphone', 'telephone', 'phone', 'numero'].includes(key)) {
          params.recipientPhone = value
        } else if (['desc', 'description', 'colis', 'paquet', 'details', 'détails'].includes(key)) {
          params.description = value
        } else if (['type', 'format'].includes(key)) {
          params.type = value.toLowerCase()
        } else if (['priorité', 'priorite', 'urgence'].includes(key)) {
          params.priority = value.toLowerCase()
        }
      }
    }

    return { action: 'commander', params, raw }
  }

  // Détection intelligente : adresses de Pointe-Noire
  const pnKeywords = [
    'centre-ville', 'tie-tie', 'tchimbamba', 'loandjili', 'mvoulou',
    'mongo poko', 'lumumba', 'zone portuaire', 'pk', 'avenue',
    'rue', 'boulevard', 'carrefour', 'total', 'bgfi', 'ecobank',
    'aéroport', 'aeroport', 'gare', 'marché', 'marche', 'cathédrale',
    'cathedrale', 'hopital', 'hôpital', 'mairie', 'port', 'congo',
    'pointe-noire', 'pointe noire'
  ]

  const hasPNContext = pnKeywords.some(addr => lower.includes(addr))
  if (hasPNContext) {
    return { action: 'commander', params: { _freeform: raw }, raw }
  }

  return { action: 'unknown', params: {}, raw }
}

// ========================
// RÉPONSES AUTOMATIQUES
// ========================

export function buildAideResponse(): string {
  return `🚴 *CoursierExpress B2B - Pointe-Noire*

📋 *Commandes disponibles :*

📦 *Commander une course :*
commander
ou format complet :
commander:
départ=BGFI Centre-ville
destination=TotalEnergies Loandjili
destinataire=Jean Dupont
tel=066000000
desc=Documents confidentiels

📍 *Suivre une livraison :*
suivi CMD-2024-0801

📋 *Historique :*
historique

❌ *Annuler :*
annuler CMD-2024-0801

🏛️ *Services administratifs :*
services

📝 *Nouvelle demande administrative :*
demande
Service: (1-6)
Titre: (description)
Priorite: normale/haute/urgente

🔍 *Suivre une demande :*
suivi_tache TSK-20250701-001

📋 *Mes demandes admin :*
mes_taches

💡 *Astuce :* Envoyez simplement une adresse de Pointe-Noire pour démarrer une course !`
}

export function buildCommanderIncompleteResponse(params: Record<string, string>): string {
  const missing: string[] = []
  if (!params.pickup) missing.push('départ (adresse de ramassage)')
  if (!params.dropoff) missing.push('destination (adresse de livraison)')

  return `📝 *Nouvelle Course - Informations manquantes*

Merci ! J'ai besoin de quelques détails :

${missing.map(m => `❌ ${m}`).join('\n')}

*Format :*
commander:
départ=Votre adresse de départ
destination=Adresse de livraison
destinataire=Nom du destinataire (optionnel)
tel=Numéro du destinataire (optionnel)
desc=Description du colis (optionnel)

Exemple :
commander:
départ=BGFI Centre-ville
destination=Total Lumumba
destinataire=M. Ngoma
tel=065123456
desc=Enveloppe confidentielle`
}

export function buildCommanderConfirmResponse(delivery: {
  reference: string
  pickup: string
  dropoff: string
  recipientName: string | null
  price: number
  type: string
}): string {
  const typeLabel = delivery.type === 'express'
    ? '⚡ Express'
    : delivery.type === 'inter-arrondissement'
      ? '🏙️ Inter-arrondissement'
      : '📦 Standard'

  return `✅ *Commande confirmée !*

📦 Référence : *${delivery.reference}*
🚴 Type : ${typeLabel}
📍 Départ : ${delivery.pickup}
🏁 Destination : ${delivery.dropoff}
${delivery.recipientName ? `👤 Destinataire : ${delivery.recipientName}` : ''}
💰 Prix : *${delivery.price.toLocaleString('fr-FR')} FCFA*

📊 *Suivi en temps réel :*
suivi ${delivery.reference}

⏳ Un livreur sera assigné sous peu.
_Équipe CoursierExpress_ 🚴`
}

export function buildSuiviResponse(delivery: {
  reference: string
  status: string
  pickup: string
  dropoff: string
  recipientName: string | null
  livreurName?: string | null
  livreurPhone?: string | null
  timeline?: Array<{ event: string; comment: string | null; timestamp: string }>
}): string {
  const statusEmoji: Record<string, string> = {
    en_attente: '⏳',
    prise_en_charge: '📋',
    en_course: '🚴',
    livre: '✅',
    annulee: '❌',
  }
  const statusLabel: Record<string, string> = {
    en_attente: "En attente d'assignation",
    prise_en_charge: 'Prise en charge',
    en_course: 'En cours de livraison',
    livre: 'Livrée avec succès',
    annulee: 'Annulée',
  }

  const emoji = statusEmoji[delivery.status] || '❓'
  const label = statusLabel[delivery.status] || delivery.status

  let response = `${emoji} *Suivi ${delivery.reference}*\n\n📍 État : *${label}*\n🔄 Départ : ${delivery.pickup}\n🏁 Destination : ${delivery.dropoff}
${delivery.recipientName ? `\n👤 Destinataire : ${delivery.recipientName}` : ''}`

  if (delivery.livreurName) {
    response += `\n🚴 Livreur : ${delivery.livreurName}`
    if (delivery.livreurPhone) {
      response += ` (${delivery.livreurPhone})`
    }
  }

  if (delivery.timeline && delivery.timeline.length > 0) {
    response += '\n\n📜 *Historique :*\n'
    const eEmoji: Record<string, string> = {
      commande_creee: '📝', pris_en_charge: '📋', en_livraison: '🚴', livre: '✅', annulee: '❌',
    }
    for (const event of delivery.timeline) {
      const date = new Date(event.timestamp).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
      response += `${eEmoji[event.event] || '📌'} ${event.comment || event.event} — ${date}\n`
    }
  }

  return response
}

export function buildHistoriqueResponse(deliveries: Array<{
  reference: string
  status: string
  pickup: string
  dropoff: string
  createdAt: string
  price: number
}>): string {
  if (deliveries.length === 0) {
    return '📋 *Aucune course trouvée.*\n\nCommencez par commander une course avec :\ncommander'
  }

  const statusEmoji: Record<string, string> = {
    en_attente: '⏳', prise_en_charge: '📋', en_course: '🚴', livre: '✅', annulee: '❌',
  }

  let response = `📋 *Vos dernières courses (${deliveries.length}) :*\n\n`
  for (const d of deliveries.slice(0, 10)) {
    const emoji = statusEmoji[d.status] || '❓'
    const date = new Date(d.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit',
    })
    response += `${emoji} *${d.reference}* — ${date}\n   ${d.pickup} → ${d.dropoff}\n   ${d.price.toLocaleString('fr-FR')} FCFA\n\n`
  }

  response += `Pour le détail d'une course :\nsuivi CMD-XXXX-XXX`
  return response
}

export function buildAnnulerResponse(success: boolean, reference: string): string {
  if (success) {
    return `❌ *Course annulée*\n\n📦 ${reference} a été annulée avec succès.\n\nPour commander une nouvelle course :\ncommander`
  }
  return `⚠️ *Impossible d'annuler*\n\nLa course ${reference} n'existe pas ou ne peut plus être annulée.\nSeules les courses "en attente" peuvent être annulées.\n\nVérifiez avec :\nsuivi ${reference}`
}

export function buildUnknownResponse(): string {
  return `🤔 *Je n'ai pas compris votre message.*\n\nEnvoyez *aide* pour voir les commandes disponibles, ou tapez directement une adresse de Pointe-Noire pour démarrer une course.`
}

// ========================
// RÉPONSES ADMINISTRATIVES (PRODESK)
// ========================

// Service families reference for the WhatsApp bot
const WHATSAPP_SERVICE_FAMILIES = [
  { name: 'Bureau Digital', family: 'digital_office', price: 5000, slaHours: 4 },
  { name: 'CNSS / Social', family: 'cnss_social', price: 7500, slaHours: 4 },
  { name: 'Fiscalité', family: 'fiscalite', price: 10000, slaHours: 4 },
  { name: 'SFEC', family: 'sfec', price: 15000, slaHours: 24 },
  { name: 'Gestion Documentaire', family: 'documentaire', price: 2500, slaHours: 4 },
  { name: 'Secretariat / Back-office', family: 'secretariat', price: 5000, slaHours: 4 },
] as const

export function getServiceFamilies() {
  return WHATSAPP_SERVICE_FAMILIES
}

export function buildServiceListResponse(): string {
  return `📋 *SERVICES ADMINISTRATIFS COURSIERB2B*\n\n1. *Bureau Digital* — 5 000 FCFA (SLA: 4h)\n2. *CNSS / Social* — 7 500 FCFA (SLA: 4h)\n3. *Fiscalité* — 10 000 FCFA (SLA: 4h)\n4. *SFEC* — 15 000 FCFA (SLA: 24h)\n5. *Gestion Documentaire* — 2 500 FCFA (SLA: 4h)\n6. *Secretariat / Back-office* — 5 000 FCFA (SLA: 4h)\n\nPour faire une demande, envoyez :\n*demande*\nService: (1-6)\nTitre: (description)\nPriorite: normale/haute/urgente`
}

export function buildTaskCreateIncompleteResponse(params: Record<string, string>): string {
  const missing: string[] = []
  if (!params.serviceNumber) missing.push('Service (numéro 1-6)')
  if (!params.title) missing.push('Titre (description de la demande)')

  return `📝 *Demande administrative — Informations manquantes*\n\nMerci ! J'ai besoin de quelques détails :\n\n${missing.map(m => `❌ ${m}`).join('\n')}\n\n*Format :*\ndemande\nService: (1-6)\nTitre: Description de votre demande\nPriorite: normale/haute/urgente\n\n*Exemple :*\ndemande\nService: 2\nTitre: Déclaration CNSS mensuelle juin 2025\nPriorite: haute`
}

export function buildTaskCreateConfirmResponse(data: {
  reference: string
  title: string
  family: string
  priority: string
  price: number
  slaDeadline: string
}): string {
  const priorityEmoji: Record<string, string> = { normale: '🟢', haute: '🟡', urgente: '🔴' }
  const emoji = priorityEmoji[data.priority] || '🟢'

  return `✅ *Demande administrative créée !*\n\n📄 Référence : *${data.reference}*\n${emoji} Priorité : ${data.priority.charAt(0).toUpperCase() + data.priority.slice(1)}\n🏷️ Famille : ${data.family}\n📝 Objet : ${data.title}\n💰 Prix : *${data.price.toLocaleString('fr-FR')} FCFA*\n⏱️ SLA : ${data.slaDeadline}\n\n📊 *Suivi en temps réel :*\nsuivi_tache ${data.reference}\n\n⏳ Un agent sera assigné sous peu.\n_Équipe CoursierB2B ProDesk_ 🏛️`
}

export function buildTaskTrackResponse(task: {
  reference: string
  title: string
  family: string
  status: string
  priority: string
  slaBreached: boolean
  createdAt: string
  completedAt: string | null
  timeline: Array<{ event: string; comment: string | null; timestamp: string }>
}): string {
  const statusEmoji: Record<string, string> = {
    en_attente: '⏳', en_cours: '🔄', en_validation: '🔍', termine: '✅', annule: '❌',
  }
  const statusLabel: Record<string, string> = {
    en_attente: 'En attente', en_cours: 'En cours de traitement', en_validation: 'En validation', termine: 'Terminée', annule: 'Annulée',
  }

  const emoji = statusEmoji[task.status] || '❓'
  const label = statusLabel[task.status] || task.status
  const breachBadge = task.slaBreached ? '\n🚨 *SLA dépassé !*' : ''

  let response = `${emoji} *Suivi ${task.reference}*\n\n📍 État : *${label}*${breachBadge}\n🏷️ Famille : ${task.family}\n📝 Objet : ${task.title}\n📅 Créée le : ${new Date(task.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`

  if (task.completedAt) {
    response += `\n✅ Terminée le : ${new Date(task.completedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
  }

  if (task.timeline && task.timeline.length > 0) {
    response += '\n\n📜 *Historique :*\n'
    const eEmoji: Record<string, string> = {
      demande_creee: '📝', pieces_controlees: '📋', mandat_verifie: '✅', en_traitement: '🔄', soumis: '📤', valide: '✔️', preuve_fournie: '📎', archive: '🗄️', annule: '❌',
    }
    for (const event of task.timeline) {
      const date = new Date(event.timestamp).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
      response += `${eEmoji[event.event] || '📌'} ${event.comment || event.event} — ${date}\n`
    }
  }

  return response
}

export function buildTaskHistoryResponse(tasks: Array<{
  reference: string
  title: string
  family: string
  status: string
  createdAt: string
  price: number
}>): string {
  if (tasks.length === 0) {
    return '📋 *Aucune demande administrative trouvée.*\n\nCommencez par faire une demande avec :\ndemande'
  }

  const statusEmoji: Record<string, string> = {
    en_attente: '⏳', en_cours: '🔄', en_validation: '🔍', termine: '✅', annule: '❌',
  }

  let response = `📋 *Vos demandes administratives (${tasks.length}) :*\n\n`
  for (const t of tasks.slice(0, 10)) {
    const emoji = statusEmoji[t.status] || '❓'
    const date = new Date(t.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit',
    })
    response += `${emoji} *${t.reference}* — ${date}\n   ${t.title}\n   ${t.family} — ${t.price.toLocaleString('fr-FR')} FCFA\n\n`
  }

  response += `Pour le détail d'une demande :\nsuivi_tache TSK-XXXX-XXX`
  return response
}

// ========================
// ENVOI VIA META API
// =========================

export async function sendWhatsAppMessage(
  to: string,
  messageText: string,
  config?: WhatsAppConfig
): Promise<{ success: boolean; error?: string }> {
  // Mode simulation : log sans envoyer
  if (!config?.accessToken || !config?.phoneNumberId) {
    console.log(`[WhatsApp SIMULATION] Envoi vers ${to}:\n${messageText}`)
    return { success: true }
  }

  try {
    const response = await fetch(
      `${META_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.startsWith('+') ? to.substring(1) : to,
          type: 'text',
          text: { body: messageText, preview_url: false },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('[WhatsApp API Error]', response.status, err)
      return { success: false, error: err }
    }

    const data = await response.json()
    console.log('[WhatsApp] Message envoyé:', data.messages?.[0]?.id)
    return { success: true }
  } catch (error) {
    console.error('[WhatsApp] Erreur envoi:', error)
    return { success: false, error: String(error) }
  }
}

// ========================
// NOTIFICATION STATUS CHANGE
// ========================

export function buildStatusChangeNotification(delivery: {
  reference: string
  status: string
  livreurName?: string | null
  livreurPhone?: string | null
}): string {
  const statusMsg: Record<string, string> = {
    prise_en_charge: 'Votre colis a été pris en charge par le livreur.',
    en_course: 'Votre colis est en cours de livraison !',
    livre: 'Votre colis a été livré avec succès !',
    annulee: 'Votre course a été annulée.',
  }

  const msg = statusMsg[delivery.status]
  if (!msg) return ''

  const statusEmoji: Record<string, string> = {
    prise_en_charge: '📋', en_course: '🚴', livre: '✅', annulee: '❌',
  }

  let text = `${statusEmoji[delivery.status]} *Mise à jour ${delivery.reference}*\n\n${msg}`

  if (delivery.livreurName && (delivery.status === 'prise_en_charge' || delivery.status === 'en_course')) {
    text += `\n\n🚴 Livreur : ${delivery.livreurName}`
    if (delivery.livreurPhone) {
      text += `\n📞 ${delivery.livreurPhone}`
    }
  }

  text += `\n\nPour suivre en temps réel :\nsuivi ${delivery.reference}`
  return text
}
