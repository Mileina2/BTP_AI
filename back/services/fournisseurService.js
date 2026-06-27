import prisma from "../config/prisma.js";
import { genererNumero, toLegacy } from "../utils/legacyMap.js";
import { syncChantierDepenses } from "./budgetService.js";
const ENGAGEMENT_STATUT_LABEL = {
  DEVIS: "Devis reçu",
  COMMANDE: "Commandé",
  LIVRE: "Livré",
  PAYE: "Payé",
  ANNULE: "Annulé",
};

function daysUntil(date, now = new Date()) {
  if (!date) return null;
  return Math.ceil((new Date(date).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
}

function fluxMeta(date, now = new Date()) {
  const jours = daysUntil(date, now);
  return {
    enRetard: jours !== null && jours < 0,
    joursRestants: jours,
  };
}

function escapeCsv(val) {
  const s = String(val ?? "");
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatFournisseur(f) {
  return toLegacy({
    ...f,
    nbEngagements: f._count?.engagements ?? f.engagements?.length ?? 0,
    detteEstimee: f.detteEstimee ?? 0,
  });
}

export async function getFournisseursOverview(organizationId) {
  const now = new Date();
  const [fournisseurs, engagements, depensesImpayees] = await Promise.all([
    prisma.fournisseur.findMany({
      where: { organizationId },
      include: {
        _count: { select: { engagements: true, depenses: true } },
        engagements: {
          where: { statut: { in: ["DEVIS", "COMMANDE", "LIVRE"] } },
          select: { montantTTC: true, montant: true },
        },
        depenses: {
          where: { paye: false },
          select: { montant: true },
        },
      },
      orderBy: { nom: "asc" },
    }),
    prisma.engagementFournisseur.findMany({
      where: { organizationId, statut: { notIn: ["ANNULE"] } },
      include: {
        fournisseur: { select: { id: true, nom: true } },
        chantier: { select: { id: true, nom: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.depense.findMany({
      where: { organizationId, paye: false },
      include: {
        chantier: { select: { id: true, nom: true } },
        fournisseurRef: { select: { id: true, nom: true } },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  let detteEngagements = 0;
  let detteDepenses = depensesImpayees.reduce((s, d) => s + (d.montant || 0), 0);
  const depensesOrphelines = depensesImpayees.filter((d) => !d.fournisseurId);

  const items = fournisseurs.map((f) => {
    const detteEng = f.engagements.reduce((s, e) => s + (e.montantTTC || e.montant || 0), 0);
    const detteDep = f.depenses.reduce((s, d) => s + (d.montant || 0), 0);
    detteEngagements += detteEng;
    return formatFournisseur({
      ...f,
      detteEngagements: Math.round(detteEng),
      detteDepenses: Math.round(detteDep),
      detteEstimee: Math.round(detteEng + detteDep),
    });
  });

  const engagementsEnriched = engagements.map((e) => {
    const meta = fluxMeta(e.dateEcheance || e.dateDevis, now);
    return toLegacy({
      ...e,
      statut: ENGAGEMENT_STATUT_LABEL[e.statut] || e.statut,
      statutRaw: e.statut,
      fournisseurNom: e.fournisseur?.nom,
      fournisseurId: e.fournisseurId,
      chantierNom: e.chantier?.nom,
      chantierId: e.chantierId,
      ...meta,
      linkPage: "budget",
    });
  });

  const depensesEnriched = depensesImpayees.map((d) => {
    const meta = fluxMeta(d.dateEcheance || d.date, now);
    return toLegacy({
      ...d,
      chantierNom: d.chantier?.nom,
      chantierId: d.chantierId,
      fournisseurNom: d.fournisseurRef?.nom || d.fournisseur,
      fournisseurId: d.fournisseurId,
      orpheline: !d.fournisseurId,
      ...meta,
      linkPage: "budget",
    });
  });

  const alertes = [];
  if (depensesOrphelines.length > 0) {
    alertes.push({
      type: "warning",
      titre: "Dépenses non rattachées",
      message: `${depensesOrphelines.length} dépense(s) budget sans fournisseur — rattachez-les pour un suivi fiable.`,
    });
  }
  const engagementsRetard = engagementsEnriched.filter((e) => e.enRetard && !["PAYE", "ANNULE"].includes(e.statutRaw));
  if (engagementsRetard.length > 0) {
    alertes.push({
      type: "warning",
      titre: "Engagements en retard",
      message: `${engagementsRetard.length} bon(s) de commande / devis avec échéance dépassée.`,
    });
  }
  if (detteDepenses > detteEngagements && detteDepenses > 0) {
    alertes.push({
      type: "info",
      titre: "Dette budget dominante",
      message: "La majorité de vos dettes fournisseurs provient du budget chantier (non encore formalisée en BC).",
    });
  }

  return {
    stats: {
      totalFournisseurs: fournisseurs.filter((f) => f.actif).length,
      detteEngagements: Math.round(detteEngagements),
      detteDepenses: Math.round(detteDepenses),
      detteTotale: Math.round(detteEngagements + detteDepenses),
      engagementsEnCours: engagements.filter((e) => !["PAYE", "ANNULE"].includes(e.statut)).length,
      depensesOrphelines: depensesOrphelines.length,
      depensesEnRetard: depensesEnriched.filter((d) => d.enRetard).length,
    },
    fournisseurs: items,
    engagements: engagementsEnriched,
    depensesImpayees: depensesEnriched,
    depensesOrphelines: depensesEnriched.filter((d) => d.orpheline),
    alertes,
    generatedAt: new Date().toISOString(),
  };
}

export async function createFournisseur(organizationId, body) {
  if (!body.nom?.trim()) throw new Error("Nom du fournisseur requis.");
  return prisma.fournisseur.create({
    data: {
      organizationId,
      nom: body.nom.trim(),
      contact: body.contact?.trim() || null,
      telephone: body.telephone?.trim() || null,
      email: body.email?.trim() || null,
      adresse: body.adresse?.trim() || null,
      rccm: body.rccm?.trim() || null,
      categorie: body.categorie?.trim() || "Sous-traitance",
      notes: body.notes?.trim() || null,
    },
  });
}

export async function updateFournisseur(organizationId, id, body) {
  const existing = await prisma.fournisseur.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Fournisseur introuvable.");
  return prisma.fournisseur.update({
    where: { id },
    data: {
      nom: body.nom?.trim() ?? existing.nom,
      contact: body.contact !== undefined ? body.contact?.trim() || null : undefined,
      telephone: body.telephone !== undefined ? body.telephone?.trim() || null : undefined,
      email: body.email !== undefined ? body.email?.trim() || null : undefined,
      adresse: body.adresse !== undefined ? body.adresse?.trim() || null : undefined,
      rccm: body.rccm !== undefined ? body.rccm?.trim() || null : undefined,
      categorie: body.categorie?.trim() ?? undefined,
      notes: body.notes !== undefined ? body.notes?.trim() || null : undefined,
      actif: body.actif !== undefined ? Boolean(body.actif) : undefined,
    },
  });
}

export async function deleteFournisseur(organizationId, id) {
  const existing = await prisma.fournisseur.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Fournisseur introuvable.");
  await prisma.fournisseur.delete({ where: { id } });
}

export async function createEngagement(organizationId, body) {
  const { fournisseurId, chantierId, objet, montant, tva, statut, dateEcheance, referenceDevis } = body;
  if (!fournisseurId || !objet?.trim()) throw new Error("Fournisseur et objet requis.");

  const fournisseur = await prisma.fournisseur.findFirst({ where: { id: fournisseurId, organizationId } });
  if (!fournisseur) throw new Error("Fournisseur introuvable.");

  const ht = Number(montant) || 0;
  const tvaRate = Number(tva) ?? 18;
  const ttc = ht * (1 + tvaRate / 100);
  const count = await prisma.engagementFournisseur.count({ where: { organizationId } });
  const numero = await genererNumero("BC", count);

  const statutEnum = ["DEVIS", "COMMANDE", "LIVRE", "PAYE", "ANNULE"].includes(statut) ? statut : "DEVIS";

  return prisma.engagementFournisseur.create({
    data: {
      organizationId,
      fournisseurId,
      chantierId: chantierId || null,
      numero,
      objet: objet.trim(),
      montant: ht,
      tva: tvaRate,
      montantTTC: Math.round(ttc),
      statut: statutEnum,
      dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
      referenceDevis: referenceDevis?.trim() || null,
    },
    include: { fournisseur: true, chantier: { select: { nom: true } } },
  });
}

export async function updateEngagement(organizationId, id, body) {
  const existing = await prisma.engagementFournisseur.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Engagement introuvable.");

  const data = {};
  if (body.statut && ["DEVIS", "COMMANDE", "LIVRE", "PAYE", "ANNULE"].includes(body.statut)) {
    data.statut = body.statut;
  }
  if (body.objet) data.objet = body.objet.trim();
  if (body.montant !== undefined) {
    data.montant = Number(body.montant) || 0;
    const tvaRate = body.tva ?? existing.tva ?? 18;
    data.tva = tvaRate;
    data.montantTTC = Math.round(data.montant * (1 + tvaRate / 100));
  }
  if (body.dateEcheance !== undefined) data.dateEcheance = body.dateEcheance ? new Date(body.dateEcheance) : null;

  return prisma.engagementFournisseur.update({
    where: { id },
    data,
    include: { fournisseur: true, chantier: { select: { nom: true } } },
  });
}

export async function compareEngagements(organizationId, { objet } = {}) {
  const where = { organizationId, statut: "DEVIS" };
  if (objet?.trim()) where.objet = { contains: objet.trim(), mode: "insensitive" };

  const items = await prisma.engagementFournisseur.findMany({
    where,
    include: { fournisseur: { select: { nom: true } } },
    orderBy: { montantTTC: "asc" },
  });

  const groups = {};
  for (const e of items) {
    const key = e.objet.toLowerCase().slice(0, 40);
    if (!groups[key]) groups[key] = [];
    groups[key].push({
      id: e.id,
      fournisseur: e.fournisseur.nom,
      montantTTC: e.montantTTC,
      numero: e.numero,
    });
  }

  return Object.entries(groups)
    .filter(([, list]) => list.length >= 1)
    .map(([key, list]) => ({
      objet: key,
      offres: list,
      moinsDisant: list[0],
      ecart: list.length > 1 ? list[list.length - 1].montantTTC - list[0].montantTTC : 0,
    }));
}

export async function linkDepenseFournisseur(organizationId, depenseId, fournisseurId) {
  const depense = await prisma.depense.findFirst({ where: { id: depenseId, organizationId } });
  if (!depense) throw new Error("Dépense introuvable.");

  let fournisseurNom = depense.fournisseur;
  if (fournisseurId) {
    const f = await prisma.fournisseur.findFirst({ where: { id: fournisseurId, organizationId } });
    if (!f) throw new Error("Fournisseur introuvable.");
    fournisseurNom = f.nom;
  }

  const updated = await prisma.depense.update({
    where: { id: depenseId },
    data: {
      fournisseurId: fournisseurId || null,
      fournisseur: fournisseurNom,
    },
  });
  await syncChantierDepenses(updated.chantierId);
  return updated;
}

export async function markDepensePayee(organizationId, depenseId) {
  const depense = await prisma.depense.findFirst({ where: { id: depenseId, organizationId } });
  if (!depense) throw new Error("Dépense introuvable.");
  const updated = await prisma.depense.update({
    where: { id: depenseId },
    data: { paye: true },
  });
  await syncChantierDepenses(updated.chantierId);
  return updated;
}

export function buildFournisseurCsv(data) {
  const lines = ["Type;Référence;Libellé;Fournisseur;Chantier;Échéance;Montant (FCFA);Statut;Retard"];

  for (const e of data.engagements || []) {
    if (["PAYE", "ANNULE"].includes(e.statutRaw)) continue;
    lines.push(
      [
        "Engagement",
        e.numero,
        e.objet,
        e.fournisseurNom,
        e.chantierNom,
        e.dateEcheance ? new Date(e.dateEcheance).toLocaleDateString("fr-FR") : "—",
        e.montantTTC || e.montant,
        e.statut,
        e.enRetard ? "Oui" : "Non",
      ]
        .map(escapeCsv)
        .join(";")
    );
  }

  for (const d of data.depensesImpayees || []) {
    lines.push(
      [
        "Dépense budget",
        d.id,
        d.libelle,
        d.fournisseurNom || "—",
        d.chantierNom,
        d.dateEcheance ? new Date(d.dateEcheance).toLocaleDateString("fr-FR") : "—",
        d.montant,
        d.paye ? "Payée" : "Impayée",
        d.enRetard ? "Oui" : "Non",
      ]
        .map(escapeCsv)
        .join(";")
    );
  }

  return lines.join("\n");
}
