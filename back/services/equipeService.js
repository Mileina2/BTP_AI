import prisma from "../config/prisma.js";
import { toLegacy } from "../utils/legacyMap.js";
import { syncChantierDepenses } from "./budgetService.js";

const STATUT_LABEL = { ACTIF: "Actif", INACTIF: "Inactif", ARCHIVE: "Archivé" };
const CONTRAT_LABEL = {
  CDI: "CDI",
  CDD: "CDD",
  JOURNALIER: "Journalier",
  SOUS_TRAITANT: "Sous-traitant",
};
const CONTRAT_FROM_LABEL = {
  CDI: "CDI",
  CDD: "CDD",
  Journalier: "JOURNALIER",
  "Sous-traitant": "SOUS_TRAITANT",
};

export function computeHeuresMensuelles(heuresParJour = 8, joursParSemaine = 5) {
  return Math.round(heuresParJour * joursParSemaine * 4.33 * 10) / 10;
}

export function computeSalaireTotal(m) {
  const heures = m.heuresMensuelles ?? computeHeuresMensuelles(m.heuresParJour, m.joursParSemaine);
  return Math.max(
    0,
    Math.round(((m.tauxHoraire || 0) * heures + (m.prime || 0) + (m.bonus || 0) - (m.retenue || 0)) * 100) / 100
  );
}

export function parseMembreInput(body) {
  const heuresParJour = Number(body.heuresParJour) || 8;
  const joursParSemaine = Number(body.joursParSemaine) || 5;
  const heuresMensuelles = body.heuresMensuelles
    ? Number(body.heuresMensuelles)
    : computeHeuresMensuelles(heuresParJour, joursParSemaine);

  const base = {
    nom: body.nom?.trim(),
    role: body.role?.trim(),
    chantierId: body.chantier || body.chantierId || null,
    typeContrat: CONTRAT_FROM_LABEL[body.typeContrat] || body.typeContrat || "JOURNALIER",
    tauxHoraire: Number(body.tauxHoraire) || 0,
    heuresParJour,
    joursParSemaine,
    heuresMensuelles,
    prime: Number(body.prime) || 0,
    bonus: Number(body.bonus) || 0,
    retenue: Number(body.retenue) || 0,
  };

  if (body.dateEmbauche) {
    base.dateEmbauche = new Date(body.dateEmbauche);
  }
  if (body.dateFinContrat !== undefined && body.dateFinContrat !== "") {
    base.dateFinContrat = new Date(body.dateFinContrat);
  } else if (body.dateFinContrat === "" || body.dateFinContrat === null) {
    base.dateFinContrat = null;
  }

  if (body.statut) {
    const s = String(body.statut).toUpperCase();
    if (s === "ACTIF" || s === "INACTIF" || s === "ARCHIVE") base.statut = s;
    else if (body.statut === "Actif") base.statut = "ACTIF";
    else if (body.statut === "Inactif") base.statut = "INACTIF";
    else if (body.statut === "Archivé") base.statut = "ARCHIVE";
  }

  base.salaireTotal = computeSalaireTotal(base);
  return base;
}

export function formatEquipe(m) {
  return toLegacy({
    ...m,
    statut: STATUT_LABEL[m.statut] || m.statut,
    typeContrat: CONTRAT_LABEL[m.typeContrat] || m.typeContrat,
    chantier: m.chantier
      ? { _id: m.chantier.id, id: m.chantier.id, nom: m.chantier.nom, statut: m.chantier.statut }
      : m.chantierId
        ? { _id: m.chantierId, id: m.chantierId }
        : null,
  });
}

function depenseLibelle(nom, role) {
  return `Salaire ${nom} (${role})`;
}

export async function syncSalaireDepense(organizationId, chantierId, nom, role, montant) {
  if (!chantierId) return;
  const libelle = depenseLibelle(nom, role);
  const existing = await prisma.depense.findFirst({
    where: { organizationId, chantierId, libelle },
  });
  if (existing) {
    await prisma.depense.update({
      where: { id: existing.id },
      data: { montant, fournisseur: nom },
    });
  } else {
    await prisma.depense.create({
      data: {
        organizationId,
        chantierId,
        libelle,
        categorie: "Main-d'œuvre",
        montant,
        fournisseur: nom,
      },
    });
  }
  await syncChantierDepenses(chantierId);
}

const memberInclude = {
  chantier: { select: { id: true, nom: true, statut: true, ville: true } },
};

export async function getEquipeOverview(organizationId) {
  const membres = await prisma.equipeMember.findMany({
    where: { organizationId },
    include: memberInclude,
    orderBy: { createdAt: "desc" },
  });

  const actifs = membres.filter((m) => m.statut === "ACTIF");
  const masseSalariale = actifs.reduce((s, m) => s + (m.salaireTotal || 0), 0);
  const heuresTotales = actifs.reduce((s, m) => s + (m.heuresMensuelles || 0), 0);
  const chantiersIds = new Set(actifs.map((m) => m.chantierId).filter(Boolean));

  const parChantier = {};
  actifs.forEach((m) => {
    if (!m.chantierId) return;
    if (!parChantier[m.chantierId]) {
      parChantier[m.chantierId] = {
        chantierId: m.chantierId,
        nom: m.chantier?.nom || "Chantier",
        membres: 0,
        masseSalariale: 0,
        heures: 0,
      };
    }
    parChantier[m.chantierId].membres += 1;
    parChantier[m.chantierId].masseSalariale += m.salaireTotal || 0;
    parChantier[m.chantierId].heures += m.heuresMensuelles || 0;
  });

  return {
    stats: {
      totalMembres: membres.length,
      actifs: actifs.length,
      inactifs: membres.filter((m) => m.statut === "INACTIF").length,
      masseSalariale,
      heuresTotales,
      moyenneHoraire: heuresTotales > 0 ? masseSalariale / heuresTotales : 0,
      chantiersCouvert: chantiersIds.size,
    },
    chantiers: Object.values(parChantier).sort((a, b) => b.masseSalariale - a.masseSalariale),
    items: membres.map(formatEquipe),
  };
}

export async function buildAnalyseMasseSalariale(organizationId, chantierId) {
  const chantier = await prisma.chantier.findFirst({
    where: { id: chantierId, organizationId },
    select: { id: true, nom: true },
  });
  if (!chantier) return null;

  const equipe = await prisma.equipeMember.findMany({
    where: { organizationId, chantierId, statut: "ACTIF" },
    include: memberInclude,
  });
  if (!equipe.length) return { empty: true, chantier };

  const totalSalaires = equipe.reduce((s, e) => s + (e.salaireTotal || 0), 0);
  const totalHeures = equipe.reduce((s, e) => s + (e.heuresMensuelles || 0), 0);
  const moyenneHoraire = totalHeures > 0 ? totalSalaires / totalHeures : 0;

  const repartition = Object.values(
    equipe.reduce((acc, e) => {
      if (!acc[e.role]) acc[e.role] = { role: e.role, total: 0, membres: 0 };
      acc[e.role].total += e.salaireTotal || 0;
      acc[e.role].membres += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  return {
    chantierId,
    chantierNom: chantier.nom,
    totalSalaires,
    totalHeures,
    moyenneHoraire,
    repartition,
    membres: equipe.length,
  };
}

export async function getMembresForExport(organizationId, chantierId) {
  const chantier = await prisma.chantier.findFirst({
    where: { id: chantierId, organizationId },
    select: { id: true, nom: true, ville: true },
  });
  if (!chantier) return null;

  const membres = await prisma.equipeMember.findMany({
    where: { organizationId, chantierId, statut: "ACTIF" },
    orderBy: { nom: "asc" },
  });

  return { chantier, membres };
}
