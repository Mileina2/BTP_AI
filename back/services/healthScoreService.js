import prisma from "../config/prisma.js";

const MOIS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

export async function computeHealthScoreEntreprise(organizationId) {
  const [
    chantiers,
    facturesImpayees,
    stocksAlerte,
    depensesAgg,
    facturesPayees,
  ] = await Promise.all([
    prisma.chantier.findMany({
      where: { organizationId },
      select: { budget: true, depenses: true, avancementPhysique: true, statut: true },
    }),
    prisma.facture.count({
      where: { organizationId, statut: { in: ["ENVOYEE", "IMPAYEE"] } },
    }),
    prisma.stockArticle.count({
      where: { organizationId, etat: { in: ["ALERTE", "RUPTURE"] } },
    }),
    prisma.depense.aggregate({
      where: { organizationId },
      _sum: { montant: true },
    }),
    prisma.facture.aggregate({
      where: { organizationId, statut: "PAYEE" },
      _sum: { montantTTC: true },
    }),
  ]);

  let score = 100;
  const details = [];

  // Budget global
  const budgetTotal = chantiers.reduce((s, c) => s + c.budget, 0);
  const depensesTotal = chantiers.reduce((s, c) => s + c.depenses, 0);
  if (budgetTotal > 0) {
    const ratio = depensesTotal / budgetTotal;
    if (ratio > 1) {
      score -= 25;
      details.push({ label: "Budget dépassé", impact: -25 });
    } else if (ratio > 0.85) {
      score -= 15;
      details.push({ label: "Budget proche de la limite", impact: -15 });
    }
  }

  // Factures impayées
  if (facturesImpayees > 0) {
    const penalty = Math.min(30, facturesImpayees * 8);
    score -= penalty;
    details.push({ label: `${facturesImpayees} facture(s) impayée(s)`, impact: -penalty });
  }

  // Stock
  if (stocksAlerte > 0) {
    const penalty = Math.min(15, stocksAlerte * 5);
    score -= penalty;
    details.push({ label: `${stocksAlerte} article(s) en alerte stock`, impact: -penalty });
  }

  // Trésorerie simplifiée
  const recettes = facturesPayees._sum.montantTTC || 0;
  const depenses = depensesAgg._sum.montant || 0;
  const tresorerie = recettes - depenses;
  if (tresorerie < 0) {
    score -= 20;
    details.push({ label: "Trésorerie négative", impact: -20 });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const niveau =
    score >= 80 ? "excellent" : score >= 60 ? "bon" : score >= 40 ? "attention" : "critique";

  return {
    score,
    niveau,
    details,
    tresorerie,
    recettes,
    depenses,
  };
}

export async function computeHealthScoreChantier(chantierId, organizationId) {
  const chantier = await prisma.chantier.findFirst({
    where: { id: chantierId, organizationId },
    include: {
      depenseItems: { select: { montant: true } },
      factures: { select: { montantTTC: true, statut: true } },
    },
  });

  if (!chantier) return null;

  let score = 100;
  const details = [];

  const ratioBudget =
    chantier.budget > 0 ? chantier.depenses / chantier.budget : 0;

  if (ratioBudget > 1) {
    score -= 30;
    details.push({ label: "Budget dépassé", impact: -30 });
  } else if (ratioBudget > 0.8) {
    score -= 15;
    details.push({ label: "Budget à 80%+", impact: -15 });
  }

  const ecartAvancement =
    Math.abs(chantier.avancementPhysique - chantier.avancementFinancier);
  if (ecartAvancement > 20) {
    score -= 10;
    details.push({ label: "Écart avancement physique/financier", impact: -10 });
  }

  if (chantier.dateFin && new Date() > chantier.dateFin && chantier.statut !== "TERMINE") {
    score -= 20;
    details.push({ label: "Retard sur échéance", impact: -20 });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    chantierId,
    nom: chantier.nom,
    score,
    niveau: score >= 75 ? "bon" : score >= 50 ? "attention" : "critique",
    ratioBudget: Math.round(ratioBudget * 100),
    avancementPhysique: chantier.avancementPhysique,
    avancementFinancier: chantier.avancementFinancier,
    details,
  };
}

export async function getChantiersRentabilite(organizationId) {
  const chantiers = await prisma.chantier.findMany({
    where: { organizationId },
    include: {
      factures: { where: { statut: "PAYEE" }, select: { montantTTC: true } },
    },
  });

  return chantiers
    .map((c) => {
      const recettes = c.factures.reduce((s, f) => s + f.montantTTC, 0);
      const marge = recettes - c.depenses;
      const rentabilite = c.budget > 0 ? (marge / c.budget) * 100 : 0;
      return {
        id: c.id,
        nom: c.nom,
        budget: c.budget,
        depenses: c.depenses,
        recettes,
        marge,
        rentabilite: Math.round(rentabilite),
      };
    })
    .sort((a, b) => b.rentabilite - a.rentabilite);
}

export async function getPrevisionTresorerie(organizationId) {
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  const in60 = new Date(now);
  in60.setDate(in60.getDate() + 60);
  const in90 = new Date(now);
  in90.setDate(in90.getDate() + 90);

  const [facturesEntrantes, depensesPrevues, masseSalariale] = await Promise.all([
    prisma.facture.findMany({
      where: {
        organizationId,
        statut: { in: ["ENVOYEE", "IMPAYEE"] },
      },
      select: { montantTTC: true, dateEcheance: true },
    }),
    prisma.depense.findMany({
      where: { organizationId, paye: false },
      select: { montant: true, date: true },
    }),
    prisma.equipeMember.aggregate({
      where: { organizationId, statut: "ACTIF" },
      _sum: { salaireTotal: true },
    }),
  ]);

  const encaissements30 = facturesEntrantes
    .filter((f) => !f.dateEcheance || f.dateEcheance <= in30)
    .reduce((s, f) => s + f.montantTTC, 0);

  const depenses30 = depensesPrevues
    .filter((d) => d.date <= in30)
    .reduce((s, d) => s + d.montant, 0) + (masseSalariale._sum.salaireTotal || 0);

  const solde30 = encaissements30 - depenses30;

  return {
    periode30j: { encaissements: encaissements30, depenses: depenses30, solde: solde30 },
    masseSalariale: masseSalariale._sum.salaireTotal || 0,
    facturesEnAttente: facturesEntrantes.length,
    depensesNonPayees: depensesPrevues.length,
  };
}

export async function getMonthlyGraphData(organizationId) {
  const depenses = await prisma.depense.findMany({
    where: { organizationId },
    select: { montant: true, date: true },
  });

  const byMonth = Array(12).fill(0);
  depenses.forEach((d) => {
    byMonth[d.date.getMonth()] += d.montant;
  });

  return MOIS.map((mois, i) => ({ mois, total: byMonth[i] }));
}
