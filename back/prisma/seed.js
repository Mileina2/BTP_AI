import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ORG_DATA = {
  nom: "Entreprise Demo BTP",
  adresse: "Zone 4, Marcory — Rue des Entrepreneurs",
  ville: "Abidjan",
  pays: "Côte d'Ivoire",
  telephone: "+225 27 21 00 00 00",
  email: "contact@demo-btp.ci",
  rccm: "CI-ABJ-2020-B-12345",
  compteContribuable: "1234567 A",
  banque: "SGBCI",
  rib: "CI93 SGCI 0010 01234567890 12",
  signataireNom: "Amadou Koné",
  signataireFonction: "Gérant",
};

async function findOrCreateClient(orgId, ownerId) {
  const existing = await prisma.client.findFirst({
    where: { organizationId: orgId, email: "diallo@email.com" },
  });
  if (existing) return existing;

  return prisma.client.create({
    data: {
      organizationId: orgId,
      ownerId,
      nom: "M. Diallo",
      telephone: "+2250102030405",
      email: "diallo@email.com",
      statutRelation: "ACTIF",
      type: "PARTICULIER",
    },
  });
}

async function findOrCreateChantier(orgId, ownerId, clientId) {
  const existing = await prisma.chantier.findFirst({
    where: { organizationId: orgId, nom: "Villa Résidentielle Cocody" },
  });
  if (existing) return existing;

  return prisma.chantier.create({
    data: {
      organizationId: orgId,
      ownerId,
      clientId,
      nom: "Villa Résidentielle Cocody",
      budget: 45_000_000,
      depenses: 12_000_000,
      avancementPhysique: 35,
      avancementFinancier: 27,
      statut: "EN_COURS",
      ville: "Abidjan",
      typeTravaux: "CONSTRUCTION",
    },
  });
}

const DEVIS_LIGNES = [
  { designation: "Gros œuvre", quantite: 1, unite: "u", prixUnitaire: 25_000_000 },
  { designation: "Second œuvre", quantite: 1, unite: "u", prixUnitaire: 20_000_000 },
];

async function upsertDevis(orgId, clientId, chantierId) {
  const data = {
    organizationId: orgId,
    clientId,
    chantierId,
    montantHT: 45_000_000,
    montantTVA: 8_100_000,
    montantTTC: 53_100_000,
    statut: "ACCEPTE",
    signataireNom: "Amadou Koné",
    signataireFonction: "Gérant",
  };

  const existing = await prisma.devis.findUnique({ where: { numero: "DEV-2026-0001" } });
  if (existing) {
    await prisma.devisLigne.deleteMany({ where: { devisId: existing.id } });
    await prisma.devis.update({ where: { id: existing.id }, data });
    await prisma.devisLigne.createMany({
      data: DEVIS_LIGNES.map((l) => ({ ...l, devisId: existing.id })),
    });
    return existing;
  }

  return prisma.devis.create({
    data: {
      ...data,
      numero: "DEV-2026-0001",
      lignes: { create: DEVIS_LIGNES },
    },
  });
}

async function upsertFacture(orgId, clientId, chantierId, devisId) {
  const lignes = [
    { designation: "Acompte travaux gros oeuvre", quantite: 1, unite: "forfait", prixUnitaire: 10_000_000 },
    { designation: "Second oeuvre — lot 1", quantite: 1, unite: "forfait", prixUnitaire: 5_000_000 },
  ];
  const montantHT = 15_000_000;
  const montantTVA = 2_700_000;
  const montantTTC = 17_700_000;

  const existing = await prisma.facture.findUnique({ where: { numero: "FAC-2026-0001" } });
  if (existing) {
    await prisma.factureLigne.deleteMany({ where: { factureId: existing.id } });
    return prisma.facture.update({
      where: { id: existing.id },
      data: {
        organizationId: orgId,
        clientId,
        chantierId,
        devisId,
        montantHT,
        montantTVA,
        montantTTC,
        tva: 18,
        statut: "ENVOYEE",
        description: "Facture travaux Villa Cocody — phase 1",
        conditions: "Paiement par virement sous 30 jours.\nPénalités de retard applicables.",
        referenceDevis: "DEV-2026-0001",
        dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        modePaiement: "VIREMENT",
        lignes: { create: lignes },
      },
    });
  }

  return prisma.facture.create({
    data: {
      organizationId: orgId,
      clientId,
      chantierId,
      devisId,
      numero: "FAC-2026-0001",
      montantHT,
      montantTVA,
      montantTTC,
      tva: 18,
      statut: "ENVOYEE",
      description: "Facture travaux Villa Cocody — phase 1",
      conditions: "Paiement par virement sous 30 jours.\nPénalités de retard applicables.",
      referenceDevis: "DEV-2026-0001",
      dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      modePaiement: "VIREMENT",
      lignes: { create: lignes },
    },
  });
}

async function main() {
  console.log("🌱 Seed BTP IA ERP...");

  const org = await prisma.organization.upsert({
    where: { id: "demo-org" },
    update: { ...ORG_DATA, devise: "XOF" },
    create: { id: "demo-org", ...ORG_DATA, devise: "XOF" },
  });

  const hashed = await bcrypt.hash("demo1234", 12);

  const verifiedAt = new Date();

  const entrepreneur = await prisma.user.upsert({
    where: { email: "demo@btpia.com" },
    update: { organizationId: org.id, motDePasse: hashed, emailVerifiedAt: verifiedAt },
    create: {
      organizationId: org.id,
      nom: "Koné",
      prenom: "Amadou",
      email: "demo@btpia.com",
      motDePasse: hashed,
      role: "ENTREPRENEUR",
      telephone: "+2250700000000",
      emailVerifiedAt: verifiedAt,
    },
  });

  const client = await findOrCreateClient(org.id, entrepreneur.id);
  const chantier = await findOrCreateChantier(org.id, entrepreneur.id, client.id);

  const chefHash = await bcrypt.hash("chef1234", 12);
  const chef = await prisma.user.upsert({
    where: { email: "chef@btpia.com" },
    update: { organizationId: org.id, motDePasse: chefHash, role: "CHEF_CHANTIER", emailVerifiedAt: verifiedAt },
    create: {
      organizationId: org.id,
      nom: "Traoré",
      prenom: "Ibrahim",
      email: "chef@btpia.com",
      motDePasse: chefHash,
      role: "CHEF_CHANTIER",
      telephone: "+2250700000001",
      emailVerifiedAt: verifiedAt,
    },
  });

  await prisma.chantier.update({
    where: { id: chantier.id },
    data: { chefChantierId: chef.id },
  });

  const proprioHash = await bcrypt.hash("proprio1234", 12);
  const proprietaire = await prisma.user.upsert({
    where: { email: "proprietaire@btpia.com" },
    update: { organizationId: org.id, motDePasse: proprioHash, role: "CLIENT", emailVerifiedAt: verifiedAt },
    create: {
      organizationId: org.id,
      nom: "Diallo",
      prenom: "M.",
      email: "proprietaire@btpia.com",
      motDePasse: proprioHash,
      role: "CLIENT",
      telephone: "+2250102030405",
      emailVerifiedAt: verifiedAt,
    },
  });

  await prisma.client.update({
    where: { id: client.id },
    data: { userId: proprietaire.id },
  });

  const devis = await upsertDevis(org.id, client.id, chantier.id);
  await upsertFacture(org.id, client.id, chantier.id, devis.id);

  const rapportExists = await prisma.rapportJournalier.findFirst({
    where: { organizationId: org.id, chantierId: chantier.id },
  });
  if (!rapportExists) {
    await prisma.rapportJournalier.create({
      data: {
        organizationId: org.id,
        chantierId: chantier.id,
        auteurId: entrepreneur.id,
        ouvriersPresents: 6,
        ouvriersAbsents: 1,
        avancement: 38,
        meteo: "Ensoleillé",
        travauxRealises: "Coulage poutres niveau R+1, finition enduit façade est.",
        incidents: "Livraison gravier retardée 2h — impact mineur.",
        notes: "Visite client satisfait de l'avancement.",
        photos: [],
      },
    });
  }

  const depenseCount = await prisma.depense.count({ where: { chantierId: chantier.id } });
  if (depenseCount === 0) {
    await prisma.depense.createMany({
      data: [
        { organizationId: org.id, chantierId: chantier.id, libelle: "Ciment", categorie: "Matériaux", montant: 3_500_000 },
        { organizationId: org.id, chantierId: chantier.id, libelle: "Ferraillage", categorie: "Matériaux", montant: 8_500_000 },
      ],
    });
  }

  const stockExists = await prisma.stockArticle.findFirst({
    where: { organizationId: org.id, nom: "Ciment CPJ 42.5" },
  });
  if (!stockExists) {
    await prisma.stockArticle.create({
      data: {
        organizationId: org.id,
        chantierId: chantier.id,
        nom: "Ciment CPJ 42.5",
        categorie: "MATERIAUX",
        quantiteActuelle: 8,
        seuilAlerte: 20,
        prixUnitaire: 5500,
        unite: "sacs",
        etat: "ALERTE",
      },
    });
  }

  const equipeExists = await prisma.equipeMember.findFirst({
    where: { organizationId: org.id, nom: "Traoré Ibrahim" },
  });
  if (!equipeExists) {
    await prisma.equipeMember.create({
      data: {
        organizationId: org.id,
        chantierId: chantier.id,
        nom: "Traoré Ibrahim",
        role: "Maçon",
        tauxHoraire: 2500,
        heuresMensuelles: 160,
        salaireTotal: 400_000,
        statut: "ACTIF",
      },
    });
  }

  console.log("✅ Seed terminé (données démo à jour)");
  console.log("   Entrepreneur : demo@btpia.com / demo1234");
  console.log("   Chef chantier: chef@btpia.com / chef1234");
  console.log("   Propriétaire  : proprietaire@btpia.com / proprio1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
