import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/admin/sla - Monitoring SLA (admin uniquement)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ erreur: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

    // Tâches avec SLA dépassé (breached)
    const breachedTasks = await db.task.findMany({
      where: {
        slaDeadline: { lt: now },
        status: { notIn: ['termine', 'annule'] },
      },
      include: {
        service: { select: { name: true, family: true, slaHours: true } },
        company: { select: { name: true } },
        client: { select: { name: true, email: true } },
        assignedUser: { select: { name: true } },
      },
      orderBy: { slaDeadline: 'asc' },
    })

    // Tâches approchant l'échéance SLA (dans l'heure)
    const approachingTasks = await db.task.findMany({
      where: {
        slaDeadline: { gte: now, lte: oneHourFromNow },
        status: { notIn: ['termine', 'annule'] },
        slaBreached: false,
      },
      include: {
        service: { select: { name: true, family: true, slaHours: true } },
        company: { select: { name: true } },
        client: { select: { name: true, email: true } },
        assignedUser: { select: { name: true } },
      },
      orderBy: { slaDeadline: 'asc' },
    })

    // Mettre à jour le flag slaBreached pour les tâches dépassées
    if (breachedTasks.length > 0) {
      await db.task.updateMany({
        where: {
          id: { in: breachedTasks.map((t) => t.id) },
          slaBreached: false,
        },
        data: { slaBreached: true },
      })
    }

    // Statistiques par famille de service
    const familyStats = await db.task.groupBy({
      by: ['family'],
      where: {
        status: { notIn: ['annule'] },
      },
      _count: {
        id: true,
      },
    })

    // Calcul du temps de réponse moyen par famille
    // (de la création au premier événement en_traitement)
    const families = ['digital_office', 'cnss_social', 'fiscalite', 'sfec', 'documentaire', 'secretariat']
    const responseTimes: Record<string, { avgMinutes: number; count: number }> = {}

    for (const family of families) {
      const tasksWithTimeline = await db.task.findMany({
        where: {
          family,
          status: { notIn: ['annule'] },
          timeline: {
            some: { event: 'en_traitement' },
          },
        },
        include: {
          timeline: {
            where: { event: { in: ['demande_creee', 'en_traitement'] } },
            orderBy: { timestamp: 'asc' },
          },
        },
        take: 100, // Limiter pour les performances
      })

      const durations: number[] = []
      for (const task of tasksWithTimeline) {
        const created = task.createdAt.getTime()
        const firstTreatment = task.timeline.find((t) => t.event === 'en_traitement')
        if (firstTreatment) {
          durations.push((firstTreatment.timestamp.getTime() - created) / (1000 * 60)) // en minutes
        }
      }

      if (durations.length > 0) {
        responseTimes[family] = {
          avgMinutes: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          count: durations.length,
        }
      } else {
        responseTimes[family] = { avgMinutes: 0, count: 0 }
      }
    }

    // Statistiques globales SLA
    const totalActive = await db.task.count({
      where: { status: { notIn: ['termine', 'annule'] } },
    })
    const totalBreached = await db.task.count({ where: { slaBreached: true } })
    const totalCompleted = await db.task.count({ where: { status: 'termine' } })

    // Tâches terminées : compter celles achevées avant le SLA deadline (en mémoire)
    const completedTasks = await db.task.findMany({
      where: {
        status: 'termine',
        completedAt: { not: null },
        slaDeadline: { not: null },
      },
      select: { completedAt: true, slaDeadline: true },
    })
    const completedOnTime = completedTasks.filter(
      (t) => t.completedAt && t.slaDeadline && t.completedAt <= t.slaDeadline
    ).length

    return NextResponse.json({
      summary: {
        totalActive,
        totalBreached,
        totalCompleted,
        completedOnTime,
        breachRate: totalActive > 0 ? Math.round((totalBreached / totalActive) * 100) : 0,
        complianceRate: totalCompleted > 0 ? Math.round((completedOnTime / totalCompleted) * 100) : 100,
      },
      breachedTasks,
      approachingTasks,
      statsByFamily: familyStats.map((fs) => ({
        family: fs.family,
        total: fs._count.id,
        responseTime: responseTimes[fs.family] || { avgMinutes: 0, count: 0 },
      })),
    })
  } catch (error) {
    console.error('Erreur GET /api/admin/sla:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des données SLA' },
      { status: 500 }
    )
  }
}
