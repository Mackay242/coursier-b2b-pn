// Script pour changer les identifiants administrateur
// Usage: bun run scripts/change-admin.ts <email> <nom> <mot_de_passe>

import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({
  datasourceUrl: 'file:/home/z/my-project/db/custom.db',
});

async function main() {
  const email = process.argv[2];
  const name = process.argv[3];
  const password = process.argv[4];

  if (!email || !name || !password) {
    console.log('Usage: bun run scripts/change-admin.ts <email> <nom> <mot_de_passe>');
    console.log('Exemple: bun run scripts/change-admin.ts moi@monentreprise.cg JeanDupont MonPasse123');
    process.exit(1);
  }

  if (password.length < 6) {
    console.log('Erreur: le mot de passe doit avoir au moins 6 caracteres');
    process.exit(1);
  }

  // Hasher le nouveau mot de passe
  const hashedPassword = await hash(password, 10);

  // Mettre a jour l'admin (premier utilisateur avec role admin)
  const admin = await db.user.findFirst({ where: { role: 'admin' } });

  if (!admin) {
    console.log('Erreur: aucun compte admin trouve dans la base');
    process.exit(1);
  }

  // Verifier si l'email est deja pris par un autre utilisateur
  const existingUser = await db.user.findFirst({
    where: { email, NOT: { id: admin.id } },
  });
  if (existingUser) {
    console.log(`Erreur: l'email ${email} est deja utilise par un autre compte`);
    process.exit(1);
  }

  // Mettre a jour
  const updated = await db.user.update({
    where: { id: admin.id },
    data: { email, name, password: hashedPassword },
  });

  // Mettre a jour aussi le nom de l'entreprise associee
  const company = await db.company.findFirst({ where: { userId: admin.id } });
  if (company) {
    await db.company.update({
      where: { id: company.id },
      data: { name: name + ' (Admin)' },
    });
  }

  console.log('');
  console.log('✅ Identifiants admin mis a jour avec succes !');
  console.log('');
  console.log('  Email    : ' + updated.email);
  console.log('  Nom      : ' + updated.name);
  console.log('  Mot de passe : ' + '*'.repeat(password.length));
  console.log('  Role     : ' + updated.role);
  if (company) console.log('  Entreprise: ' + name + ' (Admin)');
  console.log('');
  console.log('Utilise ces identifiants pour te connecter sur l\'app.');

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Erreur:', e);
  process.exit(1);
});
