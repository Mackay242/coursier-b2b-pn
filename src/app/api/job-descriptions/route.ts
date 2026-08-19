import { NextResponse } from 'next/server'
import { db } from '@/lib/db'


// GET /api/job-descriptions — fiches de poste (optionnel par serviceFamily)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const family = searchParams.get('family')

    let query = 'SELECT * FROM "JobDescription" WHERE "isActive" = true '
    const params: any[] = []
    if (family) {
      params.push(family)
      query += 'AND "serviceFamily" = $1 '
    }
    query += 'ORDER BY "serviceFamily" ASC'

    const jobDescriptions = await db.$queryRawUnsafe(query, ...params)
    return NextResponse.json({ jobDescriptions })
  } catch (error) {
    console.error('Erreur GET /api/job-descriptions:', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
