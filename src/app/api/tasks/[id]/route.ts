import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// Vérifie que l'utilisateur est propriétaire ou admin
async function canAccessTask(taskId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { clientId: true, companyId: true },
  })
  if (!task) return false

  // Propriétaire direct
  if (task.clientId === userId) return true

  // Membre de l'entreprise
  if (task.companyId) {
    const company = await db.company.findUnique({
      where: { id: task.companyId },
      select: { userId: true },
    })
    if (company && company.userId === userId) return true
  }

  return false
}

// GET /api/tasks/[id] - Détail complet d'une tâche
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const hasAccess = await canAccessTask(id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ erreur: 'Tâche introuvable ou accès refusé' }, { status: 404 })
    }

    const task = await db.task.findUnique({
      where: { id },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            family: true,
            icon: true,
            priceUnit: true,
            slaHours: true,
            slaUrgentHours: true,
          },
        },
        company: {
          select: { id: true, name: true, nif: true, rccm: true, sector: true },
        },
        client: {
          select: { id: true, name: true, email: true, phone: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true, phone: true },
        },
        mandate: {
          select: {
            id: true,
            reference: true,
            type: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        timeline: {
          orderBy: { timestamp: 'asc' },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ erreur: 'Tâche introuvable' }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Erreur GET /api/tasks/[id]:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération de la tâche' },
      { status: 500 }
    )
  }
}

// Labels des événements de transition de statut
const STATUS_EVENT_MAP: Record<string, string> = {
  en_cours: 'en_traitement',
  en_validation: 'soumis',
  termine: 'valide',
  annule: 'annule',
}

// PATCH /api/tasks/[id] - Mettre à jour une tâche (admin uniquement)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ erreur: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      status,
      assignedTo,
      priority,
      urgent,
      completionNote,
      price,
      paymentMode,
    } = body

    // Vérifier que la tâche existe
    const existing = await db.task.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ erreur: 'Tâche introuvable' }, { status: 404 })
    }

    // Préparer les données de mise à jour
    const updateData: Record<string, unknown> = {}
    const timelineEvents: { event: string; comment?: string }[] = []

    if (status && status !== existing.status) {
      updateData.status = status

      // Événement de timeline correspondant
      const timelineEvent = STATUS_EVENT_MAP[status]
      if (timelineEvent) {
        const statusLabels: Record<string, string> = {
          en_attente: 'En attente',
          en_cours: 'En cours de traitement',
          en_validation: 'En validation',
          termine: 'Terminé',
          annule: 'Annulé',
        }
        timelineEvents.push({
          event: timelineEvent,
          comment: `Statut mis à jour : ${statusLabels[status] || status}`,
        })
      }

      // Si terminé, enregistrer la date de complétion
      if (status === 'termine') {
        updateData.completedAt = new Date()
        if (completionNote) {
          updateData.completionNote = completionNote
        }
        timelineEvents.push({
          event: 'preuve_fournie',
          comment: 'Tâche marquée comme terminée',
        })
      }
    }

    if (assignedTo !== undefined && assignedTo !== existing.assignedTo) {
      updateData.assignedTo = assignedTo || null
    }

    if (priority !== undefined) updateData.priority = priority
    if (urgent !== undefined) updateData.urgent = urgent
    if (price !== undefined) updateData.price = price
    if (paymentMode !== undefined) updateData.paymentMode = paymentMode
    if (completionNote !== undefined && status !== 'termine') {
      updateData.completionNote = completionNote
    }

    // Vérification SLA : si on passe en cours ou en validation
    if (status === 'en_cours' || status === 'en_validation') {
      if (existing.slaDeadline && new Date() > existing.slaDeadline) {
        updateData.slaBreached = true
      }
    }

    // Mettre à jour la tâche
    const task = await db.task.update({
      where: { id },
      data: {
        ...updateData,
        timeline: timelineEvents.length > 0
          ? { create: timelineEvents }
          : undefined,
      },
      include: {
        service: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        company: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, name: true, email: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
        timeline: {
          orderBy: { timestamp: 'asc' },
        },
      },
    })

    // Notification pour le client si changement de statut
    if (status && status !== existing.status && task.clientId) {
      const statusLabels: Record<string, string> = {
        en_attente: 'En attente',
        en_cours: 'En cours de traitement',
        en_validation: 'En validation',
        termine: 'Terminé',
        annule: 'Annulé',
      }
      await db.notification.create({
        data: {
          userId: task.clientId,
          type: 'status_change',
          title: 'Mise à jour de votre demande',
          message: `La tâche ${task.reference} est maintenant : ${statusLabels[status] || status}`,
          link: `/tasks/${task.id}`,
        },
      })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Erreur PATCH /api/tasks/[id]:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la mise à jour de la tâche' },
      { status: 500 }
    )
  }
}
