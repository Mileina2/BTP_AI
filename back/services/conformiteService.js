import prisma from "../config/prisma.js";
import { toLegacy } from "../utils/legacyMap.js";

const TYPE_LABEL = {
  CNPS: "CNPS — Cotisations sociales",
  DGI_TVA: "DGI — Déclaration TVA",
  ASSURANCE_RC: "Assurance RC Pro",
  ASSURANCE_DECENNALE: "Assurance décennale",
  RCCM: "RCCM — Registre commerce",
  RETENUE_GARANTIE: "Retenue de garantie",
  AUTRE: "Autre obligation",
};

const STATUT_LABEL = {
  A_VENIR: "À venir",
  FAIT: "Effectué",
  EN_RETARD: "En retard",
};

function refreshStatut(e, now = new Date()) {
  if (e.statut === "FAIT") return "FAIT";
  return new Date(e.dateEcheance) < now ? "EN_RETARD" : "A_VENIR";
}

function escapeCsv(val) {
  const s = String(val ?? "");
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function resolveLink(e) {
  if (e.type === "RETENUE_GARANTIE" && e.factureId) {
    return { linkPage: "factures", linkId: e.factureId };
  }
  if (["ASSURANCE_RC", "ASSURANCE_DECENNALE", "RCCM"].includes(e.type)) {
    return { linkPage: "entreprise" };
  }
  if (e.chantierId) {
    return { linkPage: "budget", linkId: e.chantierId };
  }
  return { linkPage: null };
}

export async function seedConformiteDefaults(organizationId) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) return;

  const existing = await prisma.echeanceConformite.count({ where: { organizationId } });
  if (existing > 0) return;

  const now = new Date();
  const year = now.getFullYear();
  const defaults = [];

  if (org.assuranceRc) {
    defaults.push({
      organizationId,
      type: "ASSURANCE_RC",
      libelle: `Renouvellement RC Pro — ${org.assuranceRc}`,
      dateEcheance: new Date(year, 11, 31),
      rappelJours: 30,
    });
  }
  if (org.assuranceDecennale) {
    defaults.push({
      organizationId,
      type: "ASSURANCE_DECENNALE",
      libelle: `Renouvellement décennale — ${org.assuranceDecennale}`,
      dateEcheance: new Date(year, 11, 31),
      rappelJours: 30,
    });
  }
  if (org.rccm) {
    defaults.push({
      organizationId,
      type: "RCCM",
      libelle: `RCCM ${org.rccm} — vérification annuelle`,
      dateEcheance: new Date(year, 5, 30),
      rappelJours: 15,
    });
  }

  const trimestre = Math.floor(now.getMonth() / 3);
  const finTrimestre = new Date(year, trimestre * 3 + 3, 0);
  defaults.push({
    organizationId,
    type: "DGI_TVA",
    libelle: `Déclaration TVA T${trimestre + 1} ${year}`,
    dateEcheance: finTrimestre,
    rappelJours: 7,
    recurrenceMois: 3,
  });

  defaults.push({
    organizationId,
    type: "CNPS",
    libelle: `Déclaration CNPS — ${now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
    dateEcheance: new Date(year, now.getMonth() + 1, 0),
    rappelJours: 5,
    recurrenceMois: 1,
  });

  if (defaults.length) {
    await prisma.echeanceConformite.createMany({ data: defaults });
  }
}

export async function syncRetenuesGarantie(organizationId) {
  const factures = await prisma.facture.findMany({
    where: { organizationId, retenueGarantie: { gt: 0 } },
  });

  for (const f of factures) {
    const montantRetenue = (f.montantTTC * f.retenueGarantie) / 100;
    const exists = await prisma.echeanceConformite.findFirst({
      where: { organizationId, factureId: f.id, type: "RETENUE_GARANTIE" },
    });
    if (exists) continue;

    const echeance = f.dateEcheance ? new Date(f.dateEcheance) : new Date();
    echeance.setMonth(echeance.getMonth() + 12);

    await prisma.echeanceConformite.create({
      data: {
        organizationId,
        type: "RETENUE_GARANTIE",
        libelle: `Retenue garantie ${f.retenueGarantie}% — facture ${f.numero}`,
        dateEcheance: echeance,
        montantEstime: Math.round(montantRetenue),
        chantierId: f.chantierId,
        factureId: f.id,
        rappelJours: 15,
      },
    });
  }
}

export async function getConformiteOverview(organizationId) {
  await seedConformiteDefaults(organizationId);
  await syncRetenuesGarantie(organizationId);

  const now = new Date();
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  const echeances = await prisma.echeanceConformite.findMany({
    where: { organizationId },
    include: { chantier: { select: { nom: true } } },
    orderBy: { dateEcheance: "asc" },
  });

  for (const e of echeances) {
    const statut = refreshStatut(e, now);
    if (statut !== e.statut) {
      await prisma.echeanceConformite.update({ where: { id: e.id }, data: { statut } });
      e.statut = statut;
    }
  }

  const items = echeances.map((e) => {
    const link = resolveLink(e);
    return toLegacy({
      ...e,
      typeLabel: TYPE_LABEL[e.type] || e.type,
      statut: STATUT_LABEL[e.statut] || e.statut,
      statutRaw: e.statut,
      chantierNom: e.chantier?.nom,
      chantierId: e.chantierId,
      factureId: e.factureId,
      joursRestants: Math.ceil((new Date(e.dateEcheance) - now) / 86400000),
      ...link,
    });
  });

  const enRetard = items.filter((e) => e.statutRaw === "EN_RETARD");
  const sous7j = items.filter((e) => e.statutRaw === "A_VENIR" && new Date(e.dateEcheance) <= in7);
  const sous30j = items.filter((e) => e.statutRaw === "A_VENIR" && new Date(e.dateEcheance) <= in30);

  const actives = items.filter((e) => e.statutRaw !== "FAIT");
  const historique = items.filter((e) => e.statutRaw === "FAIT").slice(-15).reverse();
  const prochaines = [...actives].sort((a, b) => new Date(a.dateEcheance) - new Date(b.dateEcheance));
  const montantActif = actives.reduce((s, e) => s + (e.montantEstime || 0), 0);
  const montantRetard = enRetard.reduce((s, e) => s + (e.montantEstime || 0), 0);

  return {
    norme: "Obligations PME BTP — Côte d'Ivoire / OHADA",
    stats: {
      total: items.length,
      actives: actives.length,
      enRetard: enRetard.length,
      sous7j: sous7j.length,
      sous30j: sous30j.length,
      fait: items.filter((e) => e.statutRaw === "FAIT").length,
      montantActif: Math.round(montantActif),
      montantRetard: Math.round(montantRetard),
    },
    echeances: items,
    prochaines,
    historique,
    alertes: [
      ...enRetard.map((e) => ({
        type: "critical",
        titre: e.typeLabel,
        message: `${e.libelle} — en retard`,
        id: e.id,
      })),
      ...sous7j
        .filter((e) => e.statutRaw !== "EN_RETARD")
        .slice(0, 5)
        .map((e) => ({
          type: "warning",
          titre: e.typeLabel,
          message: `${e.libelle} — échéance sous 7 jours`,
          id: e.id,
        })),
    ],
    parType: Object.keys(TYPE_LABEL).map((type) => ({
      type,
      label: TYPE_LABEL[type],
      count: actives.filter((e) => e.type === type).length,
      total: items.filter((e) => e.type === type).length,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export async function createEcheance(organizationId, body) {
  const { type, libelle, dateEcheance, montantEstime, chantierId, rappelJours, notes, recurrenceMois } = body;
  if (!libelle?.trim() || !dateEcheance) throw new Error("Libellé et date d'échéance requis.");

  const typeEnum = Object.keys(TYPE_LABEL).includes(type) ? type : "AUTRE";

  return prisma.echeanceConformite.create({
    data: {
      organizationId,
      type: typeEnum,
      libelle: libelle.trim(),
      dateEcheance: new Date(dateEcheance),
      montantEstime: montantEstime ? Number(montantEstime) : null,
      chantierId: chantierId || null,
      rappelJours: Number(rappelJours) || 7,
      notes: notes?.trim() || null,
      recurrenceMois: recurrenceMois ? Number(recurrenceMois) : null,
    },
  });
}

export async function updateEcheance(organizationId, id, body) {
  const existing = await prisma.echeanceConformite.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Échéance introuvable.");

  const data = {};
  if (body.libelle) data.libelle = body.libelle.trim();
  if (body.dateEcheance) data.dateEcheance = new Date(body.dateEcheance);
  if (body.montantEstime !== undefined) data.montantEstime = body.montantEstime ? Number(body.montantEstime) : null;
  if (body.statut === "FAIT") data.statut = "FAIT";
  else if (body.statut === "A_VENIR") data.statut = "A_VENIR";
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

  return prisma.echeanceConformite.update({ where: { id }, data });
}

export async function deleteEcheance(organizationId, id) {
  const existing = await prisma.echeanceConformite.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Échéance introuvable.");
  await prisma.echeanceConformite.delete({ where: { id } });
}

export async function markEcheanceDone(organizationId, id) {
  const existing = await prisma.echeanceConformite.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Échéance introuvable.");

  await prisma.echeanceConformite.update({ where: { id }, data: { statut: "FAIT" } });

  if (existing.recurrenceMois && existing.recurrenceMois > 0) {
    const nextDate = new Date(existing.dateEcheance);
    nextDate.setMonth(nextDate.getMonth() + existing.recurrenceMois);

    let nextLibelle = existing.libelle;
    if (existing.type === "CNPS") {
      nextLibelle = `Déclaration CNPS — ${nextDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
    } else if (existing.type === "DGI_TVA") {
      const trimestre = Math.floor(nextDate.getMonth() / 3) + 1;
      nextLibelle = `Déclaration TVA T${trimestre} ${nextDate.getFullYear()}`;
    }

    await prisma.echeanceConformite.create({
      data: {
        organizationId,
        type: existing.type,
        libelle: nextLibelle,
        dateEcheance: nextDate,
        montantEstime: existing.montantEstime,
        chantierId: existing.chantierId,
        rappelJours: existing.rappelJours,
        recurrenceMois: existing.recurrenceMois,
        notes: existing.notes,
      },
    });
  }

  return prisma.echeanceConformite.findUnique({ where: { id } });
}

export function buildConformiteCsv(data) {
  const lines = ["Type;Libellé;Échéance;Montant (FCFA);Statut;Chantier;Retard"];

  for (const e of data.echeances || []) {
    if (e.statutRaw === "FAIT") continue;
    lines.push(
      [
        e.typeLabel,
        e.libelle,
        new Date(e.dateEcheance).toLocaleDateString("fr-FR"),
        e.montantEstime ?? "",
        e.statut,
        e.chantierNom ?? "",
        e.statutRaw === "EN_RETARD" ? "Oui" : "Non",
      ]
        .map(escapeCsv)
        .join(";")
    );
  }

  return lines.join("\n");
}
