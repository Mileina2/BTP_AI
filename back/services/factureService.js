import prisma from "../config/prisma.js";
import { FACTURE_STATUT_LABEL, MODE_PAIEMENT_LABEL, toLegacy } from "../utils/legacyMap.js";
import { computeDevisAmounts } from "../utils/devisTotals.js";
import { computeFactureNetAPayer } from "../utils/facturePayments.js";

const FACTURE_TYPE_LABEL = {
  INTEGRALE: "Facture intégrale",
  ACOMPTE: "Facture d'acompte",
  SOLDE: "Facture de solde",
};
export function formatFactureList(f) {
  const dateEmission = f.dateEmission || f.createdAt;
  const echeance = f.dateEcheance ? new Date(f.dateEcheance) : null;
  const joursRetard = echeance
    ? Math.ceil((new Date() - echeance) / (1000 * 60 * 60 * 24))
    : null;
  const { netAPayer } = computeFactureNetAPayer(f);
  const resteDu = Math.max(0, netAPayer - (f.montantVerse || 0) - (f.montantAvoir || 0));
  const statutRaw = f.statut;
  const enRetard = joursRetard > 0 && !["PAYEE", "ANNULEE", "BROUILLON"].includes(statutRaw);

  return toLegacy({
    ...f,
    statut: FACTURE_STATUT_LABEL[f.statut] || f.statut,
    statutRaw,
    client: f.client ? f.client.nom : "—",
    clientId: f.clientId,
    chantier: f.chantier ? f.chantier.nom : null,
    chantierId: f.chantierId,
    date: dateEmission,
    dateEmission,
    dateEcheance: f.dateEcheance,
    joursRetard: enRetard ? joursRetard : null,
    enRetard,
    nbLignes: f.lignes?.length ?? 0,
    montantVerse: f.montantVerse ?? 0,
    montantAvoir: f.montantAvoir ?? 0,
    resteDu: Math.round(resteDu),
    typeFactureRaw: f.typeFacture,
    clientTel: f.client?.telephone,
    modePaiement: f.modePaiement ? MODE_PAIEMENT_LABEL[f.modePaiement] || f.modePaiement : null,
  });
}

export async function getFactureOverview(organizationId) {
  const factures = await prisma.facture.findMany({
    where: { organizationId },
    include: {
      client: { select: { id: true, nom: true, telephone: true } },
      chantier: { select: { id: true, nom: true } },
      lignes: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let total = factures.length;
  let brouillons = 0;
  let envoyees = 0;
  let payees = 0;
  let impayees = 0;
  let montantTotal = 0;
  let encaisse = 0;
  let impayeMontant = 0;
  let echeanceProche = 0;

  let partial = 0;
  let enRetard = 0;

  const now = new Date();
  const in7days = new Date(now);
  in7days.setDate(in7days.getDate() + 7);

  factures.forEach((f) => {
    montantTotal += f.montantTTC;
    if (f.statut === "BROUILLON") brouillons++;
    if (f.statut === "ENVOYEE") envoyees++;
    if (f.statut === "PARTIELLEMENT_PAYEE") partial++;
    if (f.statut === "PAYEE" || f.statut === "PARTIELLEMENT_PAYEE") {
      if (f.statut === "PAYEE") payees++;
      encaisse += f.montantVerse || 0;
    }
    if (f.statut === "IMPAYEE" || f.statut === "PARTIELLEMENT_PAYEE" || f.statut === "ENVOYEE") {
      if (f.statut === "IMPAYEE") impayees++;
      const net = computeFactureNetAPayer(f).netAPayer;
      impayeMontant += Math.max(0, net - (f.montantVerse || 0) - (f.montantAvoir || 0));
    }
    if (
      f.dateEcheance &&
      f.statut !== "PAYEE" &&
      f.statut !== "ANNULEE" &&
      f.statut !== "BROUILLON" &&
      new Date(f.dateEcheance) < now
    ) {
      enRetard++;
    }
    if (
      f.dateEcheance &&
      f.statut !== "PAYEE" &&
      f.statut !== "ANNULEE" &&
      new Date(f.dateEcheance) <= in7days &&
      new Date(f.dateEcheance) >= now
    ) {
      echeanceProche++;
    }
  });

  const items = factures.map((f) =>
    formatFactureList({
      ...f,
      lignes: f.lignes,
      client: f.client,
      chantier: f.chantier,
    })
  );

  const aEncaisser = items.filter(
    (f) =>
      f.resteDu > 0 &&
      !["BROUILLON", "ANNULEE", "PAYEE"].includes(f.statutRaw)
  );

  const alertes = [];
  if (enRetard > 0) {
    alertes.push({
      type: "critical",
      titre: "Factures en retard",
      message: `${enRetard} facture(s) — ${Math.round(impayeMontant).toLocaleString("fr-FR")} FCFA de créances.`,
    });
  }
  if (echeanceProche > 0) {
    alertes.push({
      type: "warning",
      titre: "Échéances sous 7 jours",
      message: `${echeanceProche} facture(s) à encaisser cette semaine.`,
    });
  }
  if (partial > 0) {
    alertes.push({
      type: "info",
      titre: "Paiements partiels",
      message: `${partial} facture(s) partiellement payée(s) — complétez les soldes.`,
    });
  }

  return {
    stats: {
      total,
      brouillons,
      envoyees,
      payees,
      partial,
      impayees,
      enRetard,
      montantTotal,
      encaisse,
      impayeMontant,
      creancesTotal: Math.round(impayeMontant),
      echeanceProche,
      aEncaisser: aEncaisser.length,
      tauxEncaissement: montantTotal > 0 ? Math.round((encaisse / montantTotal) * 100) : 0,
    },
    items,
    aEncaisser: aEncaisser.sort((a, b) => (b.enRetard ? 1 : 0) - (a.enRetard ? 1 : 0) || (b.resteDu || 0) - (a.resteDu || 0)),
    alertes,
    generatedAt: new Date().toISOString(),
  };
}

export async function getFactureDetail(organizationId, factureId) {
  const facture = await prisma.facture.findFirst({
    where: { id: factureId, organizationId },
    include: {
      client: true,
      chantier: { select: { id: true, nom: true, budget: true, statut: true, ville: true } },
      devis: { select: { id: true, numero: true } },
      lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
      paiements: { orderBy: { datePaiement: "desc" } },
      avoirs: { orderBy: { dateEmission: "desc" }, include: { lignes: true } },
    },
  });

  if (!facture) return null;

  const amounts = computeDevisAmounts(
    facture.lignes,
    facture.tva,
    facture.remisePercent,
    facture.retenueGarantie
  );
  const { netAPayer } = computeFactureNetAPayer(facture);
  const montantVerse = facture.montantVerse ?? 0;
  const montantAvoir = facture.montantAvoir ?? 0;
  const resteDu = Math.max(0, netAPayer - montantVerse - montantAvoir);

  const dateEmission = facture.dateEmission || facture.createdAt;
  const echeance = facture.dateEcheance ? new Date(facture.dateEcheance) : null;
  const joursRetard = echeance
    ? Math.ceil((new Date() - echeance) / (1000 * 60 * 60 * 24))
    : null;

  return {
    ...toLegacy({
      ...facture,
      statut: FACTURE_STATUT_LABEL[facture.statut] || facture.statut,
      statutRaw: facture.statut,
    }),
    client: facture.client
      ? toLegacy({
          id: facture.client.id,
          nom: facture.client.nom,
          email: facture.client.email,
          telephone: facture.client.telephone,
          adresse: facture.client.adresse,
          pays: facture.client.pays,
        })
      : null,
    chantier: facture.chantier,
    devis: facture.devis,
    lignes: facture.lignes.map((l) => ({
      id: l.id,
      section: l.section || "Général",
      reference: l.reference,
      designation: l.designation,
      detailDescription: l.detailDescription,
      quantite: l.quantite,
      unite: l.unite || "u",
      prixUnitaire: l.prixUnitaire,
      tva: l.tva ?? facture.tva ?? 18,
      total: l.quantite * l.prixUnitaire,
    })),
    finances: {
      montantHTBrut: amounts.montantHTBrut,
      montantRemise: amounts.montantRemise,
      remisePercent: facture.remisePercent ?? 0,
      montantHT: facture.montantHT,
      montantTVA: facture.montantTVA,
      montantTTC: facture.montantTTC,
      tvaBreakdown: amounts.tvaBreakdown,
      retenueGarantie: facture.retenueGarantie ?? 0,
      montantRetenue: amounts.montantRetenue,
      netAPayer,
      tva: facture.tva,
      acompteDeduit: facture.acompteDeduit ?? 0,
      montantVerse,
      montantAvoir,
      resteDu,
    },
    remisePercent: facture.remisePercent ?? 0,
    retenueGarantie: facture.retenueGarantie ?? 0,
    referenceInterne: facture.referenceInterne,
    verrouillee: facture.verrouillee ?? false,
    acompteDeduit: facture.acompteDeduit ?? 0,
    paiements: facture.paiements.map((p) => ({
      id: p.id,
      montant: p.montant,
      datePaiement: p.datePaiement,
      modePaiement: p.modePaiement ? MODE_PAIEMENT_LABEL[p.modePaiement] || p.modePaiement : null,
      modePaiementRaw: p.modePaiement,
      reference: p.reference,
      commentaire: p.commentaire,
    })),
    avoirs: facture.avoirs.map((a) => ({
      id: a.id,
      numero: a.numero,
      motif: a.motif,
      montantTTC: a.montantTTC,
      statut: a.statut,
      dateEmission: a.dateEmission,
      lignes: a.lignes,
    })),
    typeFacture: FACTURE_TYPE_LABEL[facture.typeFacture] || facture.typeFacture,
    typeFactureRaw: facture.typeFacture,
    echeance: {
      dateEcheance: facture.dateEcheance,
      datePaiement: facture.datePaiement,
      joursRetard: joursRetard > 0 && facture.statut !== "PAYEE" ? joursRetard : null,
      enRetard: joursRetard > 0 && facture.statut !== "PAYEE" && facture.statut !== "ANNULEE",
    },
    modePaiement: facture.modePaiement
      ? MODE_PAIEMENT_LABEL[facture.modePaiement] || facture.modePaiement
      : null,
    modePaiementRaw: facture.modePaiement,
  };
}
