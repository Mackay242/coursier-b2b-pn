import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateInvoicePDF, type InvoiceData } from '@/lib/invoice-pdf'

// GET /api/invoices/[id]/pdf - Generer et telecharger le PDF de la facture
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorise' }, { status: 401 })
    }

    const { id } = await params

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            nif: true,
            rccm: true,
            address: true,
            email: true,
            phone: true,
          },
        },
        client: {
          select: { id: true, name: true, email: true },
        },
        deliveries: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            reference: true,
            type: true,
            pickup: true,
            dropoff: true,
            price: true,
            status: true,
            createdAt: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { erreur: 'Facture introuvable' },
        { status: 404 },
      )
    }

    // Verifier l'acces
    if (session.user.role === 'client') {
      const company = await db.company.findUnique({
        where: { userId: session.user.id },
      })
      if (
        company &&
        invoice.companyId !== company.id &&
        invoice.clientId !== session.user.id
      ) {
        return NextResponse.json(
          { erreur: 'Acces non autorise' },
          { status: 403 },
        )
      }
    }

    // Construire les donnees pour le PDF
    const invoiceData: InvoiceData = {
      reference: invoice.reference,
      periode: invoice.period,
      dateEmission: invoice.createdAt.toISOString(),
      entreprise: invoice.company
        ? {
            name: invoice.company.name,
            nif: invoice.company.nif,
            rccm: invoice.company.rccm,
            address: invoice.company.address,
            email: invoice.company.email,
            phone: invoice.company.phone,
          }
        : null,
      livraisons: invoice.deliveries.map((d) => ({
        reference: d.reference,
        type: d.type,
        pickup: d.pickup,
        dropoff: d.dropoff,
        price: d.price,
        createdAt: d.createdAt.toISOString(),
      })),
    }

    // Generer le PDF
    const pdfBytes = await generateInvoicePDF(invoiceData)

    const filename = `${invoice.reference}.pdf`

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBytes.byteLength),
      },
    })
  } catch (error) {
    console.error('Erreur GET /api/invoices/[id]/pdf:', error)
    return NextResponse.json(
      { erreur: "Erreur serveur lors de la generation du PDF" },
      { status: 500 },
    )
  }
}
