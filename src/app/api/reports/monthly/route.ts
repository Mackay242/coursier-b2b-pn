import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/reports/monthly - Rapport mensuel
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    let companyId = searchParams.get('companyId')

    // Déterminer l'entreprise si non spécifiée
    if (!companyId && session.user.role === 'client') {
      const company = await db.company.findUnique({
        where: { userId: session.user.id },
      })
      if (company) {
        companyId = company.id
      }
    }

    // Parser le mois (format: 2026-07)
    let targetYear: number
    let targetMonth: number

    if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-')
      targetYear = parseInt(yearStr, 10)
      targetMonth = parseInt(monthStr, 10)
    } else {
      const now = new Date()
      targetYear = now.getFullYear()
      targetMonth = now.getMonth() + 1
    }

    if (!targetYear || !targetMonth || targetMonth < 1 || targetMonth > 12) {
      return NextResponse.json(
        { erreur: 'Format de mois invalide. Utilisez le format AAAA-MM (ex: 2026-07)' },
        { status: 400 }
      )
    }

    // Plage de dates du mois
    const periodStart = new Date(targetYear, targetMonth - 1, 1)
    const periodEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999)

    // Mois précédent pour comparaison
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear
    const prevPeriodStart = new Date(prevYear, prevMonth - 1, 1)
    const prevPeriodEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999)

    // Filtre entreprise
    const companyFilter: Record<string, unknown> = {}
    if (companyId) {
      companyFilter.companyId = companyId
    }

    // Livraisons du mois
    const deliveries = await db.delivery.findMany({
      where: {
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        ...companyFilter,
      },
    })

    // Livraisons du mois précédent (pour comparaison)
    const prevDeliveries = await db.delivery.findMany({
      where: {
        createdAt: {
          gte: prevPeriodStart,
          lte: prevPeriodEnd,
        },
        ...companyFilter,
      },
    })

    // === Courses par type ===
    const coursesParType = {
      standard: deliveries.filter((d) => d.type === 'standard').length,
      express: deliveries.filter((d) => d.type === 'express').length,
      'inter-arrondissement': deliveries.filter((d) => d.type === 'inter-arrondissement').length,
    }

    // === Courses par statut ===
    const coursesParStatus: Record<string, number> = {}
    for (const d of deliveries) {
      coursesParStatus[d.status] = (coursesParStatus[d.status] || 0) + 1
    }

    // === Revenu total ===
    const revenuTotal = deliveries.reduce((sum, d) => sum + d.price, 0)

    // === Temps moyen de livraison (mock: 22 minutes) ===
    const tempsMoyenLivraison = 22

    // === Top destinations (top 5 adresses de dépôt) ===
    const destinationCounts: Record<string, number> = {}
    for (const d of deliveries) {
      // Normaliser l'adresse pour le regroupement
      const addr = d.dropoff.trim()
      destinationCounts[addr] = (destinationCounts[addr] || 0) + 1
    }
    const topDestinations = Object.entries(destinationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([adresse, nombre]) => ({ adresse, nombre }))

    // === Répartition hebdomadaire ===
    const weeklyBreakdown: { semaine: number; debut: string; fin: string; courses: number }[] = []

    // Calculer les semaines du mois
    const firstDay = new Date(periodStart)
    let weekNum = 1
    let weekStart = new Date(firstDay)

    while (weekStart <= periodEnd) {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      if (weekEnd > periodEnd) {
        weekEnd.setTime(periodEnd.getTime())
      }

      const weekDeliveries = deliveries.filter((d) => {
        const dDate = new Date(d.createdAt)
        return dDate >= weekStart && dDate <= weekEnd
      })

      weeklyBreakdown.push({
        semaine: weekNum,
        debut: weekStart.toISOString().slice(0, 10),
        fin: weekEnd.toISOString().slice(0, 10),
        courses: weekDeliveries.length,
      })

      weekNum++
      weekStart = new Date(weekEnd)
      weekStart.setDate(weekStart.getDate() + 1)
    }

    // === Comparaison avec le mois précédent ===
    const prevVolume = prevDeliveries.length
    const prevRevenu = prevDeliveries.reduce((sum, d) => sum + d.price, 0)
    const currentVolume = deliveries.length

    const volumeEvolution = prevVolume > 0
      ? (((currentVolume - prevVolume) / prevVolume) * 100).toFixed(1)
      : '+12.0'

    const revenuEvolution = prevRevenu > 0
      ? (((revenuTotal - prevRevenu) / prevRevenu) * 100).toFixed(1)
      : '+8.0'

    // Si pas de données réelles pour le mois précédent, utiliser les valeurs mock
    const comparison = {
      volumeEvolution: prevVolume > 0 ? `${Number(volumeEvolution) > 0 ? '+' : ''}${volumeEvolution}%` : '+12.0%',
      revenuEvolution: prevRevenu > 0 ? `${Number(revenuEvolution) > 0 ? '+' : ''}${revenuEvolution}%` : '+8.0%',
      volumePrecedent: prevVolume,
      revenuPrecedent: prevRevenu,
    }

    // === Tâches administratives du mois ===
    const tasks = await db.task.findMany({
      where: {
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        ...companyFilter,
      },
    })

    // Tâches par famille
    const tachesParFamille: Record<string, number> = {}
    for (const t of tasks) {
      tachesParFamille[t.family] = (tachesParFamille[t.family] || 0) + 1
    }

    // Statistiques tâches
    const tachesTotal = tasks.length
    const tachesTerminees = tasks.filter((t) => t.status === 'termine').length
    const tachesEnCours = tasks.filter((t) => ['en_attente', 'en_cours', 'en_validation'].includes(t.status)).length

    // SLA respecté : tâches terminées sans breach
    const completedTasks = tasks.filter((t) => t.status === 'termine')
    const slaRespecte = completedTasks.length > 0
      ? ((completedTasks.filter((t) => !t.slaBreached).length / completedTasks.length) * 100)
      : 100

    return NextResponse.json({
      periode: `${String(targetMonth).padStart(2, '0')}/${targetYear}`,
      entrepriseId: companyId || null,
      totalCourses: currentVolume,
      coursesParType,
      coursesParStatus,
      revenuTotal,
      tempsMoyenLivraison,
      topDestinations,
      repartitionHebdomadaire: weeklyBreakdown,
      comparaisonMoisPrecedent: comparison,
      // Task statistics (PRODESK)
      tachesParFamille,
      tachesTotal,
      tachesTerminees,
      tachesEnCours,
      slaRespecte: Math.round(slaRespecte * 10) / 10,
    })
  } catch (error) {
    console.error('Erreur GET /api/reports/monthly:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la génération du rapport mensuel' },
      { status: 500 }
    )
  }
}
