import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clean existing data
  await prisma.timeline.deleteMany()
  await prisma.delivery.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.company.deleteMany()
  await prisma.livreur.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await hash('demo1234', 12)

  // ============================================================
  // USERS (5 total: 1 admin, 3 clients, 1 livreur)
  // ============================================================
  const adminUser = await prisma.user.create({
    data: {
      email: 'bgfi@bank.cg',
      password: passwordHash,
      name: 'Admin BGFI',
      role: 'admin',
      phone: '+242 06 600 0001',
    },
  })

  const totalUser = await prisma.user.create({
    data: {
      email: 'total@energy.cg',
      password: passwordHash,
      name: 'Responsable TotalEnergies',
      role: 'client',
      phone: '+242 06 600 0002',
    },
  })

  const livreurUser = await prisma.user.create({
    data: {
      email: 'livreur1@coursier.cg',
      password: passwordHash,
      name: 'Mouamba Patrick',
      role: 'livreur',
      phone: '+242 06 600 0003',
    },
  })

  // Extra client users for other companies (Company.userId is unique)
  const ecobankUser = await prisma.user.create({
    data: {
      email: 'ecobank@bank.cg',
      password: passwordHash,
      name: 'Responsable Ecobank',
      role: 'client',
      phone: '+242 06 600 0004',
    },
  })

  const okombiUser = await prisma.user.create({
    data: {
      email: 'okombi@avocats.cg',
      password: passwordHash,
      name: 'Me Okombi',
      role: 'client',
      phone: '+242 06 600 0005',
    },
  })

  console.log('✅ 5 users created')

  // ============================================================
  // COMPANIES (each linked to a unique user)
  // ============================================================
  const bgfiCompany = await prisma.company.create({
    data: {
      name: 'BGFI Bank Congo',
      nif: 'NIF-2024-001-BGF',
      rccm: 'RCCM-BZ-2024-A-0001',
      address: 'Avenue Amilcar Cabral, Centre-ville, Pointe-Noire',
      sector: 'Banque & Finance',
      email: 'contact@bgfi-bank.cg',
      phone: '+242 06 610 0000',
      plan: 'business',
      planLimit: 30,
      userId: adminUser.id,
    },
  })

  const totalCompany = await prisma.company.create({
    data: {
      name: 'TotalEnergies E&P Congo',
      nif: 'NIF-2024-002-TOT',
      rccm: 'RCCM-BZ-2024-A-0002',
      address: 'Boulevard Denis Sassou Nguesso, Pointe-Noire',
      sector: 'Pétrole & Énergie',
      email: 'direction@totalenergies.cg',
      phone: '+242 06 620 0000',
      plan: 'premium',
      planLimit: 60,
      userId: totalUser.id,
    },
  })

  const ecobankCompany = await prisma.company.create({
    data: {
      name: 'Ecobank Congo',
      nif: 'NIF-2024-003-ECO',
      rccm: 'RCCM-BZ-2024-A-0003',
      address: 'Avenue de la Paix, Mongo Poko, Pointe-Noire',
      sector: 'Banque & Finance',
      email: 'pointenoire@ecobank.com',
      phone: '+242 06 630 0000',
      plan: 'business',
      planLimit: 30,
      userId: ecobankUser.id,
    },
  })

  const okombiCompany = await prisma.company.create({
    data: {
      name: 'Cabinet Okombi & Associés',
      nif: 'NIF-2024-004-OKB',
      rccm: 'RCCM-BZ-2024-A-0004',
      address: 'Rue du Commerce, Centre-ville, Pointe-Noire',
      sector: 'Juridique & Conseil',
      email: 'contact@okombi-avocats.cg',
      phone: '+242 06 640 0000',
      plan: 'decouverte',
      planLimit: 10,
      userId: okombiUser.id,
    },
  })

  console.log('✅ 4 companies created')

  // ============================================================
  // LIVREURS
  // ============================================================
  const livreur1 = await prisma.livreur.create({
    data: {
      name: 'Mouamba Patrick',
      phone: '+242 06 700 0001',
      vehicle: 'Moto Honda CG 125',
      zone: 'Centre-ville',
      rating: 4.8,
      status: 'en_course',
      coursesDone: 142,
    },
  })

  const livreur2 = await prisma.livreur.create({
    data: {
      name: "N'Goma Jean",
      phone: '+242 06 700 0002',
      vehicle: 'Moto Yamaha DT 125',
      zone: 'Mongo Poko',
      rating: 4.6,
      status: 'disponible',
      coursesDone: 98,
    },
  })

  const livreur3 = await prisma.livreur.create({
    data: {
      name: 'Tchikoula Raoul',
      phone: '+242 06 700 0003',
      vehicle: 'Moto Suzuki GN 125',
      zone: 'Tchimbamba',
      rating: 4.9,
      status: 'en_course',
      coursesDone: 215,
    },
  })

  const livreur4 = await prisma.livreur.create({
    data: {
      name: 'Makosso Brice',
      phone: '+242 06 700 0004',
      vehicle: 'Moto Bajaj Pulsar',
      zone: 'Loandjili',
      rating: 4.3,
      status: 'disponible',
      coursesDone: 67,
    },
  })

  const livreur5 = await prisma.livreur.create({
    data: {
      name: 'Loemba Fabrice',
      phone: '+242 06 700 0005',
      vehicle: 'Moto Kawasaki KLX',
      zone: 'Mvoulou',
      rating: 4.7,
      status: 'pause',
      coursesDone: 183,
    },
  })

  console.log('✅ 5 livreurs created')

  // ============================================================
  // DELIVERIES
  // ============================================================

  const now = new Date()
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000)
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000)
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000)

  // Delivery 1: en_attente (waiting)
  const delivery1 = await prisma.delivery.create({
    data: {
      reference: 'CMD-2024-0001',
      type: 'standard',
      status: 'en_attente',
      priority: 'normale',
      pickup: 'BGFI Bank Congo, Avenue Amilcar Cabral, Centre-ville',
      dropoff: 'Ministère des Finances, Boulevard Denis Sassou Nguesso',
      recipientName: 'M. Nkoukou Albert',
      recipientPhone: '+242 06 550 0001',
      description: 'Dossier de crédit à remettre en urgence',
      instructions: 'Demander M. Nkoukou au 3ème étage, bureau 312',
      paymentMode: 'forfait',
      price: 2500,
      clientId: adminUser.id,
      companyId: bgfiCompany.id,
      createdAt: hoursAgo(1),
    },
  })

  // Delivery 2: prise_en_charge (picked up)
  const delivery2 = await prisma.delivery.create({
    data: {
      reference: 'CMD-2024-0002',
      type: 'express',
      status: 'prise_en_charge',
      priority: 'haute',
      pickup: 'TotalEnergies E&P, Boulevard Denis Sassou Nguesso',
      dropoff: 'Aéroport international Agostinho-Neto, Pointe-Noire',
      recipientName: 'Mme. Koumba Marie',
      recipientPhone: '+242 06 550 0002',
      description: 'Passport pour vol international de 14h30',
      instructions: 'Remettre au comptoir Air France, présentation du passeport requise',
      paymentMode: 'forfait',
      price: 5000,
      clientId: totalUser.id,
      companyId: totalCompany.id,
      livreurId: livreur1.id,
      createdAt: hoursAgo(2),
    },
  })

  // Delivery 3: en_course (in transit)
  const delivery3 = await prisma.delivery.create({
    data: {
      reference: 'CMD-2024-0003',
      type: 'inter-arrondissement',
      status: 'en_course',
      priority: 'urgente',
      pickup: 'Ecobank Congo, Avenue de la Paix, Mongo Poko',
      dropoff: 'Port Autonome de Pointe-Noire',
      recipientName: 'M. Massamba Dieudonné',
      recipientPhone: '+242 06 550 0003',
      description: 'Documents douaniers originaux pour dédouanement conteneur',
      instructions: 'Appeler le destinataire 10 min avant arrivée',
      paymentMode: 'mobile_money',
      price: 7500,
      clientId: ecobankUser.id,
      companyId: ecobankCompany.id,
      livreurId: livreur3.id,
      createdAt: hoursAgo(3),
    },
  })

  // Delivery 4: livre (delivered)
  const delivery4 = await prisma.delivery.create({
    data: {
      reference: 'CMD-2024-0004',
      type: 'standard',
      status: 'livre',
      priority: 'normale',
      pickup: 'Cabinet Okombi & Associés, Rue du Commerce',
      dropoff: 'Tribunal de Grande Instance, Centre-ville',
      recipientName: 'Greffier en chef',
      recipientPhone: '+242 06 550 0004',
      description: 'Conclusions récapitulatives - affaire N° 2024/CV/0456',
      instructions: 'Déposer au greffe civil, 1er étage',
      paymentMode: 'forfait',
      price: 2500,
      clientId: okombiUser.id,
      companyId: okombiCompany.id,
      livreurId: livreur2.id,
      createdAt: daysAgo(1),
    },
  })

  // Delivery 5: livre (delivered)
  const delivery5 = await prisma.delivery.create({
    data: {
      reference: 'CMD-2024-0005',
      type: 'express',
      status: 'livre',
      priority: 'haute',
      pickup: 'BGFI Bank Congo, Avenue Amilcar Cabral',
      dropoff: 'Société Générale Congo, Avenue Charles de Gaulle',
      recipientName: 'Mme. Ngoma Sylvie',
      recipientPhone: '+242 06 550 0005',
      description: 'Chèque de virement interbancaire - montant classifié',
      instructions: "Remettre contre signature et pièce d'identité",
      paymentMode: 'forfait',
      price: 5000,
      clientId: adminUser.id,
      companyId: bgfiCompany.id,
      livreurId: livreur5.id,
      createdAt: daysAgo(2),
    },
  })

  // Delivery 6: annulee (cancelled)
  const delivery6 = await prisma.delivery.create({
    data: {
      reference: 'CMD-2024-0006',
      type: 'standard',
      status: 'annulee',
      priority: 'normale',
      pickup: 'TotalEnergies E&P, Boulevard Denis Sassou Nguesso',
      dropoff: 'Hôtel Seme Beach, Route du Port',
      recipientName: 'Délegation technique',
      recipientPhone: '+242 06 550 0006',
      description: 'Plans de forage annulés - réunion déplacée à Brazzaville',
      instructions: 'Annulé par le demandeur',
      paymentMode: 'forfait',
      price: 3500,
      clientId: totalUser.id,
      companyId: totalCompany.id,
      createdAt: daysAgo(3),
    },
  })

  // Delivery 7: en_course (in transit)
  const delivery7 = await prisma.delivery.create({
    data: {
      reference: 'CMD-2024-0007',
      type: 'standard',
      status: 'en_course',
      priority: 'normale',
      pickup: 'Ecobank Congo, Avenue de la Paix, Mongo Poko',
      dropoff: "Centrale d'achat Total, Avenue Amilcar Cabral",
      recipientName: 'M. Bakala Prosper',
      recipientPhone: '+242 06 550 0007',
      description: 'Cartes bancaires VISA pour clients entreprise',
      instructions: 'Enveloppe scellée - ne pas ouvrir',
      paymentMode: 'forfait',
      price: 2500,
      clientId: ecobankUser.id,
      companyId: ecobankCompany.id,
      livreurId: livreur3.id,
      createdAt: hoursAgo(1),
    },
  })

  // Delivery 8: en_attente (waiting)
  const delivery8 = await prisma.delivery.create({
    data: {
      reference: 'CMD-2024-0008',
      type: 'inter-arrondissement',
      status: 'en_attente',
      priority: 'haute',
      pickup: 'Cabinet Okombi & Associés, Rue du Commerce',
      dropoff: 'Zone Industrielle de Pointe-Noire',
      recipientName: 'M. Taty Fernand',
      recipientPhone: '+242 06 550 0008',
      description: 'Contrat de bail commercial à signer',
      instructions: 'Attendre la signature et ramener le double',
      paymentMode: 'virement',
      price: 7500,
      clientId: okombiUser.id,
      companyId: okombiCompany.id,
      createdAt: minutesAgo(30),
    },
  })

  console.log('✅ 8 deliveries created')

  // ============================================================
  // INVOICES
  // ============================================================

  const invoice1 = await prisma.invoice.create({
    data: {
      reference: 'FAC-2024-001',
      period: 'Janvier 2024',
      amount: 50000,
      coursesCount: 18,
      status: 'payee',
      paidDate: daysAgo(15),
      clientId: adminUser.id,
      companyId: bgfiCompany.id,
    },
  })

  const invoice2 = await prisma.invoice.create({
    data: {
      reference: 'FAC-2024-002',
      period: 'Février 2024',
      amount: 87500,
      coursesCount: 32,
      status: 'payee',
      paidDate: daysAgo(5),
      clientId: totalUser.id,
      companyId: totalCompany.id,
    },
  })

  const invoice3 = await prisma.invoice.create({
    data: {
      reference: 'FAC-2024-003',
      period: 'Mars 2024',
      amount: 32500,
      coursesCount: 12,
      status: 'en_attente',
      clientId: ecobankUser.id,
      companyId: ecobankCompany.id,
    },
  })

  const invoice4 = await prisma.invoice.create({
    data: {
      reference: 'FAC-2024-004',
      period: 'Janvier 2024',
      amount: 22500,
      coursesCount: 8,
      status: 'en_retard',
      clientId: okombiUser.id,
      companyId: okombiCompany.id,
    },
  })

  // Link deliveries to invoices
  await prisma.delivery.updateMany({
    where: { id: delivery4.id },
    data: { invoiceId: invoice1.id },
  })
  await prisma.delivery.updateMany({
    where: { id: delivery5.id },
    data: { invoiceId: invoice1.id },
  })

  console.log('✅ 4 invoices created')

  // ============================================================
  // TIMELINE EVENTS
  // ============================================================

  // Timeline for delivery 2 (prise_en_charge - express to airport)
  await prisma.timeline.createMany({
    data: [
      {
        deliveryId: delivery2.id,
        event: 'commande_creee',
        comment: "Commande express créée pour livraison à l'aéroport",
        timestamp: hoursAgo(2),
      },
      {
        deliveryId: delivery2.id,
        event: 'pris_en_charge',
        comment: 'Mouamba Patrick a pris en charge le colis',
        timestamp: hoursAgo(1.5),
      },
    ],
  })

  // Timeline for delivery 3 (en_course - to port)
  await prisma.timeline.createMany({
    data: [
      {
        deliveryId: delivery3.id,
        event: 'commande_creee',
        comment: 'Commande urgente de documents douaniers',
        timestamp: hoursAgo(3),
      },
      {
        deliveryId: delivery3.id,
        event: 'pris_en_charge',
        comment: 'Tchikoula Raoul a récupéré les documents à Ecobank',
        timestamp: hoursAgo(2.5),
      },
      {
        deliveryId: delivery3.id,
        event: 'en_livraison',
        comment: 'En route vers le Port Autonome - trafic normal sur la route du Port',
        timestamp: hoursAgo(1),
      },
    ],
  })

  // Timeline for delivery 4 (livre - court documents)
  await prisma.timeline.createMany({
    data: [
      {
        deliveryId: delivery4.id,
        event: 'commande_creee',
        comment: 'Commande standard - conclusions pour le TGI',
        timestamp: daysAgo(1),
      },
      {
        deliveryId: delivery4.id,
        event: 'pris_en_charge',
        comment: "N'Goma Jean a récupéré le dossier au cabinet",
        timestamp: daysAgo(1),
      },
      {
        deliveryId: delivery4.id,
        event: 'en_livraison',
        comment: 'Direction Tribunal de Grande Instance',
        timestamp: daysAgo(0.9),
      },
      {
        deliveryId: delivery4.id,
        event: 'livre',
        comment: 'Documents remis au greffe - signé par Mme. Mbemba',
        timestamp: daysAgo(0.8),
      },
    ],
  })

  // Timeline for delivery 5 (livre - bank cheque)
  await prisma.timeline.createMany({
    data: [
      {
        deliveryId: delivery5.id,
        event: 'commande_creee',
        comment: 'Commande express - chèque interbancaire hautement confidentiel',
        timestamp: daysAgo(2),
      },
      {
        deliveryId: delivery5.id,
        event: 'pris_en_charge',
        comment: "Loemba Fabrice a pris en charge l'enveloppe scellée",
        timestamp: daysAgo(1.9),
      },
      {
        deliveryId: delivery5.id,
        event: 'en_livraison',
        comment: 'En direction de Société Générale Congo',
        timestamp: daysAgo(1.7),
      },
      {
        deliveryId: delivery5.id,
        event: 'livre',
        comment: "Chèque remis à Mme. Ngoma Sylvie - signature et pièce d'identité vérifiées",
        timestamp: daysAgo(1.5),
      },
    ],
  })

  // Timeline for delivery 6 (annulee)
  await prisma.timeline.createMany({
    data: [
      {
        deliveryId: delivery6.id,
        event: 'commande_creee',
        comment: 'Commande pour plans de forage - Hôtel Seme Beach',
        timestamp: daysAgo(3),
      },
      {
        deliveryId: delivery6.id,
        event: 'annulee',
        comment: 'Commande annulée - réunion déplacée à Brazzaville',
        timestamp: daysAgo(2.5),
      },
    ],
  })

  // Timeline for delivery 7 (en_course - bank cards)
  await prisma.timeline.createMany({
    data: [
      {
        deliveryId: delivery7.id,
        event: 'commande_creee',
        comment: 'Cartes bancaires VISA pour clients entreprise',
        timestamp: hoursAgo(1),
      },
      {
        deliveryId: delivery7.id,
        event: 'pris_en_charge',
        comment: "Tchikoula Raoul a récupéré l'enveloppe scellée",
        timestamp: hoursAgo(0.8),
      },
      {
        deliveryId: delivery7.id,
        event: 'en_livraison',
        comment: "En route vers la Centrale d'achat Total",
        timestamp: hoursAgo(0.3),
      },
    ],
  })

  console.log('✅ Timeline events created')
  console.log('\n🎉 Seed completed successfully!')
  console.log('   Users: bgfi@bank.cg, total@energy.cg, livreur1@coursier.cg')
  console.log('   Password: demo1234')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
