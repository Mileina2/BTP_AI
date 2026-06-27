import prisma from "../config/prisma.js";
import { toLegacy } from "../utils/legacyMap.js";
import { getCurrency } from "../utils/currency.js";

const CATEGORIES_ORDER = ["Matériaux", "Main-d'œuvre", "Transport", "Sous-traitance", "Autre"];

function escapeCsv(val) {
  const s = String(val ?? "");
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fluxMeta(dateEcheance, paye, now = new Date()) {
  if (paye || !dateEcheance) return { enRetard: false, joursRestants: null };
  const jours = Math.ceil(
    (new Date(dateEcheance).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000
  );
  return { enRetard: jours < 0, joursRestants: jours };
}

export async function syncChantierDepenses(chantierId) {
  const agg = await prisma.depense.aggregate({
    where: { chantierId },
    _sum: { montant: true },
  });
  const depenses = agg._sum.montant || 0;
  const chantier = await prisma.chantier.findUnique({ where: { id: chantierId } });
  const avancementFinancier =
    chantier?.budget > 0 ? Math.min(100, Math.round((depenses / chantier.budget) * 100)) : 0;

  await prisma.chantier.update({
    where: { id: chantierId },
    data: { depenses, avancementFinancier },
  });
}

export function formatDepenseList(d, deviseCode = "XOF") {
  const qty = d.quantite ?? 1;
  const pu = d.prixUnitaire ?? 0;
  const montant = d.montant ?? qty * pu;
  const meta = fluxMeta(d.dateEcheance, d.paye);

  return toLegacy({
    ...d,
    quantite: qty,
    unite: d.unite || "u",
    prixUnitaire: pu,
    montant,
    devise: getCurrency(deviseCode).symbol,
    chantier: d.chantier?.nom || d.chantierId,
    chantierId: d.chantierId,
    chantierNom: d.chantier?.nom,
    fournisseurNom: d.fournisseurRef?.nom || d.fournisseur,
    dateEcheance: d.dateEcheance,
    ...meta,
  });
}

export function buildResume(chantier) {
  const budget = chantier.budget || 0;
  const depenses = chantier.depenses || 0;
  const restant = budget - depenses;
  const pourcentage = budget > 0 ? Math.round((depenses / budget) * 1000) / 10 : 0;

  return {
    budget,
    depenses,
    restant,
    pourcentage,
    budgetInitial: budget,
    totalDepenses: depenses,
    budgetRestant: restant,
    depasse: restant < 0,
    enAlerte: pourcentage >= 80 && pourcentage < 100,
    ecart: depenses - budget,
    ecartPct: budget > 0 ? Math.round(((depenses - budget) / budget) * 1000) / 10 : 0,
  };
}

export function buildFinancialControl(chantier, depenses, devis, factures) {
  const resume = buildResume(chantier);
  const engageNonPaye = depenses.filter((d) => !d.paye).reduce((s, d) => s + (d.montant || 0), 0);
  const engagePaye = depenses.filter((d) => d.paye).reduce((s, d) => s + (d.montant || 0), 0);

  const montantDevis = devis?.montantHT ?? 0;
  const encaisse = factures
    .filter((f) => f.statut === "PAYEE")
    .reduce((s, f) => s + (f.montantTTC || 0), 0);
  const factureEmise = factures.reduce((s, f) => s + (f.montantTTC || 0), 0);

  const avancementPhys = chantier.avancementPhysique || 0;
  const forecastFinal =
    avancementPhys > 5 ? Math.round((resume.depenses / avancementPhys) * 100) : null;
  const ecartForecast = forecastFinal != null ? forecastFinal - resume.budget : null;

  let risque = "FAIBLE";
  if (resume.depasse || resume.pourcentage >= 95) risque = "CRITIQUE";
  else if (resume.pourcentage >= 80 || (ecartForecast != null && ecartForecast > 0)) risque = "ÉLEVÉ";
  else if (resume.pourcentage >= 55) risque = "MODÉRÉ";

  const burnRate = computeBurnRate(depenses);

  return {
    ...resume,
    engageNonPaye,
    engagePaye,
    montantDevis,
    encaisse,
    factureEmise,
    margeOperationnelle: encaisse - resume.depenses,
    margeSurDevis: montantDevis > 0 ? montantDevis - resume.depenses : null,
    avancementPhysique: avancementPhys,
    avancementFinancier: resume.pourcentage,
    forecastFinal,
    ecartForecast,
    risque,
    burnRate,
    devisNumero: devis?.numero || null,
  };
}

function computeBurnRate(depenses) {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const recent = depenses.filter((d) => new Date(d.date) >= threeMonthsAgo);
  if (recent.length === 0) return 0;

  const total = recent.reduce((s, d) => s + (d.montant || 0), 0);
  return Math.round(total / 3);
}

export function buildBudgetAnalyse(depenses, budget = 0) {
  const parCategorie = {};
  depenses.forEach((d) => {
    const cat = d.categorie || "Autre";
    parCategorie[cat] = (parCategorie[cat] || 0) + (d.montant || 0);
  });

  const total = depenses.reduce((s, d) => s + (d.montant || 0), 0);

  const pieChart = Object.entries(parCategorie).map(([name, value]) => ({
    name,
    value,
    percent: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
  }));

  const categorieTable = CATEGORIES_ORDER
    .filter((c) => parCategorie[c])
    .concat(Object.keys(parCategorie).filter((c) => !CATEGORIES_ORDER.includes(c)))
    .map((cat) => {
      const montant = parCategorie[cat] || 0;
      return {
        categorie: cat,
        montant,
        partDepenses: total > 0 ? Math.round((montant / total) * 1000) / 10 : 0,
        partBudget: budget > 0 ? Math.round((montant / budget) * 1000) / 10 : 0,
      };
    });

  const sorted = [...depenses].sort((a, b) => new Date(a.date) - new Date(b.date));
  let cumul = 0;
  const lineChart = sorted.map((d) => {
    cumul += d.montant || 0;
    return {
      date: new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      montant: cumul,
      depense: d.montant || 0,
      budgetLine: budget,
    };
  });

  const byMonth = {};
  depenses.forEach((d) => {
    const dt = new Date(d.date);
    const key = dt.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    byMonth[key] = (byMonth[key] || 0) + (d.montant || 0);
  });
  const monthlyChart = Object.entries(byMonth).map(([name, value]) => ({ name, value }));

  const barChart = categorieTable.map((c) => ({
    name: c.categorie,
    montant: c.montant,
    partBudget: c.partBudget,
  }));

  return {
    pieChart,
    lineChart,
    monthlyChart,
    barChart,
    categorieTable,
    repartition: pieChart,
    evolution: lineChart,
  };
}

export async function getBudgetOverview(organizationId) {
  const [org, chantiers, depenses, factures] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { devise: true } }),
    prisma.chantier.findMany({
      where: { organizationId },
      select: {
        id: true,
        nom: true,
        budget: true,
        depenses: true,
        statut: true,
        ville: true,
        avancementPhysique: true,
        avancementFinancier: true,
      },
      orderBy: { nom: "asc" },
    }),
    prisma.depense.findMany({
      where: { organizationId },
      include: {
        chantier: { select: { id: true, nom: true } },
        fournisseurRef: { select: { id: true, nom: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.facture.findMany({
      where: { organizationId },
      select: { montantTTC: true, statut: true, chantierId: true },
    }),
  ]);

  const deviseCode = org?.devise || "XOF";

  let budgetTotal = 0;
  let depensesTotal = 0;
  let chantiersEnAlerte = 0;
  let chantiersDepasses = 0;
  const encaisseTotal = factures
    .filter((f) => f.statut === "PAYEE")
    .reduce((s, f) => s + (f.montantTTC || 0), 0);

  const chantiersResume = chantiers.map((c) => {
    const resume = buildResume(c);
    const fc = buildFinancialControl(
      c,
      depenses.filter((d) => d.chantierId === c.id),
      null,
      factures.filter((f) => f.chantierId === c.id)
    );
    budgetTotal += c.budget || 0;
    depensesTotal += c.depenses || 0;
    if (resume.depasse) chantiersDepasses++;
    else if (resume.enAlerte) chantiersEnAlerte++;
    return {
      id: c.id,
      nom: c.nom,
      ville: c.ville,
      statut: c.statut,
      avancementPhysique: c.avancementPhysique,
      ...resume,
      risque: fc.risque,
      encaisse: fc.encaisse,
      margeOperationnelle: fc.margeOperationnelle,
      engageNonPaye: fc.engageNonPaye,
      forecastFinal: fc.forecastFinal,
    };
  });

  const nonPayees = depenses.filter((d) => !d.paye);
  const montantNonPaye = nonPayees.reduce((s, d) => s + (d.montant || 0), 0);
  const items = depenses.map((d) => formatDepenseList(d, deviseCode));
  const echeancesEnRetard = items.filter((d) => !d.paye && d.enRetard);
  const echeancesSous7j = items.filter(
    (d) => !d.paye && d.joursRestants !== null && d.joursRestants >= 0 && d.joursRestants <= 7
  );
  const echeancesDepenses = items
    .filter((d) => !d.paye)
    .sort((a, b) => {
      const da = a.dateEcheance ? new Date(a.dateEcheance) : new Date(a.date);
      const db = b.dateEcheance ? new Date(b.dateEcheance) : new Date(b.date);
      return da - db;
    });

  const alertes = [];
  if (echeancesEnRetard.length > 0) {
    alertes.push({
      type: "critical",
      titre: "Paiements fournisseurs en retard",
      message: `${echeancesEnRetard.length} charge(s) — ${Math.round(echeancesEnRetard.reduce((s, d) => s + d.montant, 0)).toLocaleString("fr-FR")} FCFA`,
    });
  }
  if (echeancesSous7j.length > 0) {
    alertes.push({
      type: "warning",
      titre: "Échéances sous 7 jours",
      message: `${echeancesSous7j.length} paiement(s) à prévoir cette semaine.`,
    });
  }
  if (chantiersDepasses > 0) {
    alertes.push({
      type: "warning",
      titre: "Budget dépassé",
      message: `${chantiersDepasses} chantier(s) au-delà du budget prévisionnel.`,
    });
  }

  return {
    stats: {
      totalChantiers: chantiers.length,
      budgetTotal,
      depensesTotal,
      restantTotal: budgetTotal - depensesTotal,
      tauxConsommation: budgetTotal > 0 ? Math.round((depensesTotal / budgetTotal) * 1000) / 10 : 0,
      chantiersEnAlerte,
      chantiersDepasses,
      totalDepenses: depenses.length,
      depensesNonPayees: nonPayees.length,
      montantNonPaye,
      encaisseTotal,
      margeGlobale: encaisseTotal - depensesTotal,
      ecartGlobal: depensesTotal - budgetTotal,
      echeancesEnRetard: echeancesEnRetard.length,
      montantEcheanceRetard: Math.round(echeancesEnRetard.reduce((s, d) => s + (d.montant || 0), 0)),
      echeancesSous7j: echeancesSous7j.length,
    },
    chantiers: chantiersResume,
    items,
    echeancesDepenses,
    alertes,
    recentDepenses: items.slice(0, 10),
    generatedAt: new Date().toISOString(),
  };
}

export async function getChantierBudget(organizationId, chantierId) {
  const [org, chantier] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { devise: true } }),
    prisma.chantier.findFirst({
      where: { id: chantierId, organizationId },
    }),
  ]);
  if (!chantier) return null;

  const deviseCode = org?.devise || "XOF";

  const [depenses, devis, factures] = await Promise.all([
    prisma.depense.findMany({ where: { chantierId }, orderBy: { date: "desc" } }),
    prisma.devis.findFirst({
      where: { chantierId, statut: "ACCEPTE" },
      orderBy: { createdAt: "desc" },
      select: { numero: true, montantHT: true, montantTTC: true },
    }),
    prisma.facture.findMany({
      where: { chantierId },
      select: { montantTTC: true, statut: true, numero: true },
    }),
  ]);

  const controle = buildFinancialControl(chantier, depenses, devis, factures);
  const analyse = buildBudgetAnalyse(depenses, chantier.budget);
  const depensesFormatted = depenses.map((d) => formatDepenseList({ ...d, chantier: { nom: chantier.nom } }, deviseCode));
  const echeancesOuvertes = depensesFormatted
    .filter((d) => !d.paye)
    .sort((a, b) => {
      const da = a.dateEcheance ? new Date(a.dateEcheance) : new Date(a.date);
      const db = b.dateEcheance ? new Date(b.dateEcheance) : new Date(b.date);
      return da - db;
    });

  return {
    chantier: toLegacy({ ...chantier, budgetRestant: controle.restant }),
    depenses: depensesFormatted,
    echeancesOuvertes,
    resume: controle,
    controle,
    analyse,
    budgetInitial: controle.budgetInitial,
    totalDepenses: controle.totalDepenses,
    budgetRestant: controle.budgetRestant,
    prediction: {
      risque: controle.risque,
      depensesActuelles: chantier.depenses,
      budget: chantier.budget,
      pourcentage: controle.pourcentage,
      forecastFinal: controle.forecastFinal,
      ecartForecast: controle.ecartForecast,
      burnRate: controle.burnRate,
    },
  };
}

export async function getDepenseDetail(organizationId, depenseId) {
  const [org, depense] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { devise: true } }),
    prisma.depense.findFirst({
      where: { id: depenseId, organizationId },
      include: {
        chantier: {
          select: {
            id: true,
            nom: true,
            budget: true,
            depenses: true,
            ville: true,
            statut: true,
            avancementPhysique: true,
          },
        },
      },
    }),
  ]);
  if (!depense) return null;

  const deviseCode = org?.devise || "XOF";

  const resume = depense.chantier ? buildResume(depense.chantier) : null;
  const qty = depense.quantite ?? 1;
  const pu = depense.prixUnitaire ?? 0;

  return {
    ...formatDepenseList(depense, deviseCode),
    chantier: depense.chantier
      ? {
          id: depense.chantier.id,
          nom: depense.chantier.nom,
          ville: depense.chantier.ville,
          statut: depense.chantier.statut,
          avancementPhysique: depense.chantier.avancementPhysique,
          ...buildResume(depense.chantier),
        }
      : null,
    finances: {
      quantite: qty,
      unite: depense.unite || "u",
      prixUnitaire: pu,
      montant: depense.montant ?? qty * pu,
      paye: depense.paye,
    },
    resume,
  };
}

export function parseDepenseInput(body) {
  const quantite = Number(body.quantite) || 1;
  const prixUnitaire = Number(body.prixUnitaire) || 0;
  const montant = body.montant != null ? Number(body.montant) : quantite * prixUnitaire;

  return {
    libelle: (body.libelle || body.categorie || "Dépense").trim(),
    categorie: body.categorie || "Autre",
    quantite,
    unite: body.unite || "u",
    prixUnitaire,
    montant,
    fournisseur: body.fournisseur?.trim() || null,
    fournisseurId: body.fournisseurId !== undefined ? body.fournisseurId || null : undefined,
    paye: body.paye === true || body.paye === "true",
    dateEcheance:
      body.dateEcheance !== undefined
        ? body.dateEcheance
          ? new Date(body.dateEcheance)
          : null
        : undefined,
    commentaire: body.commentaire?.trim() || null,
    date: body.date ? new Date(body.date) : undefined,
  };
}

export function buildBudgetCsv(data) {
  const lines = ["Projet;Libellé;Fournisseur;Date;Échéance;Montant (FCFA);Statut;Retard"];

  for (const d of data.items || []) {
    lines.push(
      [
        d.chantierNom,
        d.libelle,
        d.fournisseurNom || d.fournisseur || "",
        d.date ? new Date(d.date).toLocaleDateString("fr-FR") : "",
        d.dateEcheance ? new Date(d.dateEcheance).toLocaleDateString("fr-FR") : "",
        d.montant,
        d.paye ? "Soldée" : "Ouverte",
        d.enRetard ? "Oui" : "Non",
      ]
        .map(escapeCsv)
        .join(";")
    );
  }

  return lines.join("\n");
}
