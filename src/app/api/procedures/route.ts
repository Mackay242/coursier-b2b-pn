import { NextResponse } from 'next/server'
import { db } from '@/lib/db'


// GET /api/procedures — liste des procédures (optionnellement filtrées par serviceFamily)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const family = searchParams.get('family')

    let query = 'SELECT * FROM "Procedure" WHERE "isActive" = true '
    const params: any[] = []
    if (family) {
      params.push(family)
      query += `AND "serviceFamily" = $1 `
    }
    query += 'ORDER BY "serviceFamily", "order" ASC'

    const procedures = await db.$queryRawUnsafe(query, ...params)
    return NextResponse.json({ procedures })
  } catch (error) {
    console.error('Erreur GET /api/procedures:', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
