import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'


// GET /api/correspondence — liste des correspondances générées
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const offset = (page - 1) * limit

    let whereClause = ''
    const params: any[] = []
    let paramIndex = 1

    if (session.user.role !== 'admin') {
      whereClause += `AND (c."clientId" = $${paramIndex} `,
      params.push(session.user.id),
      paramIndex++
      whereClause += `OR c."companyId" IN (SELECT "id" FROM "Company" WHERE "userId" = $${paramIndex})) `
      params.push(session.user.id),
      paramIndex++
    }
    if (companyId) {
      whereClause += `AND c."companyId" = $${paramIndex} `
      params.push(companyId),
      paramIndex++
    }
    if (status) {
      whereClause += `AND c."status" = $${paramIndex} `
      params.push(status),
      paramIndex++
    }
    if (category) {
      whereClause += `AND c."category" = $${paramIndex} `
      params.push(category),
      paramIndex++
    }

    const [rows, countResult] = await Promise.all([
      db.$queryRawUnsafe(`
        SELECT c.*, ct."title" as templateTitle, p."name" as partnerName,
          comp."name" as companyName, comp."nif" as companyNif, comp."rccm" as companyRccm
        FROM "Correspondence" c
        LEFT JOIN "CorrespondenceTemplate" ct ON ct."id" = c."templateId"
        LEFT JOIN "Partner" p ON p."id" = c."partnerId"
        LEFT JOIN "Company" comp ON comp."id" = c."companyId"
        WHERE 1=1 ${whereClause}
        ORDER BY c."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `, ...params),
      db.$queryRawUnsafe(`
        SELECT COUNT(*)::int as total FROM "Correspondence" c WHERE 1=1 ${whereClause}
      `, ...params),
    ])

    const total = (countResult as any[])[0]?.total || 0

    return NextResponse.json({ correspondences: rows, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Erreur GET /api/correspondence:', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}


// POST /api/correspondence — générer une correspondance à partir d'un modèle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { templateId, companyId, partnerId, taskId, variables, category, subject, bodyText, status = 'brouillon' } = body

    if (!subject) {
      return NextResponse.json({ erreur: 'L\'objet du courrier est obligatoire' }, { status: 400 })
    }

    let finalBody = bodyText || ''

    // Si templateId fourni, substituer les variables
    if (templateId) {
      const template = await db.$queryRawUnsafe(`
        SELECT * FROM "CorrespondenceTemplate" WHERE "id" = $1
      `, templateId) as any[]

      if (template && template.length > 0) {
        finalBody = template[0].body
        // Substituer les variables {{variable}}
        if (variables && typeof variables === 'object') {
          Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
            finalBody = finalBody.replace(regex, String(value || `{{${key}}}`))
          })
        }
        // Si pas de subject fourni, utiliser le sujet du template
        if (!body.subject) {
          let tplSubject = template[0].subject
          if (variables && typeof variables === 'object') {
            Object.entries(variables).forEach(([key, value]) => {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
              tplSubject = tplSubject.replace(regex, String(value || ''))
            })
          }
        }
      }
    }

    // Générer la référence
    const now = new Date()
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0')

    const countResult = await db.$queryRawUnsafe(`
      SELECT COUNT(*)::int as todayCount FROM "Correspondence"
      WHERE "reference" LIKE 'COR-${dateStr}-%'
    `) as any[]
    const seq = (countResult[0]?.todayCount || 0) + 1
    const reference = `COR-${dateStr}-${String(seq).padStart(3, '0')}`

    const correspondence = await db.$queryRawUnsafe(`
      INSERT INTO "Correspondence" ("id", "reference", "templateId", "taskId", "companyId", "clientId", "partnerId", "category", "subject", "body", "status", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `, reference, templateId || null, taskId || null, companyId || null, session.user.id, partnerId || null,
      category || 'courrier_sortant', subject, finalBody, status) as any[]

    return NextResponse.json({ correspondence: correspondence[0] }, { status: 201 })
  } catch (error) {
    console.error('Erreur POST /api/correspondence:', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
