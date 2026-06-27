import prisma from "../config/prisma.js";
import { computeDevisAmounts } from "../utils/devisTotals.js";
import { DEVIS_STATUT_LABEL, toLegacy } from "../utils/legacyMap.js";

export function formatDevisList(d) {
  const { lignes, client, chantier, ...rest } = d;
  const dateEmission = d.dateEmission || d.createdAt;
  const expireLe = new Date(dateEmission);
  expireLe.setDate(expireLe.getDate() + (d.validite || 30));
  const joursRestants = Math.ceil((expireLe - new Date()) / (1000 * 60 * 60 * 24));

  return toLegacy({
    ...rest,
    statut: DEVIS_STATUT_LABEL[d.statut] || d.statut,
    statutRaw: d.statut,
    numeroAffiche: d.version > 1 ? `${d.numero} (v${d.version})` : d.numero,
    version: d.version ?? 1,
    parentDevisId: d.parentDevisId,
    client: client ? client.nom : "—",
    clientId: d.clientId,
    chantier: chantier ? chantier.nom : null,
    chantierId: d.chantierId,
    date: dateEmission,
    dateEmission,
    expireLe,
    joursRestants,
    nbLignes: lignes?.length ?? d._count?.lignes ?? 0,
    clientTel: client?.telephone,
  });
}

export async function getDevisOverview(organizationId) {
  const devis = await prisma.devis.findMany({
    where: { organizationId },
    include: {
      client: { select: { id: true, nom: true, telephone: true } },
      chantier: { select: { id: true, nom: true } },
      lignes: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let total = devis.length;
  let enAttente = 0;
  let envoyes = 0;
  let acceptes = 0;
  let refuses = 0;
  let montantTotal = 0;
  let pipelineMontant = 0;
  let accepteMontant = 0;
  let expiresSoon = 0;

  devis.forEach((d) => {
    montantTotal += d.montantTTC;
    const dateEmission = d.dateEmission || d.createdAt;
    const expireLe = new Date(dateEmission);
    expireLe.setDate(expireLe.getDate() + (d.validite || 30));
    const joursRestants = Math.ceil((expireLe - new Date()) / (1000 * 60 * 60 * 24));

    if (d.statut === "EN_ATTENTE") {
      enAttente++;
      pipelineMontant += d.montantTTC;
    }
    if (d.statut === "ENVOYE") {
      envoyes++;
      pipelineMontant += d.montantTTC;
    }
    if (d.statut === "ACCEPTE") {
      acceptes++;
      accepteMontant += d.montantTTC;
    }
    if (d.statut === "REFUSE") refuses++;

    if (
      (d.statut === "EN_ATTENTE" || d.statut === "ENVOYE") &&
      joursRestants >= 0 &&
      joursRestants <= 7
    ) {
      expiresSoon++;
    }
  });

  const tauxConversion = total > 0 ? Math.round((acceptes / total) * 100) : 0;

  return {
    stats: {
      total,
      enAttente,
      envoyes,
      acceptes,
      refuses,
      montantTotal,
      pipelineMontant,
      accepteMontant,
      tauxConversion,
      expiresSoon,
    },
    items: devis.map((d) =>
      formatDevisList({
        ...d,
        lignes: d.lignes,
        client: d.client,
        chantier: d.chantier,
      })
    ),
  };
}

export async function getDevisDetail(organizationId, devisId) {
  const devis = await prisma.devis.findFirst({
    where: { id: devisId, organizationId },
    include: {
      client: true,
      chantier: { select: { id: true, nom: true, adresse: true, ville: true, pays: true, budget: true, statut: true } },
      parentDevis: { select: { numero: true } },
      lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
      annexes: { orderBy: [{ ordre: "asc" }, { createdAt: "asc" }] },
      planningTaches: { orderBy: [{ ordre: "asc" }, { dateDebut: "asc" }] },
    },
  });

  if (!devis) return null;

  const dateEmission = devis.dateEmission || devis.createdAt;
  const expireLe = new Date(dateEmission);
  expireLe.setDate(expireLe.getDate() + (devis.validite || 30));
  const joursRestants = Math.ceil((expireLe - new Date()) / (1000 * 60 * 60 * 24));
  const amounts = computeDevisAmounts(devis.lignes, devis.tva, devis.remisePercent, devis.retenueGarantie);

  const versionLabel = devis.version > 1 ? ` (v${devis.version})` : "";

  return {
    ...toLegacy({
      ...devis,
      statut: DEVIS_STATUT_LABEL[devis.statut] || devis.statut,
      statutRaw: devis.statut,
      numeroAffiche: `${devis.numero}${versionLabel}`,
    }),
    client: devis.client
      ? toLegacy({
          id: devis.client.id,
          nom: devis.client.nom,
          email: devis.client.email,
          telephone: devis.client.telephone,
          pays: devis.client.pays,
        })
      : null,
    chantier: devis.chantier,
    parentDevisNumero: devis.parentDevis?.numero || null,
    lignes: devis.lignes.map((l) => ({
      id: l.id,
      section: l.section || "Général",
      reference: l.reference,
      designation: l.designation,
      detailDescription: l.detailDescription,
      quantite: l.quantite,
      unite: l.unite || "u",
      prixUnitaire: l.prixUnitaire,
      tva: l.tva ?? devis.tva ?? 18,
      isOption: l.isOption ?? false,
      total: l.quantite * l.prixUnitaire,
    })),
    finances: {
      montantHTBrut: amounts.montantHTBrut,
      montantRemise: amounts.montantRemise,
      remisePercent: devis.remisePercent ?? 0,
      montantHT: devis.montantHT,
      montantTVA: devis.montantTVA,
      montantTTC: devis.montantTTC,
      tvaBreakdown: amounts.tvaBreakdown,
      retenueGarantie: devis.retenueGarantie ?? 0,
      montantRetenue: amounts.montantRetenue,
      netAPayer: amounts.netAPayer,
      optionsHT: amounts.optionsHT,
      acomptePercent: devis.acomptePercent ?? 30,
      acompteMontant: ((amounts.netAPayer || devis.montantTTC || 0) * (devis.acomptePercent ?? 30)) / 100,
      tva: devis.tva,
    },
    delaiExecution: devis.delaiExecution,
    retenueGarantie: devis.retenueGarantie ?? 0,
    referenceInterne: devis.referenceInterne,
    indexationActive: devis.indexationActive ?? false,
    indexationReference: devis.indexationReference,
    indexationDateBase: devis.indexationDateBase,
    indexationTauxMax: devis.indexationTauxMax ?? 5,
    indexationClause: devis.indexationClause,
    planningDebut: devis.planningDebut,
    planningFin: devis.planningFin,
    planningTaches: (devis.planningTaches || []).map((t) => ({
      id: t.id,
      libelle: t.libelle,
      section: t.section,
      dateDebut: t.dateDebut,
      dateFin: t.dateFin,
      ordre: t.ordre,
      progression: t.progression,
    })),
    annexes: (devis.annexes || []).map((a) => ({
      id: a.id,
      nom: a.nom,
      url: a.url,
      mimeType: a.mimeType,
      type: a.type,
      ordre: a.ordre,
      createdAt: a.createdAt,
    })),
    clientAccepteNom: devis.clientAccepteNom,
    clientAccepteLe: devis.clientAccepteLe,
    clientSignatureData: devis.clientSignatureData,
    validite: {
      jours: devis.validite,
      dateEmission,
      expireLe,
      joursRestants,
      expire: joursRestants < 0,
    },
  };
}
