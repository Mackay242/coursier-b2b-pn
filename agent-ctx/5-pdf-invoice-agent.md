Task ID: 5
Agent: PDF Invoice Agent
Task: Créer un système de génération de factures PDF professionnelles

Work Log:
- Installé @react-pdf/renderer v4.5.1
- Créé src/lib/invoice-pdf.tsx : composant InvoiceDocument + generateInvoicePDF()
- Mis à jour src/app/api/invoices/[id]/pdf/route.ts pour retourner le PDF binaire
- Lint passé sans erreur

Fichiers modifiés/créés:
- src/lib/invoice-pdf.tsx (nouveau)
- src/app/api/invoices/[id]/pdf/route.ts (réécrit)
- worklog.md (mis à jour)
- package.json (dépendance ajoutée)