import { NextResponse } from 'next/server'
import { db } from '@/lib/db'


// GET /api/partners — liste des partenaires avec liaisons services
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const serviceSlug = searchParams.get('service')

    const partners = await db.$queryRawUnsafe(`
      SELECT p.*, sp."linkType", sp."description" as linkDescription, s."name" as serviceName, s."slug" as serviceSlug
      FROM "Partner" p
      LEFT JOIN "ServicePartner" sp ON sp."partnerId" = p."id"
      LEFT JOIN "Service" s ON s."id" = sp."serviceId"
      WHERE p."isActive" = true
      ${serviceSlug ? 'AND s."slug" = $1' : ''}
      ORDER BY p."type", p."name" ASC
    `, ...(serviceSlug ? [serviceSlug] : []))

    return NextResponse.json({ partners })
  } catch (error) {
    console.error('Erreur GET /api/partners:', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
