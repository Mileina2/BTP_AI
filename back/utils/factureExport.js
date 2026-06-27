import { FACTURE_STATUT_LABEL, MODE_PAIEMENT_LABEL } from "./legacyMap.js";
import { computeFactureNetAPayer } from "./facturePayments.js";

function csvEscape(val) {
  const s = val == null ? "" : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function buildFacturesComptableCsv(factures, org) {
  const headers = [
    "Numéro",
    "Type",
    "Date émission",
    "Date échéance",
    "Client",
    "Chantier",
    "Réf. devis",
    "HT",
    "TVA",
    "TTC",
    "Net à payer",
    "Encaissé",
    "Avoirs",
    "Reste dû",
    "Statut",
    "Mode paiement",
    "RCCM",
    "N° CC",
  ];

  const rows = factures.map((f) => {
    const { netAPayer } = computeFactureNetAPayer(f);
    const encaisse = f.montantVerse || 0;
    const avoirs = f.montantAvoir || 0;
    const reste = Math.max(0, netAPayer - encaisse - avoirs);
    return [
      f.numero,
      f.typeFacture,
      fmtDate(f.dateEmission || f.createdAt),
      fmtDate(f.dateEcheance),
      f.client?.nom || "",
      f.chantier?.nom || "",
      f.referenceDevis || f.devis?.numero || "",
      Math.round(f.montantHT || 0),
      Math.round(f.montantTVA || 0),
      Math.round(f.montantTTC || 0),
      Math.round(netAPayer),
      Math.round(encaisse),
      Math.round(avoirs),
      Math.round(reste),
      FACTURE_STATUT_LABEL[f.statut] || f.statut,
      f.modePaiement ? MODE_PAIEMENT_LABEL[f.modePaiement] || f.modePaiement : "",
      org?.rccm || "",
      org?.compteContribuable || "",
    ]
      .map(csvEscape)
      .join(",");
  });

  const meta = `# Export comptable — ${org?.nom || "Organisation"} — ${new Date().toISOString().slice(0, 10)}`;
  return [meta, headers.join(","), ...rows].join("\r\n");
}
