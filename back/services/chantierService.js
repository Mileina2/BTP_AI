import prisma from "../config/prisma.js";
import { computeHealthScoreChantier } from "./healthScoreService.js";
import {
  CHANTIER_STATUT_LABEL,
  TYPE_TRAVAUX_LABEL,
  toLegacy,
  getOrgId,
} from "../utils/legacyMap.js";
import {
  chantierScopeWhere,
  sanitizeChantierDetail,
  isManagement,
  isClientPortal,
} from "../utils/accessControl.js";

export function formatChantierList(c) {
  const budget = c.budget ?? 0;
  const depenses = c.depenses ?? 0;
  const ratioBudget = budget > 0 ? Math.round((depenses / budget) * 100) : 0;
  return toLegacy({
    ...c,
    statut: CHANTIER_STATUT_LABEL[c.statut] || c.statut,
    statutRaw: c.statut,
    typeTravaux: TYPE_TRAVAUX_LABEL[c.typeTravaux] || c.typeTravaux,
    client: c.client?.nom || "—",
    clientId: c.clientId,
    user: c.ownerId,
    indicateurs: {
      avancementPhysique: c.avancementPhysique ?? 0,
      avancementFinancier: c.avancementFinancier ?? 0,
    },
    budgetRestant: budget - depenses,
    ratioBudget,
    counts: c._count
      ? {
          devis: c._count.devis,
          factures: c._count.factures,
          depenses: c._count.depenseItems,
          equipe: c._count.equipes,
        }
      : undefined,
  });
}

export async function getChantiersOverview(user) {
  const chantiers = await prisma.chantier.findMany({
    where: chantierScopeWhere(user),
    include: {
      client: { select: { id: true, nom: true, telephone: true } },
      _count: {
        select: { devis: true, factures: true, depenseItems: true, equipes: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  let budgetTotal = 0;
  let depensesTotal = 0;
  let enCours = 0;
  let enPreparation = 0;
  let termines = 0;
  let alertesBudget = 0;

  chantiers.forEach((c) => {
    budgetTotal += c.budget;
    depensesTotal += c.depenses;
    if (c.statut === "EN_COURS") enCours++;
    if (c.statut === "EN_PREPARATION") enPreparation++;
    if (c.statut === "TERMINE") termines++;
    if (c.budget > 0 && c.depenses / c.budget >= 0.8) alertesBudget++;
  });

  return {
    stats: {
      total: chantiers.length,
      enCours,
      enPreparation,
      termines,
      budgetTotal,
      depensesTotal,
      budgetRestant: budgetTotal - depensesTotal,
      alertesBudget,
    },
    items: chantiers.map(formatChantierList),
  };
}

export async function getChantierDetail(user, chantierId) {
  const organizationId = getOrgId(user);
  const chantier = await prisma.chantier.findFirst({
    where: { id: chantierId, ...chantierScopeWhere(user) },
    include: {
      client: true,
      chefChantier: { select: { id: true, email: true, nom: true, prenom: true } },
      _count: {
        select: {
          devis: true,
          factures: true,
          depenseItems: true,
          equipes: true,
          stocks: true,
          rapports: true,
          demandes: true,
          timeline: true,
          documents: true,
        },
      },
      ...(isManagement(user) || !isClientPortal(user)
        ? {
            devis: {
              orderBy: { createdAt: "desc" },
              take: 5,
              select: { id: true, numero: true, montantTTC: true, statut: true, dateEmission: true },
            },
            factures: {
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                numero: true,
                montantTTC: true,
                statut: true,
                dateEmission: true,
                dateEcheance: true,
              },
            },
            depenseItems: {
              orderBy: { date: "desc" },
              take: 8,
              select: { id: true, libelle: true, montant: true, categorie: true, date: true },
            },
            equipes: {
              where: { statut: "ACTIF" },
              select: { id: true, nom: true, role: true, salaireTotal: true },
            },
            demandes: {
              where: { statut: "EN_ATTENTE" },
              take: 5,
              orderBy: { createdAt: "desc" },
            },
          }
        : {}),
      rapports: {
        orderBy: { date: "desc" },
        take: 5,
        include: { auteur: { select: { nom: true, prenom: true } } },
      },
    },
  });

  if (!chantier) return null;

  const facturesImpayees =
    isManagement(user)
      ? await prisma.facture.aggregate({
          where: {
            chantierId,
            statut: { in: ["ENVOYEE", "IMPAYEE"] },
          },
          _sum: { montantTTC: true },
          _count: true,
        })
      : { _sum: { montantTTC: 0 }, _count: 0 };

  const score = isManagement(user)
    ? await computeHealthScoreChantier(chantierId, organizationId)
    : null;
  const base = formatChantierList(chantier);

  const detail = {
    ...base,
    description: chantier.description,
    zone: chantier.zone,
    typeTravauxRaw: chantier.typeTravaux,
    dateDebut: chantier.dateDebut,
    dateFin: chantier.dateFin,
    counts: {
      devis: chantier._count.devis,
      factures: chantier._count.factures,
      depenses: chantier._count.depenseItems,
      equipe: chantier._count.equipes,
      stock: chantier._count.stocks,
      rapports: chantier._count.rapports,
      demandes: chantier._count.demandes,
      timeline: chantier._count.timeline,
      documents: chantier._count.documents,
    },
    finances: {
      budget: chantier.budget,
      depenses: chantier.depenses,
      restant: chantier.budget - chantier.depenses,
      ratioBudget: base.ratioBudget,
      facturesImpayees: facturesImpayees._sum.montantTTC || 0,
      facturesImpayeesCount: facturesImpayees._count,
      masseSalariale: (chantier.equipes || []).reduce((s, e) => s + e.salaireTotal, 0),
    },
    scoreSante: score,
    chefChantier: chantier.chefChantier
      ? {
          id: chantier.chefChantier.id,
          email: chantier.chefChantier.email,
          nom: [chantier.chefChantier.prenom, chantier.chefChantier.nom].filter(Boolean).join(" "),
        }
      : null,
    devis: (chantier.devis || []).map((d) => ({
      ...d,
      statut: d.statut,
    })),
    factures: chantier.factures || [],
    depensesRecentes: chantier.depenseItems || [],
    equipe: chantier.equipes || [],
    rapports: chantier.rapports.map((r) => ({
      id: r.id,
      date: r.date,
      avancement: r.avancement,
      travaux: r.travauxRealises,
      auteur: `${r.auteur?.prenom || ""} ${r.auteur?.nom || ""}`.trim(),
      presents: r.ouvriersPresents,
    })),
    demandesMateriel: chantier.demandes || [],
  };

  return sanitizeChantierDetail(detail, user);
}
