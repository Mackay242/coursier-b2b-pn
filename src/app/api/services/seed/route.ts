import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const PRODESK_SERVICES = [
  {
    name: 'Bureau Digital',
    slug: 'bureau_digital',
    family: 'digital_office',
    description: 'Services de numérisation, dématérialisation et gestion bureautique digitale pour votre entreprise.',
    priceUnit: 5000,
    isRecurring: false,
    slaHours: 4,
    slaUrgentHours: 1,
    icon: 'monitor',
    order: 1,
  },
  {
    name: 'CNSS / Social',
    slug: 'cnss_social',
    family: 'cnss_social',
    description: 'Déclarations sociales CNSS, affiliation employés, suivi des cotisations et conformité sociale.',
    priceUnit: 7500,
    isRecurring: false,
    slaHours: 4,
    slaUrgentHours: 1,
    icon: 'shield',
    order: 2,
  },
  {
    name: 'Fiscalité',
    slug: 'fiscalite',
    family: 'fiscalite',
    description: 'Déclarations fiscales, télédéclarations, conseil fiscal et mise en conformité avec la DGI.',
    priceUnit: 10000,
    isRecurring: false,
    slaHours: 4,
    slaUrgentHours: 1,
    icon: 'calculator',
    order: 3,
  },
  {
    name: 'SFEC',
    slug: 'sfec',
    family: 'sfec',
    description: 'Statistiques fiscales des entreprises - télédéclaration mensuelle SFEC auprès de la DGE.',
    priceUnit: 15000,
    isRecurring: true,
    slaHours: 24,
    slaUrgentHours: 4,
    icon: 'receipt',
    order: 4,
  },
  {
    name: 'Gestion Documentaire',
    slug: 'gestion_documentaire',
    family: 'documentaire',
    description: 'Classement, archivage, récupération de documents administratifs et légaux.',
    priceUnit: 2500,
    isRecurring: false,
    slaHours: 4,
    slaUrgentHours: 1,
    icon: 'folder',
    order: 5,
  },
  {
    name: 'Secrétariat / Back-office',
    slug: 'secretariat',
    family: 'secretariat',
    description: 'Assistance administrative, secrétariat externalisé, saisie de données et back-office.',
    priceUnit: 5000,
    isRecurring: false,
    slaHours: 4,
    slaUrgentHours: 1,
    icon: 'briefcase',
    order: 6,
  },
]

// POST /api/services/seed - Semer les services PRODESK (admin uniquement, idempotent via upsert)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ erreur: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const created: string[] = []
    const updated: string[] = []

    for (const serviceData of PRODESK_SERVICES) {
      const { slug, ...updateData } = serviceData

      const result = await db.service.upsert({
        where: { slug },
        update: updateData,
        create: { slug, ...updateData },
      })

      // Determine if it was a create or update based on createdAt vs updatedAt
      // Since upsert doesn't tell us directly, we track by checking result
      created.push(slug)
    }

    return NextResponse.json({
      message: 'Services PRODESK traités avec succès (upsert idempotent)',
      services: created,
      total: PRODESK_SERVICES.length,
    })
  } catch (error) {
    console.error('Erreur POST /api/services/seed:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors du semis des services' },
      { status: 500 }
    )
  }
}
