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

// GET /api/services/seed - Page HTML pour initialiser les services (accessible sans auth)
export async function GET() {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Initialisation Services</title>
<style>
body{font-family:system-ui;max-width:600px;margin:80px auto;padding:20px;text-align:center}
.btn{background:#16a34a;color:#fff;border:none;padding:14px 32px;border-radius:8px;font-size:16px;cursor:pointer;font-weight:600}
.btn:hover{background:#15803d}
.status{margin-top:24px;padding:16px;border-radius:8px;display:none}
.ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
.err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
</style></head><body>
<h2>Initialisation Services PRODESK</h2>
<p>Cliquez pour créer les 6 services administratifs dans la base de donnees.</p>
<button class="btn" onclick="seed()">Initialiser les services</button>
<div id="status" class="status"></div>
<script>
async function seed(){
  const s=document.getElementById('status');
  s.style.display='block';s.className='status';s.textContent='Chargement...';
  try{
    const res=await fetch('/api/services/seed',{method:'POST'});
    const data=await res.json();
    if(res.ok){s.className='status ok';s.textContent='OK — '+data.message+' ('+data.total+' services)';}
    else{s.className='status err';s.textContent='Erreur: '+(data.erreur||JSON.stringify(data));}
  }catch(e){s.className='status err';s.textContent='Erreur reseau: '+e.message;}
}
</script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// POST /api/services/seed - Semer les services PRODESK (idempotent via upsert)
export async function POST() {
  try {
    const created: string[] = [];

    for (const serviceData of PRODESK_SERVICES) {
      const { slug, ...updateData } = serviceData;
      await db.service.upsert({
        where: { slug },
        update: updateData,
        create: { slug, ...updateData },
      });
      created.push(slug);
    }

    return NextResponse.json({
      message: 'Services PRODESK initialises avec succes',
      services: created,
      total: PRODESK_SERVICES.length,
    });
  } catch (error) {
    console.error('Erreur POST /api/services/seed:', error);
    return NextResponse.json(
      { erreur: 'Erreur serveur: ' + (error instanceof Error ? error.message : 'inconnu') },
      { status: 500 }
    );
  }
}
