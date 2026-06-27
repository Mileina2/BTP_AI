import prisma from "../config/prisma.js";
import { syncAlerts } from "./alertService.js";
import { getControlCenter } from "./controlCenterService.js";
import {
  computeHealthScoreEntreprise,
  computeHealthScoreChantier,
  getMonthlyGraphData,
} from "./healthScoreService.js";
import { CHANTIER_STATUT_LABEL } from "../utils/legacyMap.js";
import { computeFactureNetAPayer } from "../utils/facturePayments.js";
import { getSyncStatus } from "./comptaComptableService.js";
import { getTresorerieOverview } from "./tresorerieService.js";
import { getFournisseursOverview } from "./fournisseurService.js";
import { getConformiteOverview } from "./conformiteService.js";

const MOIS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

async function getMonthlyEncaissements(organizationId) {
  const factures = await prisma.facture.findMany({
    where: { organizationId, statut: "PAYEE" },
    select: { montantTTC: true, datePaiement: true, dateEmission: true },
  });

  const byMonth = Array(12).fill(0);
  factures.forEach((f) => {
    const d = f.datePaiement || f.dateEmission;
    byMonth[d.getMonth()] += f.montantTTC;
  });

  return MOIS.map((mois, i) => ({ mois, encaissements: byMonth[i] }));
}

async function getPilotageWidgets(organizationId) {
  const year = new Date().getFullYear();
  const [compta, tresorerieFull, fournisseursFull, conformiteFull] = await Promise.all([
    getSyncStatus(organizationId, { year }),
    getTresorerieOverview(organizationId),
    getFournisseursOverview(organizationId),
    getConformiteOverview(organizationId),
  ]);

  return {
    compta: {
      exercice: compta.exercice,
      aJour: compta.aJour,
      ecrituresCount: compta.ecrituresCount,
      manquantes: compta.manquantes?.total ?? 0,
      planInitialise: compta.planInitialise,
    },
    tresorerie: {
      kpis: tresorerieFull.kpis,
      alertes: (tresorerieFull.alertes || []).slice(0, 3),
    },
    fournisseurs: {
      stats: fournisseursFull.stats,
      alertes: (fournisseursFull.alertes || []).slice(0, 2),
    },
    conformite: {
      stats: conformiteFull.stats,
      prochaines: (conformiteFull.prochaines || []).slice(0, 3).map((e) => ({
        id: e.id || e._id,
        libelle: e.libelle,
        dateEcheance: e.dateEcheance,
        statutRaw: e.statutRaw,
        joursRestants: e.joursRestants,
        typeLabel: e.typeLabel,
      })),
      alertes: (conformiteFull.alertes || []).slice(0, 3),
    },
  };
}

export async function getFullDashboard(organizationId, userId) {
  await syncAlerts(organizationId, userId);

  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);

  const [
    clients,
    chantiersTotal,
    devisTotal,
    budgetAgg,
    depensesAgg,
    masseSalariale,
    graphDepenses,
    graphEncaissements,
    facturesPayeesAgg,
    facturesImpayeesAgg,
    facturesImpayeesCount,
    devisParStatut,
    chantiersActifs,
    facturesARelancer,
    demandesEnAttente,
    rapportsRecents,
    stocksAlerte,
    santeEntreprise,
    controlCenter,
    organization,
    pilotage,
  ] = await Promise.all([
    prisma.client.count({ where: { organizationId } }),
    prisma.chantier.count({ where: { organizationId } }),
    prisma.devis.count({ where: { organizationId } }),
    prisma.chantier.aggregate({
      where: { organizationId },
      _sum: { budget: true, depenses: true },
    }),
    prisma.depense.aggregate({
      where: { organizationId },
      _sum: { montant: true },
    }),
    prisma.equipeMember.aggregate({
      where: { organizationId, statut: "ACTIF" },
      _sum: { salaireTotal: true },
    }),
    getMonthlyGraphData(organizationId),
    getMonthlyEncaissements(organizationId),
    prisma.facture.aggregate({
      where: { organizationId, statut: "PAYEE" },
      _sum: { montantTTC: true },
    }),
    prisma.facture.aggregate({
      where: { organizationId, statut: { in: ["ENVOYEE", "IMPAYEE"] } },
      _sum: { montantTTC: true },
    }),
    prisma.facture.count({
      where: { organizationId, statut: { in: ["ENVOYEE", "IMPAYEE"] } },
    }),
    prisma.devis.groupBy({
      by: ["statut"],
      where: { organizationId },
      _count: true,
    }),
    prisma.chantier.findMany({
      where: {
        organizationId,
        statut: { in: ["EN_COURS", "EN_PREPARATION"] },
      },
      include: { client: { select: { nom: true } } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.facture.findMany({
      where: {
        organizationId,
        statut: { in: ["ENVOYEE", "IMPAYEE", "PARTIELLEMENT_PAYEE"] },
      },
      include: {
        client: { select: { nom: true } },
        chantier: { select: { nom: true } },
      },
      orderBy: { dateEcheance: "asc" },
      take: 6,
    }),
    prisma.demandeMateriel.count({
      where: { organizationId, statut: "EN_ATTENTE" },
    }),
    prisma.rapportJournalier.findMany({
      where: { organizationId },
      include: {
        chantier: { select: { nom: true } },
        auteur: { select: { nom: true, prenom: true } },
      },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.stockArticle.count({
      where: { organizationId, etat: { in: ["ALERTE", "RUPTURE"] } },
    }),
    computeHealthScoreEntreprise(organizationId),
    getControlCenter(organizationId, userId),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { nom: true, ville: true, pays: true },
    }),
    getPilotageWidgets(organizationId),
  ]);

  const budgetGlobal = budgetAgg._sum.budget || 0;
  const depensesChantiers = budgetAgg._sum.depenses || 0;
  const depensesTotal = depensesAgg._sum.montant || 0;
  const masse = masseSalariale._sum.salaireTotal || 0;
  const caEncaisse = facturesPayeesAgg._sum.montantTTC || 0;
  const caImpaye = facturesImpayeesAgg._sum.montantTTC || 0;
  const margeGlobale = caEncaisse - depensesTotal;

  const graphData = graphDepenses.map((d, i) => ({
    mois: d.mois,
    depenses: d.total,
    encaissements: graphEncaissements[i]?.encaissements || 0,
  }));

  const chantiersAvecScore = await Promise.all(
    chantiersActifs.map(async (c) => {
      const score = await computeHealthScoreChantier(c.id);
      const ratioBudget = c.budget > 0 ? Math.round((c.depenses / c.budget) * 100) : 0;
      return {
        id: c.id,
        nom: c.nom,
        client: c.client?.nom || "—",
        statut: CHANTIER_STATUT_LABEL[c.statut] || c.statut,
        avancement: c.avancementPhysique,
        budget: c.budget,
        depenses: c.depenses,
        ratioBudget,
        scoreSante: score?.score ?? null,
        dateFin: c.dateFin,
      };
    })
  );

  const warnings = chantiersAvecScore
    .filter((c) => c.ratioBudget >= 80)
    .map((c) => ({
      chantier: c.nom,
      chantierId: c.id,
      niveau: c.ratioBudget > 100 ? "dépassement" : "alerte",
      message:
        c.ratioBudget > 100
          ? `Budget dépassé (${c.ratioBudget} %)`
          : `Budget à ${c.ratioBudget} %`,
      ratioBudget: c.ratioBudget,
    }));

  const pipelineDevis = {
    enAttente: devisParStatut.find((d) => d.statut === "EN_ATTENTE")?._count || 0,
    envoyes: devisParStatut.find((d) => d.statut === "ENVOYE")?._count || 0,
    acceptes: devisParStatut.find((d) => d.statut === "ACCEPTE")?._count || 0,
    refuses: devisParStatut.find((d) => d.statut === "REFUSE")?._count || 0,
  };

  const facturesRelance = facturesARelancer.map((f) => {
    const echeance = f.dateEcheance ? new Date(f.dateEcheance) : null;
    const joursRetard = echeance
      ? Math.floor((now - echeance) / (1000 * 60 * 60 * 24))
      : null;
    const { netAPayer } = computeFactureNetAPayer(f);
    const resteDu = Math.max(0, netAPayer - (f.montantVerse || 0) - (f.montantAvoir || 0));
    return {
      id: f.id,
      numero: f.numero,
      client: f.client?.nom,
      chantier: f.chantier?.nom,
      montantTTC: f.montantTTC,
      resteDu: Math.round(resteDu),
      dateEcheance: f.dateEcheance,
      joursRetard,
      enRetard: joursRetard !== null && joursRetard > 0,
    };
  }).sort((a, b) => (b.enRetard ? 1 : 0) - (a.enRetard ? 1 : 0) || (b.resteDu || 0) - (a.resteDu || 0));

  const activiteTerrain = rapportsRecents.map((r) => ({
    id: r.id,
    type: "rapport",
    chantier: r.chantier?.nom,
    auteur: `${r.auteur?.prenom || ""} ${r.auteur?.nom || ""}`.trim(),
    detail: r.travauxRealises || `Avancement ${r.avancement}%`,
    date: r.date,
    ouvriersPresents: r.ouvriersPresents,
  }));

  await prisma.dashboardSnapshot.upsert({
    where: {
      organizationId_mois_annee: {
        organizationId,
        mois: now.getMonth() + 1,
        annee: now.getFullYear(),
      },
    },
    create: {
      organizationId,
      mois: now.getMonth() + 1,
      annee: now.getFullYear(),
      stats: {
        clients,
        chantiers: chantiersTotal,
        devis: devisTotal,
        budgetGlobal,
        masseSalariale: masse,
        caEncaisse,
        caImpaye,
      },
      graphData,
      warnings,
    },
    update: {
      stats: {
        clients,
        chantiers: chantiersTotal,
        devis: devisTotal,
        budgetGlobal,
        masseSalariale: masse,
        caEncaisse,
        caImpaye,
      },
      graphData,
      warnings,
    },
  });

  return {
    organization,
    stats: {
      clients,
      chantiers: chantiersTotal,
      chantiersActifs: chantiersActifs.length,
      devis: devisTotal,
      budgetGlobal,
      depensesTotal,
      depensesChantiers,
      masseSalariale: masse,
      caEncaisse,
      caImpaye,
      facturesImpayeesCount,
      margeGlobale,
      stocksAlerte,
      demandesMateriel: demandesEnAttente,
    },
    pipelineDevis,
    graphData,
    warnings,
    chantiersActifs: chantiersAvecScore,
    facturesARelancer: facturesRelance,
    activiteTerrain,
    santeEntreprise,
    actionsPrioritaires: controlCenter.actionsPrioritaires,
    previsionTresorerie: controlCenter.previsionTresorerie,
    topChantiersRentables: controlCenter.topChantiersRentables,
    pilotage,
  };
}
