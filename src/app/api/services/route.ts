import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/services - Catalogue des services actifs
export async function GET() {
  try {
    const services = await db.service.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    })

    return NextResponse.json({
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        family: s.family,
        description: s.description,
        priceUnit: s.priceUnit,
        isRecurring: s.isRecurring,
        slaHours: s.slaHours,
        slaUrgentHours: s.slaUrgentHours,
        icon: s.icon,
        order: s.order,
        taskCount: s._count.tasks,
      })),
    })
  } catch (error) {
    console.error('Erreur GET /api/services:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des services' },
      { status: 500 }
    )
  }
}
