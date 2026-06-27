import prisma from "../config/prisma.js";
import {
  CLIENT_RELATION_LABEL,
  CLIENT_TYPE_LABEL,
  CHANTIER_STATUT_LABEL,
  DEVIS_STATUT_LABEL,
  FACTURE_STATUT_LABEL,
  toLegacy,
} from "../utils/legacyMap.js";

export function formatClientList(c, finances = {}) {
  const { _count, ...rest } = c;
  return toLegacy({
    ...rest,
    type: CLIENT_TYPE_LABEL[c.type] || c.type,
    statutRelation: CLIENT_RELATION_LABEL[c.statutRelation] || c.statutRelation,
    user: c.ownerId,
    counts: _count
      ? {
          chantiers: _count.chantiers,
          devis: _count.devis,
          factures: _count.factures,
        }
      : undefined,
    finances,
  });
}

export async function getClientsOverview(organizationId) {
  const clients = await prisma.client.findMany({
    where: { organizationId },
    include: {
      _count: { select: { chantiers: true, devis: true, factures: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const clientIds = clients.map((c) => c.id);

  let factures = [];
  let devis = [];
  if (clientIds.length > 0) {
    factures = await prisma.facture.findMany({
      where: { organizationId, clientId: { in: clientIds } },
      select: { clientId: true, montantTTC: true, statut: true },
    });

    devis = await prisma.devis.findMany({
      where: { organizationId, clientId: { in: clientIds } },
      select: { clientId: true, montantTTC: true, statut: true },
    });
  }

  const financeByClient = {};
  clientIds.forEach((id) => {
    financeByClient[id] = {
      factureTotal: 0,
      facturePayee: 0,
      factureImpayee: 0,
      pipelineDevis: 0,
    };
  });

  factures.forEach((f) => {
    const agg = financeByClient[f.clientId];
    if (!agg) return;
    agg.factureTotal += f.montantTTC;
    if (f.statut === "PAYEE") agg.facturePayee += f.montantTTC;
    if (f.statut === "IMPAYEE" || f.statut === "ENVOYEE") agg.factureImpayee += f.montantTTC;
  });

  devis.forEach((d) => {
    const agg = financeByClient[d.clientId];
    if (!agg) return;
    if (d.statut === "EN_ATTENTE" || d.statut === "ENVOYE") {
      agg.pipelineDevis += d.montantTTC;
    }
  });

  let total = clients.length;
  let actifs = 0;
  let prospects = 0;
  let vip = 0;
  let inactifs = 0;
  let caFacture = 0;
  let caEncaisse = 0;
  let impayes = 0;
  let pipelineDevis = 0;

  clients.forEach((c) => {
    if (c.statutRelation === "ACTIF") actifs++;
    if (c.statutRelation === "PROSPECT") prospects++;
    if (c.statutRelation === "VIP") vip++;
    if (c.statutRelation === "INACTIF") inactifs++;
    const fin = financeByClient[c.id];
    caFacture += fin.factureTotal;
    caEncaisse += fin.facturePayee;
    impayes += fin.factureImpayee;
    pipelineDevis += fin.pipelineDevis;
  });

  return {
    stats: {
      total,
      actifs,
      prospects,
      vip,
      inactifs,
      caFacture,
      caEncaisse,
      impayes,
      pipelineDevis,
    },
    items: clients.map((c) => formatClientList(c, financeByClient[c.id])),
  };
}

export async function getClientDetail(organizationId, clientId) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      owner: { select: { id: true, nom: true, email: true } },
      portalUser: { select: { id: true, email: true, nom: true, prenom: true } },
      _count: { select: { chantiers: true, devis: true, factures: true } },
      chantiers: {
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          nom: true,
          statut: true,
          budget: true,
          depenses: true,
          ville: true,
          dateDebut: true,
          dateFin: true,
        },
      },
      devis: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          numero: true,
          montantTTC: true,
          statut: true,
          dateEmission: true,
          chantier: { select: { nom: true } },
        },
      },
      factures: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          numero: true,
          montantTTC: true,
          statut: true,
          dateEmission: true,
          dateEcheance: true,
          chantier: { select: { nom: true } },
        },
      },
    },
  });

  if (!client) return null;

  const factureAgg = await prisma.facture.groupBy({
    by: ["statut"],
    where: { clientId, organizationId },
    _sum: { montantTTC: true },
    _count: true,
  });

  const devisAgg = await prisma.devis.groupBy({
    by: ["statut"],
    where: { clientId, organizationId },
    _sum: { montantTTC: true },
    _count: true,
  });

  let factureTotal = 0;
  let facturePayee = 0;
  let factureImpayee = 0;
  factureAgg.forEach((row) => {
    const amt = row._sum.montantTTC || 0;
    factureTotal += amt;
    if (row.statut === "PAYEE") facturePayee += amt;
    if (row.statut === "IMPAYEE" || row.statut === "ENVOYEE") factureImpayee += amt;
  });

  let pipelineDevis = 0;
  let devisAcceptes = 0;
  devisAgg.forEach((row) => {
    const amt = row._sum.montantTTC || 0;
    if (row.statut === "ACCEPTE") devisAcceptes += amt;
    if (row.statut === "EN_ATTENTE" || row.statut === "ENVOYE") pipelineDevis += amt;
  });

  const budgetChantiers = client.chantiers.reduce((s, ch) => s + ch.budget, 0);
  const depensesChantiers = client.chantiers.reduce((s, ch) => s + ch.depenses, 0);

  return {
    ...toLegacy({
      ...client,
      type: CLIENT_TYPE_LABEL[client.type] || client.type,
      statutRelation: CLIENT_RELATION_LABEL[client.statutRelation] || client.statutRelation,
      user: client.ownerId,
    }),
    owner: client.owner,
    portalAccess: client.portalUser
      ? {
          active: true,
          userId: client.portalUser.id,
          email: client.portalUser.email,
          nom: [client.portalUser.prenom, client.portalUser.nom].filter(Boolean).join(" "),
        }
      : { active: false },
    counts: {
      chantiers: client._count.chantiers,
      devis: client._count.devis,
      factures: client._count.factures,
    },
    finances: {
      factureTotal,
      facturePayee,
      factureImpayee,
      pipelineDevis,
      devisAcceptes,
      budgetChantiers,
      depensesChantiers,
    },
    chantiers: client.chantiers.map((ch) => ({
      id: ch.id,
      nom: ch.nom,
      statut: CHANTIER_STATUT_LABEL[ch.statut] || ch.statut,
      budget: ch.budget,
      depenses: ch.depenses,
      ville: ch.ville,
      dateDebut: ch.dateDebut,
      dateFin: ch.dateFin,
      ratioBudget: ch.budget > 0 ? Math.round((ch.depenses / ch.budget) * 100) : 0,
    })),
    devisRecents: client.devis.map((d) => ({
      id: d.id,
      numero: d.numero,
      montantTTC: d.montantTTC,
      statut: DEVIS_STATUT_LABEL[d.statut] || d.statut,
      date: d.dateEmission,
      chantier: d.chantier?.nom,
    })),
    facturesRecentes: client.factures.map((f) => ({
      id: f.id,
      numero: f.numero,
      montantTTC: f.montantTTC,
      statut: FACTURE_STATUT_LABEL[f.statut] || f.statut,
      date: f.dateEmission,
      dateEcheance: f.dateEcheance,
      chantier: f.chantier?.nom,
    })),
  };
}
