import prisma from "../config/prisma.js";
import { toLegacy } from "../utils/legacyMap.js";
import { syncChantierDepenses } from "./budgetService.js";
import { isManagement, getAccessibleChantierIds } from "../utils/accessControl.js";

export const STOCK_CAT_FROM = {
  Matériaux: "MATERIAUX",
  Outils: "OUTILS",
  Carburant: "CARBURANT",
  Équipement: "EQUIPEMENT",
  Equipement: "EQUIPEMENT",
  Consommable: "CONSOMMABLE",
  Autre: "AUTRE",
};

export const STOCK_CAT_LABEL = {
  MATERIAUX: "Matériaux",
  OUTILS: "Outils",
  CARBURANT: "Carburant",
  EQUIPEMENT: "Équipement",
  CONSOMMABLE: "Consommable",
  AUTRE: "Autre",
};

export const ETAT_LABEL = { OK: "OK", ALERTE: "Alerte", RUPTURE: "Rupture" };

export function recalcStockEtat(qty, seuil) {
  if (qty <= 0) return "RUPTURE";
  if (qty <= seuil) return "ALERTE";
  return "OK";
}

export function parseStockInput(body) {
  const qty = Number(body.quantiteActuelle ?? body.stockInitial) || 0;
  const seuil = Number(body.seuilAlerte ?? 10);
  const data = {
    nom: body.nom?.trim(),
    categorie: STOCK_CAT_FROM[body.categorie] || body.categorie || "MATERIAUX",
    reference: body.reference?.trim() || null,
    unite: body.unite || "unité",
    quantiteActuelle: qty,
    seuilAlerte: seuil,
    prixUnitaire: Number(body.prixUnitaire) || 0,
    etat: recalcStockEtat(qty, seuil),
  };
  if (body.chantier || body.chantierId) {
    data.chantierId = body.chantier || body.chantierId;
  }
  return data;
}

export function articleValeur(a) {
  return Math.round((a.quantiteActuelle || 0) * (a.prixUnitaire || 0));
}

export function rotationIndex(mouvements = []) {
  return mouvements
    .filter((m) => m.type === "SORTIE")
    .reduce((s, m) => s + (m.quantite || 0), 0);
}

export function formatStock(s) {
  const valeurTotale = articleValeur(s);
  return toLegacy({
    ...s,
    categorie: STOCK_CAT_LABEL[s.categorie] || s.categorie,
    etat: ETAT_LABEL[s.etat] || s.etat,
    valeurTotale,
    indiceRotation: rotationIndex(s.mouvements),
    chantier: s.chantier
      ? { _id: s.chantier.id, id: s.chantier.id, nom: s.chantier.nom }
      : s.chantierId
        ? { _id: s.chantierId, id: s.chantierId }
        : null,
  });
}

const articleInclude = {
  chantier: { select: { id: true, nom: true, statut: true } },
  mouvements: { orderBy: { date: "desc" }, take: 50 },
};

function depenseLibelle(nom) {
  return `Stock — ${nom}`;
}

export async function syncStockDepense(organizationId, chantierId, nom, montant) {
  if (!chantierId || !montant) return;
  const libelle = depenseLibelle(nom);
  const existing = await prisma.depense.findFirst({
    where: { organizationId, chantierId, libelle },
  });
  if (existing) {
    await prisma.depense.update({ where: { id: existing.id }, data: { montant } });
  } else {
    await prisma.depense.create({
      data: {
        organizationId,
        chantierId,
        libelle,
        categorie: "Matériaux",
        montant,
        fournisseur: nom,
      },
    });
  }
  await syncChantierDepenses(chantierId);
}

export async function getStockOverview(organizationId, chantierId = null, user = null) {
  const where = { organizationId };
  if (chantierId) {
    where.chantierId = chantierId;
  } else if (user && !isManagement(user)) {
    const ids = await getAccessibleChantierIds(prisma, user);
    if (ids.length === 0) {
      return { stats: { totalArticles: 0, totalValeur: 0, alertes: 0, ruptures: 0, ok: 0 }, alertes: [], items: [] };
    }
    where.chantierId = { in: ids };
  }

  const items = await prisma.stockArticle.findMany({
    where,
    include: articleInclude,
    orderBy: { nom: "asc" },
  });

  const formatted = items.map(formatStock);
  const totalValeur = formatted.reduce((s, i) => s + (i.valeurTotale || 0), 0);
  const alertes = formatted.filter((i) => i.etat === "Alerte" || i.etat === "Rupture");

  return {
    stats: {
      totalArticles: formatted.length,
      totalValeur,
      alertes: alertes.filter((i) => i.etat === "Alerte").length,
      ruptures: alertes.filter((i) => i.etat === "Rupture").length,
      ok: formatted.filter((i) => i.etat === "OK").length,
    },
    alertes,
    items: formatted,
  };
}

export async function buildStockAnalyse(organizationId, chantierId) {
  const chantier = await prisma.chantier.findFirst({
    where: { id: chantierId, organizationId },
    select: { id: true, nom: true },
  });
  if (!chantier) return null;

  const items = await prisma.stockArticle.findMany({
    where: { organizationId, chantierId },
    include: { mouvements: true },
  });

  const totalValeur = items.reduce((s, a) => s + articleValeur(a), 0);

  const parCategorie = Object.entries(
    items.reduce((acc, a) => {
      const label = STOCK_CAT_LABEL[a.categorie] || a.categorie;
      acc[label] = (acc[label] || 0) + articleValeur(a);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const topRotation = [...items]
    .map((a) => ({
      nom: a.nom,
      rotation: rotationIndex(a.mouvements),
      valeur: articleValeur(a),
    }))
    .sort((a, b) => b.rotation - a.rotation)
    .slice(0, 10);

  const alertes = items
    .filter((a) => a.etat !== "OK")
    .map((a) => formatStock({ ...a, chantier }));

  return {
    chantierId,
    chantierNom: chantier.nom,
    totalValeur,
    totalArticles: items.length,
    parCategorie,
    topRotation,
    alertes,
  };
}

export async function getArticlesForExport(organizationId, chantierId) {
  const chantier = await prisma.chantier.findFirst({
    where: { id: chantierId, organizationId },
    select: { id: true, nom: true },
  });
  if (!chantier) return null;

  const items = await prisma.stockArticle.findMany({
    where: { organizationId, chantierId },
    orderBy: { nom: "asc" },
  });

  return {
    chantier,
    items: items.map((a) => ({
      ...a,
      categorie: STOCK_CAT_LABEL[a.categorie] || a.categorie,
      etat: ETAT_LABEL[a.etat] || a.etat,
      valeurTotale: articleValeur(a),
    })),
  };
}
