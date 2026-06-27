import prisma from "../config/prisma.js";
import { syncAlerts, getActiveAlerts } from "./alertService.js";
import {
  computeHealthScoreEntreprise,
  computeHealthScoreChantier,
  getChantiersRentabilite,
  getPrevisionTresorerie,
} from "./healthScoreService.js";

const PRIORITE_ORDER = { CRITIQUE: 0, HAUTE: 1, MOYENNE: 2, BASSE: 3 };

export async function getControlCenter(organizationId, userId) {
  await syncAlerts(organizationId, userId);

  const [
    alerts,
    santeEntreprise,
    previsionTresorerie,
    chantiersRentables,
    demandesEnAttente,
    rapportsRecents,
  ] = await Promise.all([
    getActiveAlerts(organizationId, 10),
    computeHealthScoreEntreprise(organizationId),
    getPrevisionTresorerie(organizationId),
    getChantiersRentabilite(organizationId),
    prisma.demandeMateriel.count({
      where: { organizationId, statut: "EN_ATTENTE" },
    }),
    prisma.rapportJournalier.count({
      where: {
        organizationId,
        date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const actionsPrioritaires = alerts
    .sort((a, b) => (PRIORITE_ORDER[a.priorite] ?? 9) - (PRIORITE_ORDER[b.priorite] ?? 9))
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      type: a.type,
      priorite: a.priorite,
      titre: a.titre,
      message: a.message,
      actionLabel: a.actionLabel,
      actionUrl: a.actionUrl,
      chantier: a.chantier?.nom,
    }));

  return {
    santeEntreprise,
    previsionTresorerie,
    topChantiersRentables: chantiersRentables.slice(0, 5),
    actionsPrioritaires,
    indicateurs: {
      alertesActives: alerts.length,
      demandesMateriel: demandesEnAttente,
      rapportsAujourdhui: rapportsRecents,
    },
  };
}

export async function getAllChantierScores(organizationId) {
  const chantiers = await prisma.chantier.findMany({
    where: { organizationId },
    select: { id: true },
  });

  const scores = await Promise.all(
    chantiers.map((c) => computeHealthScoreChantier(c.id, organizationId))
  );

  return scores.filter(Boolean).sort((a, b) => a.score - b.score);
}
