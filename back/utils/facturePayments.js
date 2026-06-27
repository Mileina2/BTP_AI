import prisma from "../config/prisma.js";
import { computeDevisAmounts } from "./devisTotals.js";

export function computeFactureNetAPayer(facture, lignes = facture.lignes) {
  const amounts = computeDevisAmounts(
    lignes || [],
    facture.tva,
    facture.remisePercent,
    facture.retenueGarantie
  );
  let net = amounts.netAPayer;
  if (facture.acompteDeduit > 0) {
    net = Math.max(0, net - facture.acompteDeduit);
  }
  return { ...amounts, netAPayer: net, netAvantDeductions: amounts.netAPayer };
}

export async function syncFacturePaymentStatus(factureId) {
  const facture = await prisma.facture.findUnique({
    where: { id: factureId },
    include: {
      lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
      paiements: { orderBy: { datePaiement: "asc" } },
      avoirs: { where: { statut: { in: ["EMIS", "APPLIQUE"] } } },
    },
  });
  if (!facture || facture.statut === "ANNULEE") return facture;

  const { netAPayer } = computeFactureNetAPayer(facture);
  const montantVerse = facture.paiements.reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const montantAvoir = facture.avoirs.reduce((s, a) => s + (Number(a.montantTTC) || 0), 0);
  const resteDu = Math.max(0, netAPayer - montantVerse - montantAvoir);

  let statut = facture.statut;
  let datePaiement = facture.datePaiement;

  if (resteDu <= 0.01 && (montantVerse > 0 || montantAvoir > 0)) {
    statut = "PAYEE";
    const lastPay = facture.paiements[facture.paiements.length - 1];
    datePaiement = lastPay?.datePaiement || new Date();
  } else if (montantVerse > 0 && resteDu > 0.01) {
    statut = "PARTIELLEMENT_PAYEE";
    datePaiement = null;
  } else if (statut === "PAYEE" && montantVerse === 0 && montantAvoir === 0) {
    statut = facture.verrouillee ? "ENVOYEE" : "BROUILLON";
    datePaiement = null;
  }

  return prisma.facture.update({
    where: { id: factureId },
    data: { montantVerse, montantAvoir, statut, datePaiement },
  });
}

export function assertFactureEditable(facture) {
  if (facture.verrouillee) {
    const err = new Error("Facture verrouillée — modification des montants et lignes impossible.");
    err.code = "FACTURE_LOCKED";
    throw err;
  }
}
