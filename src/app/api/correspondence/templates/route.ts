import { NextResponse } from 'next/server'
import { db } from '@/lib/db'


// GET /api/correspondence/templates — modèles de correspondance
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const family = searchParams.get('family')
    const category = searchParams.get('category')

    let query = `SELECT * FROM "CorrespondenceTemplate" WHERE "isActive" = true`
    const params: any[] = []
    let paramIndex = 1

    if (family) {
      query += ` AND "serviceFamily" = $${paramIndex}`
      params.push(family)
      paramIndex++
    }
    if (category) {
      query += ` AND "category" = $${paramIndex}`
      params.push(category)
      paramIndex++
    }
    query += ` ORDER BY "serviceFamily", "title" ASC`

    const templates = await db.$queryRawUnsafe(query, ...params)
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Erreur GET /api/correspondence/templates:', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
