-- ============================================================
-- PRODESK CONGO — Ajouts Audit A/B/C/D
-- Tables : Partner, ServicePartner, Procedure, JobDescription,
--          CorrespondenceTemplate, Correspondence
-- Execute dans le Neon SQL Editor
-- ============================================================

BEGIN;

-- 1. TABLE PARTENAIRES / INSTITUTIONS
CREATE TABLE IF NOT EXISTS "Partner" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'institution',
  "slug" TEXT NOT NULL UNIQUE,
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "contactPerson" TEXT,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLE LIAISON SERVICE <-> PARTENAIRE
CREATE TABLE IF NOT EXISTS "ServicePartner" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serviceId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "linkType" TEXT NOT NULL DEFAULT 'mandat', -- mandat, depot, declaration, paiement, information
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServicePartner_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServicePartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. TABLE PROCEDURES
CREATE TABLE IF NOT EXISTS "Procedure" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serviceFamily" TEXT NOT NULL, -- digital_office, cnss_social, fiscalite, sfec, documentaire, secretariat
  "title" TEXT NOT NULL,
  "description" TEXT,
  "steps" TEXT NOT NULL DEFAULT '[]', -- JSON array of steps
  "requiredDocuments" TEXT NOT NULL DEFAULT '[]', -- JSON array of required docs
  "estimatedDuration" TEXT, -- ex: "2-5 jours ouvrables"
  "cost" TEXT, -- ex: "Gratuit" ou "5 000 FCFA"
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLE FICHES DE POSTE
CREATE TABLE IF NOT EXISTS "JobDescription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serviceFamily" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "department" TEXT NOT NULL DEFAULT 'PRODESK',
  "mission" TEXT NOT NULL DEFAULT '',
  "responsibilities" TEXT NOT NULL DEFAULT '[]', -- JSON
  "requiredSkills" TEXT NOT NULL DEFAULT '[]', -- JSON
   "requiredDiplomas" TEXT NOT NULL DEFAULT '[]', -- JSON
   "experience" TEXT, -- ex: "2 ans minimum"
  "tools" TEXT NOT NULL DEFAULT '[]', -- JSON
  "reportsTo" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLE MODELES DE CORRESPONDANCE
CREATE TABLE IF NOT EXISTS "CorrespondenceTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "serviceFamily" TEXT, -- lié à un service ou null si générique
  "category" TEXT NOT NULL DEFAULT 'courrier_sortant', -- courrier_sortant, courrier_entrant, demande, reclamation, attestation, rapport
  "subject" TEXT NOT NULL, -- objet du courrier
  "body" TEXT NOT NULL, -- corps avec variables {{entreprise}}, {{nif}}, {{date}}, etc.
  "footer" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLE CORRESPONDANCES GENEREES
CREATE TABLE IF NOT EXISTS "Correspondence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reference" TEXT NOT NULL UNIQUE, -- COR-YYYYMMDD-NNN
  "templateId" TEXT,
  "taskId" TEXT,
  "companyId" TEXT,
  "clientId" TEXT,
  "partnerId" TEXT,
  "category" TEXT NOT NULL DEFAULT 'courrier_sortant',
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL, -- contenu final après substitution
  "status" TEXT NOT NULL DEFAULT 'brouillon', -- brouillon, emis, recu, archive
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Correspondence_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CorrespondenceTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Correspondence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Correspondence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Correspondence_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Correspondence_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- INDEX
CREATE INDEX IF NOT EXISTS "Procedure_serviceFamily_idx" ON "Procedure"("serviceFamily");
CREATE INDEX IF NOT EXISTS "JobDescription_serviceFamily_idx" ON "JobDescription"("serviceFamily");
CREATE INDEX IF NOT EXISTS "CorrespondenceTemplate_serviceFamily_idx" ON "CorrespondenceTemplate"("serviceFamily");
CREATE INDEX IF NOT EXISTS "CorrespondenceTemplate_category_idx" ON "CorrespondenceTemplate"("category");
CREATE INDEX IF NOT EXISTS "Correspondence_companyId_idx" ON "Correspondence"("companyId");
CREATE INDEX IF NOT EXISTS "Correspondence_clientId_idx" ON "Correspondence"("clientId");
CREATE INDEX IF NOT EXISTS "Correspondence_taskId_idx" ON "Correspondence"("taskId");
CREATE INDEX IF NOT EXISTS "Correspondence_status_idx" ON "Correspondence"("status");
CREATE INDEX IF NOT EXISTS "ServicePartner_serviceId_idx" ON "ServicePartner"("serviceId");
CREATE INDEX IF NOT EXISTS "ServicePartner_partnerId_idx" ON "ServicePartner"("partnerId");
CREATE INDEX IF NOT EXISTS "Partner_slug_idx" ON "Partner"("slug");

-- ============================================================
-- SEED: PARTENAIRES / INSTITUTIONS CONGOLAISES
-- ============================================================
INSERT INTO "Partner" ("id","name","type","slug","address","phone","email","website","contactPerson","description","isActive") VALUES
('prt_dgid','Direction Generale des Impots (DGID)','institution','dgid','Avenue Amilcar Cabral, Centre-ville, Brazzaville','242 06 600 00 00','contact@dgid.cg','https://dgid.cg','Direction Generale','Direction generale des impots du Congo - NIF, télédéclaration, fiscalité',true),
('prt_cnss','Caisse Nationale de Securite Sociale (CNSS)','institution','cnss','Avenue de la Paix, Brazzaville','242 06 600 11 11','info@cnss.cg','https://cnss.cg','Direction Generale','Caisse nationale de securite sociale - Affiliation, cotisations, prestations',true),
('prt_sfec','Service des Formalites des Etrangers au Congo (SFEC)','institution','sfec','Avenue Amilcar Cabral, Brazzaville','242 06 600 22 22','contact@sfec.cg',NULL,'Chef de Service','Formalites pour les étrangers - Carte de sejour, titre de travail',true),
('prt_dge','Direction Generale des Entreprises (DGE)','institution','dge','Avenue Denis Sassou Nguesso, Brazzaville','242 06 600 33 33','info@dge.cg','https://dge.cg','Directeur General','Creation entreprise, RCCM, registre du commerce',true),
('prt_cnps','Caisse Nationale de Prevoyance Sociale (CNPS)','institution','cnps','Boulevard Denis Sassou Nguesso, Brazzaville','242 06 600 44 44','contact@cnps.cg',NULL,'Directeur General','Prevoyance sociale pour les fonctionnaires',true),
('prt_mef','Ministere de l Economie et des Finances','ministere','mef','Centre-ville, Brazzaville',NULL,NULL,NULL,'Ministre','Ministere de tutelle des impots et finances publiques',true),
('prt_mtpt','Ministere des Transports','ministere','mtpt','Brazzaville',NULL,NULL,NULL,'Ministre','Ministere de tutelle des transports et logistique',true),
('prt_anef','Agence Nationale de l Emploi et de la Formation (ANEF)','institution','anef','Avenue de l Independance, Brazzaville','242 06 600 55 55','contact@anef.cg',NULL,'Directeur General','Emploi et formation professionnelle',true),
('prt_dgccrf','Direction Generale de la Concurrence et de la Protection du Consommateur','institution','dgccrf','Brazzaville',NULL,NULL,NULL,'Directeur General','Protection du consommateur et regulation de la concurrence',true),
('prt_juridique','Etude Juridique Partenaire','cabinet','cabinet-juridique','Pointe-Noire',NULL,'contact@juridique.cg',NULL,'Avocat','Cabinet juridique partenaire pour les formalites complexes',true)
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "address" = EXCLUDED."address", "phone" = EXCLUDED."phone", "updatedAt" = CURRENT_TIMESTAMP;

-- ============================================================
-- SEED: LIAISONS SERVICE <-> PARTENAIRE
-- ============================================================
INSERT INTO "ServicePartner" ("id","serviceId","partnerId","linkType","description") VALUES
-- Fiscalite -> DGID, MEF
('sp1','svc_fiscalite','prt_dgid','declaration','Télédéclaration fiscale, déclaration mensuelle TVA/IS, régularisation'),
('sp2','svc_fiscalite','prt_mef','information','Ministère de tutelle pour les questions fiscales'),
-- CNSS/Social -> CNSS, CNPS
('sp3','svc_cnss_social','prt_cnss','declaration','Déclaration et paiement des cotisations sociales mensuelles'),
('sp4','svc_cnss_social','prt_cnss','depot','Dépôt des déclarations de salaires et cotisations'),
('sp5','svc_cnss_social','prt_cnps','information','Coordination pour la prévoyance sociale des agents publics'),
-- SFEC -> SFEC, DGE
('sp6','svc_sfec','prt_sfec','mandat','Demande de carte de séjour, renouvellement titre de travail'),
('sp7','svc_sfec','prt_dge','depot','Dépôt des dossiers de formalités étrangères'),
-- Bureau Digital -> DGID, CNSS, DGE, ANEF
('sp8','svc_digital','prt_dgid','declaration','Enregistrement en ligne NIF, télédéclaration via portail DGID'),
('sp9','svc_digital','prt_cnss','declaration','Affiliation en ligne des employés à la CNSS'),
('sp10','svc_digital','prt_dge','information','Création et modification d entreprise en ligne'),
('sp11','svc_digital','prt_anef','information','Déclarations liées à l emploi'),
-- Gestion Documentaire -> DGE, DGID
('sp12','svc_documentaire','prt_dge','depot','Récupération et classement des documents officiels (RCCM, NIF)'),
('sp13','svc_documentaire','prt_dgid','information','Récupération des quitances fiscales et documents DGID'),
-- Secrétariat -> Cabinet juridique
('sp14','svc_secretariat','prt_juridique','mandat','Rédaction et validation de courriers avec le cabinet juridique'),
('sp15','svc_secretariat','prt_dgccrf','information','Courriers et réclamations auprès de la DGCCRF')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: PROCEDURES PAR SERVICE
-- ============================================================

-- PROCEDURE: Fiscalité (5 étapes)
INSERT INTO "Procedure" ("id","serviceFamily","title","description","steps","requiredDocuments","estimatedDuration","cost","order") VALUES
('proc_fiscal_1','fiscalite','Télédéclaration mensuelle TVA/IS','Procedure complete de declaration fiscale mensuelle auprès de la DGID',
'["1. Recueillir les informations comptables du mois (CA, achats, TVA collectée/déductible)","2. Préparer la déclaration sur le portail DGID ou formulaire officiel","3. Vérifier les montants et les ratios fiscaux","4. Soumettre la déclaration avant le 15 du mois suivant","5. Récupérer la quittance de dépôt et archiver"]',
'["Balance comptable mensuelle","NIF valide de l entreprise","Relevé des ventes et achats TTC/HT","Quittances de TVA précédentes (si régularisation)"]',
'2-3 jours ouvrables','Inclus dans le forfait service (5 000 - 15 000 FCFA selon complexité)',1),

-- PROCEDURE: CNSS (4 étapes)
('proc_cnss_1','cnss_social','Affiliation d un nouvel employé à la CNSS','Affiliation d un salarie au régime de securite sociale',
'["1. Collecter les pièces requises du nouvel employé (copie CNI, contrat de travail, photos)","2. Remplir le formulaire d affiliation CNSS","3. Soumettre le dossier au guichet CNSS ou via le portail en ligne","4. Obtenir le numéro matricule CNSS de l employé et communiquer à l entreprise"]',
'["Copie CNI de l employé","Copie du contrat de travail","2 photos d identité","Attestation d employeur sur papier en-tête"]',
'3-5 jours ouvrables','7 500 FCFA par employé',1),

('proc_cnss_2','cnss_social','Declaration mensuelle des cotisations sociales','Declaration et paiement des cotisations CNSS mensuelles',
'["1. Compiler la liste des salaires bruts du mois","2. Calculer les cotisations patronales et salariales","3. Remplir la déclaration de cotisations sur le formulaire CNSS","4. Soumettre et payer avant le 15 du mois suivant"]',
'["Etat des salaires du mois","Nombre total de salariés affiliés","Reçu des cotisations précédentes"]',
'1-2 jours ouvrables','7 500 FCFA par déclaration',2),

-- PROCEDURE: SFEC (6 étapes)
('proc_sfec_1','sfec','Demande de carte de sejour pour étranger','Procedure de demande de carte de sejour aupres du SFEC',
'["1. Vérifier la validité du titre de voyage et du visa d entrée","2. Constituer le dossier SFEC (formulaire, photos, CNI employeur, contrat)","3. Déposer le dossier au guichet SFEC","4. Payer les frais de timbre et de dossier","5. Suivre le traitement et récupérer le récépissé","6. Retirer la carte de séjour une fois délivrée (15-30 jours)"]',
'["Passeport valide (copie + original)","Visa d entree en cours de validite","4 photos d identite format passeport","Copie CNI de l employeur","Contrat de travail signe et certifie","Certificat de residence","Quittance de paiement des frais"]',
'15-30 jours ouvrables','15 000 FCFA (frais service) + frais SFEC',1),

-- PROCEDURE: Bureau Digital (4 étapes)
('proc_digital_1','digital_office','Creation de compte en ligne DGID','Ouverture d un compte professionnel sur le portail fiscal DGID',
'["1. Rassembler les documents de l entreprise (NIF, RCCM, statuts)","2. Se rendre sur le portail DGID et créer le compte avec les informations entreprise","3. Valider l email et activer le compte","4. Configurer les accès et paramétrer la télédéclaration"]',
'["NIF de l entreprise","Extrait RCCM","Statuts de la société","Email professionnel valide","Numero de telephone de contact"]',
'1-3 jours ouvrables','5 000 FCFA',1),

('proc_digital_2','digital_office','Enregistrement en ligne DGE','Inscription de l entreprise sur le registre DGE',
'["1. Vérifier que le RCCM est à jour","2. Créer un compte sur la plateforme DGE","3. Saisir les informations de l entreprise et des associés","4. Valider et obtenir l attestation d immatriculation en ligne"]',
'["Extrait RCCM récent","NIF valide","Statuts mis à jour","Pièces d identite des associés"]',
'2-5 jours ouvrables','5 000 FCFA',2),

-- PROCEDURE: Gestion Documentaire (3 étapes)
('proc_doc_1','documentaire','Classement et archivage des documents officiels','Organisation et archivage du dossier administratif de l entreprise',
'["1. Recenser tous les documents administratifs de l entreprise (fiscaux, sociaux, commerciaux)","2. Numériser les documents papier et classer par catégorie et date","3. Créer un index de référence et stocker en lieu sûr (physique et numérique)"]',
'["Tous les documents originaux à classer","Accès aux dossiers comptables","Equipement de numérisation (scan)"]',
'3-5 jours ouvrables','2 500 FCFA par lot de 20 documents',1),

-- PROCEDURE: Secrétariat (4 étapes)
('proc_sec_1','secretariat','Redaction d un courrier officiel','Redaction et mise en forme d un courrier administratif professionnel',
'["1. Recueillir les informations et l objet du courrier auprès du client","2. Rédiger le courrier selon le modèle approprié (demande, reclamation, information)","3. Faire valider par le client ou le responsable","4. Envoyer ou mettre à disposition pour signature et envoi"]',
'["Informations du destinataire (nom, titre, adresse)","Objet du courrier","Pièces jointes éventuelles","En-tête de l entreprise (logo, coordonnées)"]',
'1-2 jours ouvrables','2 500 FCFA par courrier',1),

('proc_sec_2','secretariat','Traduction de document administratif','Traduction d un document officiel vers le francais ou l anglais',
'["1. Recevoir le document source et identifier la langue cible","2. Traduire le document en conservant le format officiel","3. Faire relire par un deuxième traducteur pour validation","4. Livrer le document traduit au client"]',
'["Document source original","Indication de la langue cible","Référence du document (si traduction assermentée)"]',
'2-3 jours ouvrables','5 000 - 10 000 FCFA selon la longueur',2)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: FICHES DE POSTE
-- ============================================================
INSERT INTO "JobDescription" ("id","serviceFamily","title","department","mission","responsibilities","requiredSkills","requiredDiplomas","experience","tools","reportsTo") VALUES
('jd_digital','digital_office','Agent Bureau Digital','PRODESK','Assurer l enregistrement en ligne et le suivi des formalites numeriques des entreprises clientes',
'["Enregistrer les entreprises sur les portails DGID, CNSS, DGE","Suivre les télédéclarations mensuelles (TVA, IS, cotisations)","Assister les clients dans l utilisation des plateformes en ligne","Veiller au respect des échéances fiscales et sociales","Maintenir à jour les identifiants et accès des clients"]',
'["Maîtrise des portails DGID et CNSS en ligne","Notions de comptabilité et fiscalité congolaise","Rigueur et respect des délais","Communication professionnelle","Traitement de données et saisie"]',
'["BTS Comptabilité / Gestion ou équivalent","Formation certifiée en fiscalité (plus)"]',
'1 an minimum en administrative ou comptabilité',
'["Portail DGID","Portail CNSS","Suite bureautique (Excel, Word)","Navigateur web"]',
'Chef de projet PRODESK'),

('jd_cnss','cnss_social','Chargé Affiliation Sociale','PRODESK','Gerer les affiliations, declarations et suivis des dossiers sociaux (CNSS, CNPS)',
'["Traiter les demandes d affiliation de nouveaux employés","Préparer et soumettre les déclarations mensuelles de cotisations","Suivre le paiement des cotisations et récupérer les quittances","Gérer les litiges avec la CNSS et faire les régularisations","Tenir à jour le registre des affiliés par entreprise"]',
'["Connaissance approfondie de la législation sociale congolaise","Maîtrise des procédures CNSS/CNPS","Organisation et gestion de dossiers","Capacité de calcul des cotisations sociales","Sensibilité à la confidentialité des données personnelles"]',
'["Licence en Droit Social ou Gestion des Ressources Humaines","BTS Comptabilité avec spécialisation sociale"]',
'2 ans minimum en gestion sociale ou RH',
'["Formulaires CNSS","Excel (avancé)","Suite bureautique","Base de données RH"]',
'Chef de projet PRODESK'),

('jd_fiscalite','fiscalite','Agent Fiscal','PRODESK','Assurer la conformite fiscale des entreprises clientes et gerer les declarations aupres de la DGID',
'["Préparer les déclarations fiscales mensuelles (TVA, IS, IR)","Suivre les échéances fiscales et alerter les clients","Déposer les déclarations sur le portail DGID","Récupérer et archiver les quitances fiscales","Assister les entreprises en cas de contrôle ou régularisation fiscale"]',
'["Fiscalité congolaise (TVA, IS, IR, IRE, patente)","Maîtrise du portail DGID","Comptabilité générale et analytique","Analyse financière de base","Respect strict des délais légaux"]',
'["Licence en Comptabilité ou Gestion","Diplôme de comptable (DEC, Gestionnaire de paie)","Formation certifiée en fiscalité"]',
'2 ans minimum en cabinet comptable ou service fiscal',
'["Portail DGID","Logiciel comptable (SAGE, autre)","Excel avancé","Suite bureautique"]',
'Chef de projet PRODESK'),

('jd_sfec','sfec','Chargé de Formalites Etrangers','PRODESK','Gerer les dossiers de formalites pour les travailleurs etrangers (sejour, titre de travail)',
'["Constituer les dossiers de demande de carte de séjour","Suivre les dossiers auprès du SFEC et alerter les clients","Gérer les renouvellements de titres et cartes de séjour","Maintenir à jour le registre des étrangers par entreprise","Coordonner avec le cabinet juridique pour les cas complexes"]',
'["Connaissance de la réglementation sur l immigration au Congo","Maîtrise des procédures SFEC","Organisation rigoureuse de dossiers","Communication avec les administrations publiques","Gestion des délais et urgences"]',
'["Licence en Droit (droit des étrangers plus)","BTS Administratif ou Juridique"]',
'1 an minimum en formalités administratives ou juridiques',
'["Formulaires SFEC","Suite bureautique","Base de données suivi dossiers"]',
'Chef de projet PRODESK'),

('jd_documentaire','documentaire','Archiviste Documentaire','PRODESK','Assurer la gestion, le classement et l archivage des documents administratifs des clients',
'["Numériser et classer les documents administratifs des entreprises","Créer et maintenir un système de classement logique","Récupérer les documents auprès des institutions (DGID, CNSS, DGE, SFEC)","Gérer le stockage physique et numérique des dossiers","Produire des inventaires et index de référence des documents"]',
'["Organisation et méthode de classement","Maîtrise des outils de numérisation","Rigueur et attention au détail","Connaissance des documents administratifs congolais","Gestion de base de données documentaire"]',
'["BTS en Gestion Documentaire ou Information","BAC+2 en Sciences de l Information (plus)"]',
'6 mois minimum en archivage ou gestion documentaire',
'["Scanner / imprimante multifonction","Suite bureautique","Logiciel de classement documentaire","Google Drive / stockage cloud"]',
'Chef de projet PRODESK'),

('jd_secretariat','secretariat','Assistante Administrative / Secretaire','PRODESK','Assurer le secretariat externalise, la redaction de courriers et le back-office administratif',
'["Rédiger les courriers administratifs (demandes, réclamations, attestations)","Traduire des documents administratifs (français / anglais)","Rédiger les comptes rendus de réunion","Gérer le classement et l envoi du courrier entrant/sortant","Assurer le support back-office (saisie de données, gestion agenda)"]',
'["Excellente rédaction en français (et anglais si possible)","Maîtrise de la correspondance administrative officielle","Traduction courante anglais-français","Bonne connaissance du traitement de texte","Communication professionnelle et présentation soignée"]',
'["BTS Secrétariat de Direction ou Administratif","Licence en Langues (anglais) est un plus"]',
'1 an minimum en secrétariat ou assistant de direction',
'["Suite Office (Word, Excel, PowerPoint)","Outils de messagerie (email, WhatsApp)","Imprimante / scanner"]',
'Chef de projet PRODESK')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: MODELES DE CORRESPONDANCE
-- ============================================================
INSERT INTO "CorrespondenceTemplate" ("id","title","slug","serviceFamily","category","subject","body","footer") VALUES
('tpl_1','Demande d attestation fiscale','demande-attestation-fiscale','fiscalite','demande',
'Demande d attestation de regularite fiscale - {{entreprise}}',
'Je soussigne, {{representant}}, representant legal de la societe {{entreprise}} (NIF: {{nif}}, RCCM: {{rccm}}),


Ai l honneur de solliciter de votre haute bienveillance la delivrance d une attestation de regularite fiscale.


Cette attestation nous est necessaire dans le cadre de {{motif}}.


Nous restons a votre entiere disposition pour toute information complementaire.


Veuillez agreer, Monsieur le Directeur General, l expression de notre haute consideration.


{{representant}}
Representant legal
{{entreprise}}',
'CoursierB2B — Service Fiscalite
Tel: 242 06 610 58 05'),

('tpl_2','Demande d affiliation employe CNSS','demande-affiliation-cnss','cnss_social','demande',
'Demande d affiliation d un salarie - {{entreprise}}',
'Madame, Monsieur le Directeur,


La societe {{entreprise}} (NIF: {{nif}}) soussignee, represented par {{representant}},


A l honneur de vous demander l affiliation de {{employe_nom}} (CNI: {{employe_cni}}) au regime de securite sociale de la CNSS, en sa qualite de {{employe_fonction}} au sein de notre entreprise, a compter du {{date_debut}}.


Nous vous prions de bien vouloir prendre en consideration cette demande et de nous communiquer le numero matricule attribue.


Veuillez agreer, Madame, Monsieur, l expression de nos salutations distinguees.


{{representant}}
Representant legal
{{entreprise}}',
'CoursierB2B — Service CNSS / Social
Tel: 242 06 610 58 05'),

('tpl_3','Demande de carte de sejour SFEC','demande-carte-sejour','sfec','demande',
'Demande de carte de sejour - {{entreprise}}',
'Monsieur le Chef de Service,


La societe {{entreprise}} (NIF: {{nif}}, RCCM: {{rccm}}), represented par {{representant}},


A l honneur de solliciter la delivrance d une carte de sejour pour:


- Nom et prenoms: {{employe_nom}}
- Nationalite: {{employe_nationalite}}
- Passeport N: {{employe_passeport}}
- Fonction: {{employe_fonction}}
- Date d entree au Congo: {{date_entree}}


Nous vous prions de bien vouloir examiner notre demande et de nous indiquer les pieces complementaires eventuellement necessaires.


Veuillez agreer, Monsieur le Chef de Service, l expression de notre haute consideration.


{{representant}}
Representant legal
{{entreprise}}',
'CoursierB2B — Service SFEC
Tel: 242 06 610 58 05'),

('tpl_4','Courrier de reclamation DGID','reclamation-dgid','fiscalite','reclamation',
'Reclamation relative a {{objet_reclamation}} - {{entreprise}}',
'Monsieur le Directeur General,


La societe {{entreprise}} (NIF: {{nif}}), represented par {{representant}},


A l honneur de porter a votre connaissance une reclamation relative a {{objet_reclamation}}.


Les faits sont les suivants: {{detail_reclamation}}.


Nous vous demandons de bien vouloir reexaminer ce dossier et de prendre les mesures appropriees afin de regulariser la situation.


Dans l attente d une suite favorable, nous vous prions d agreer, Monsieur le Directeur General, l expression de notre consideration distingee.


{{representant}}
Representant legal
{{entreprise}}',
'CoursierB2B — Service Fiscalite
Tel: 242 06 610 58 05'),

('tpl_5','Lettre de demande generique','demande-generique',NULL,'demande',
'Demande - {{entreprise}}',
'Madame, Monsieur,


La societe {{entreprise}} (NIF: {{nif}}, RCCM: {{rccm}}), represented par {{representant}},


A l honneur de vous adresser la presente demande concernant: {{objet_demande}}.


{{detail_demande}}


Nous restons a votre entiere disposition pour tout renseignement complementaire et vous prions de bien vouloir donner une suite favorable a notre demande.


Veuillez agreer, Madame, Monsieur, l expression de nos salutations distinguees.


{{representant}}
Representant legal
{{entreprise}}',
'CoursierB2B — Secretariat
Tel: 242 06 610 58 05'),

('tpl_6','Attestation de bon fonctionnement','attestation-bon-fonctionnement','secretariat','attestation',
'Attestation de bon fonctionnement - {{entreprise}}',
'Je soussigne, {{representant}}, representant de CoursierB2B,


Certifie par la presente que la societe {{entreprise}} (NIF: {{nif}}, RCCM: {{rccm}}) est en regle avec l ensemble de ses obligations administratives.


Les services suivants ont ete correctement executes:
{{services_realises}}


Cette attestation est delivree pour servir et valoir ce que de droit.


Fait a Pointe-Noire, le {{date}}


{{representant}}
CoursierB2B',
'CoursierB2B — Pointe-Noire, Congo
Tel: 242 06 610 58 05
https://courier-b2b-pn.vercel.app'),

('tpl_7','Compte rendu de reunion','compte-rendu-reunion','secretariat','rapport',
'Compte rendu de reunion du {{date_reunion}}',
'COMPTE RENDU DE REUNION

Date: {{date_reunion}}
Lieu: {{lieu_reunion}}
Participants: {{participants}}

Ordre du jour:
{{ordre_du_jour}}


Synthese des echanges:
{{synthese}}


Decisions prises:
{{decisions}}


Prochaines etapes:
{{prochaines_etapes}}


Redige par: {{redacteur}}
Date de redaction: {{date}}',
'CoursierB2B — Secretariat
Tel: 242 06 610 58 05'),

('tpl_8','Relance de dossier','relance-dossier',NULL,'reclamation',
'Relance - Dossier {{reference_dossier}} - {{entreprise}}',
'Madame, Monsieur,


La societe {{entreprise}} (NIF: {{nif}}), represented par {{representant}},


A l honneur de relancer le dossier reference {{reference_dossier}} depose le {{date_depot}}.


Malgre nos precedentes demandes, nous n avons toujours pas recu de retour concernant ce dossier.


Nous vous serions reconnaissants de bien vouloir nous donner des nouvelles de l avancement de ce dossier dans les meilleurs delais.


Veuillez agreer, Madame, Monsieur, l expression de nos salutations distinguees.


{{representant}}
Representant legal
{{entreprise}}',
'CoursierB2B — Secretariat
Tel: 242 06 610 58 05')
ON CONFLICT ("slug") DO UPDATE SET "title" = EXCLUDED."title", "body" = EXCLUDED."body", "updatedAt" = CURRENT_TIMESTAMP;

COMMIT;
