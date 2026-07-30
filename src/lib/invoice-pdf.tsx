import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'

// ── Types ──────────────────────────────────────────────────────────

export interface InvoiceDelivery {
  reference: string
  type: string
  pickup: string
  dropoff: string
  price: number
  createdAt: string | Date
}

export interface InvoiceCompany {
  name: string
  nif?: string | null
  rccm?: string | null
  address?: string | null
  email?: string | null
  phone?: string | null
}

export interface InvoiceData {
  reference: string
  periode: string
  dateEmission: string | Date
  entreprise: InvoiceCompany | null
  livraisons: InvoiceDelivery[]
}

// ── Helpers ────────────────────────────────────────────────────────

const TVA_RATE = 0.189

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function deliveryTypeLabel(type: string): string {
  switch (type) {
    case 'standard':
      return 'Standard'
    case 'express':
      return 'Express'
    case 'inter-arrondissement':
      return 'Inter-arrond.'
    default:
      return type
  }
}

function deliveryDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    paddingTop: 30,
    paddingBottom: 50,
    color: '#1a1a1a',
    lineHeight: 1.4,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerLeft: {
    flex: 1,
  },
  companyName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#0f766e',
    marginBottom: 2,
  },
  companyAddress: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 1,
  },
  companyInfo: {
    fontSize: 8,
    color: '#6b7280',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  invoiceMeta: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 2,
  },
  invoiceMetaBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
  },

  // Separator
  separator: {
    borderBottomWidth: 2,
    borderBottomColor: '#0f766e',
    marginVertical: 12,
  },
  thinSeparator: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#d1d5db',
    marginVertical: 6,
  },

  // Client block
  clientBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clientSection: {
    width: '55%',
  },
  emitterSection: {
    width: '40%',
    alignItems: 'flex-end',
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    marginBottom: 3,
    letterSpacing: 1,
  },
  clientName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  clientInfo: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 1,
  },

  // Table
  tableContainer: {
    marginTop: 10,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f766e',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 8,
    color: '#374151',
  },
  tableCellBold: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
  },
  tableCellRight: {
    fontSize: 8,
    color: '#374151',
    textAlign: 'right' as const,
  },

  // Col widths (out of ~100%)
  colRef: { width: '14%' },
  colDate: { width: '13%' },
  colType: { width: '14%' },
  colPickup: { width: '21%' },
  colDropoff: { width: '21%' },
  colPrice: { width: '17%', textAlign: 'right' as const },

  // Totals
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    marginBottom: 10,
  },
  totalsBox: {
    width: '55%',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    overflow: 'hidden',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  totalsRowBorder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: 0.5,
    borderTopColor: '#d1d5db',
  },
  totalsRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#0f766e',
  },
  totalsLabel: {
    fontSize: 9,
    color: '#374151',
  },
  totalsValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
  },
  totalsLabelFinal: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  totalsValueFinal: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
  },
  footerSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: '#0f766e',
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  footerText: {
    fontSize: 7,
    color: '#6b7280',
  },
  footerBold: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
  },
  footerConform: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0f766e',
    textAlign: 'center' as const,
    marginTop: 8,
    marginBottom: 2,
  },
  footerPageNum: {
    fontSize: 7,
    color: '#9ca3af',
    textAlign: 'center' as const,
  },
})

// ── PDF Component ──────────────────────────────────────────────────

function InvoiceDocument({ data }: { data: InvoiceData }) {
  const livraisons = data.livraisons
  const sousTotal = livraisons.reduce((s, d) => s + d.price, 0)
  const montantTVA = Math.round(sousTotal * TVA_RATE)
  const totalTTC = sousTotal + montantTVA

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>CoursierB2B</Text>
            <Text style={styles.companyAddress}>Pointe-Noire, Republique du Congo</Text>
            <Text style={styles.companyInfo}>
              Tel : +242 06 500 0000 | Email : contact@coursierb2b.cg
            </Text>
            <Text style={styles.companyInfo}>
              RCCM : RCCM-PN-2026-B001 | NIF : NIF-2026-001A
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>FACTURE</Text>
            <View>
              <Text style={styles.invoiceMetaBold}>Reference :</Text>
              <Text style={styles.invoiceMeta}>{'  '}{data.reference}</Text>
            </View>
            <View>
              <Text style={styles.invoiceMetaBold}>Periode :</Text>
              <Text style={styles.invoiceMeta}>{'  '}{data.periode}</Text>
            </View>
            <View>
              <Text style={styles.invoiceMetaBold}>Date d'emission :</Text>
              <Text style={styles.invoiceMeta}>{'  '}{formatDate(data.dateEmission)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.separator} />

        {/* ── CLIENT / EMETTEUR ── */}
        <View style={styles.clientBlock}>
          <View style={styles.clientSection}>
            <Text style={styles.sectionTitle}>Client</Text>
            <Text style={styles.clientName}>
              {data.entreprise?.name ?? '—'}
            </Text>
            {data.entreprise?.address && (
              <Text style={styles.clientInfo}>{data.entreprise.address}</Text>
            )}
            {data.entreprise?.nif && (
              <Text style={styles.clientInfo}>NIF : {data.entreprise.nif}</Text>
            )}
            {data.entreprise?.rccm && (
              <Text style={styles.clientInfo}>RCCM : {data.entreprise.rccm}</Text>
            )}
            {data.entreprise?.email && (
              <Text style={styles.clientInfo}>{data.entreprise.email}</Text>
            )}
          </View>
          <View style={styles.emitterSection}>
            <Text style={styles.sectionTitle}>Emetteur</Text>
            <Text style={styles.clientInfo}>CoursierB2B</Text>
            <Text style={styles.clientInfo}>Pointe-Noire, Congo</Text>
            <Text style={styles.clientInfo}>RCCM : RCCM-PN-2026-B001</Text>
            <Text style={styles.clientInfo}>NIF : NIF-2026-001A</Text>
          </View>
        </View>

        {/* ── TABLE ── */}
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colRef]}>Ref.</Text>
            <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
            <Text style={[styles.tableHeaderCell, styles.colType]}>Type</Text>
            <Text style={[styles.tableHeaderCell, styles.colPickup]}>Depart</Text>
            <Text style={[styles.tableHeaderCell, styles.colDropoff]}>Arrivee</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Montant</Text>
          </View>

          {livraisons.map((livraison, idx) => (
            <View
              key={livraison.reference}
              style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
            >
              <Text style={[styles.tableCellBold, styles.colRef]}>
                {livraison.reference}
              </Text>
              <Text style={[styles.tableCell, styles.colDate]}>
                {deliveryDate(livraison.createdAt)}
              </Text>
              <Text style={[styles.tableCell, styles.colType]}>
                {deliveryTypeLabel(livraison.type)}
              </Text>
              <Text style={[styles.tableCell, styles.colPickup]}>
                {livraison.pickup.length > 28
                  ? livraison.pickup.substring(0, 26) + '...'
                  : livraison.pickup}
              </Text>
              <Text style={[styles.tableCell, styles.colDropoff]}>
                {livraison.dropoff.length > 28
                  ? livraison.dropoff.substring(0, 26) + '...'
                  : livraison.dropoff}
              </Text>
              <Text style={[styles.tableCellRight, styles.colPrice]}>
                {formatFCFA(livraison.price)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── TOTALS ── */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Sous-total HT ({livraisons.length} course{livraisons.length > 1 ? 's' : ''})
              </Text>
              <Text style={styles.totalsValue}>{formatFCFA(sousTotal)}</Text>
            </View>
            <View style={styles.totalsRowBorder}>
              <Text style={styles.totalsLabel}>TVA (18,9%)</Text>
              <Text style={styles.totalsValue}>{formatFCFA(montantTVA)}</Text>
            </View>
            <View style={styles.totalsRowFinal}>
              <Text style={styles.totalsLabelFinal}>Total TTC</Text>
              <Text style={styles.totalsValueFinal}>{formatFCFA(totalTTC)}</Text>
            </View>
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={styles.footer} fixed>
          <View style={styles.footerSeparator} />
          <View style={styles.footerRow}>
            <Text style={styles.footerBold}>
              Conditions de reglement : Reglement sous 30 jours
            </Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              Airtel Money : +242 06 000 0000 | Moov Money : +242 06 000 0001
            </Text>
          </View>
          <Text style={styles.footerConform}>
            Facture conforme TVA - Deductible fiscalement
          </Text>
          <Text
            style={styles.footerPageNum}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

// ── Public API ─────────────────────────────────────────────────────

export async function generateInvoicePDF(
  invoiceData: InvoiceData,
): Promise<Uint8Array> {
  const blob = await pdf(<InvoiceDocument data={invoiceData} />).toBlob()
  return new Uint8Array(await blob.arrayBuffer())
}
