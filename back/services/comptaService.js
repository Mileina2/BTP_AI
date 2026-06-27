import prisma from "../config/prisma.js";
import { FACTURE_STATUT_LABEL, toLegacy } from "../utils/legacyMap.js";
import { computeFactureNetAPayer } from "../utils/facturePayments.js";
import { formatDepenseList } from "./budgetService.js";
import { formatFactureList } from "./factureService.js";
import { getSyncStatus } from "./comptaComptableService.js";

const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function inYear(d, year) {
  if (!d) return false;
  return new Date(d).getFullYear() === year;
}

function buildMonthlyCashflow(factures, depenses, paiements, year) {
  const recettes = Array(12).fill(0);
  const charges = Array(12).fill(0);

  for (const p of paiements) {
    if (inYear(p.datePaiement, year)) {
      recettes[new Date(p.datePaiement).getMonth()] += Number(p.montant) || 0;
    }
  }

  for (const f of factures) {
    if (f.statut === "PAYEE" && f.datePaiement && inYear(f.datePaiement, year)) {
      const hasPaiements = paiements.some((p) => p.factureId === f.id);
      if (!hasPaiements) {
        recettes[new Date(f.datePaiement).getMonth()] += f.montantVerse || f.montantTTC || 0;
      }
    }
  }

  for (const d of depenses) {
    if (inYear(d.date, year)) {
      charges[new Date(d.date).getMonth()] += d.montant || 0;
    }
  }

  return MOIS_LABELS.map((name, i) => ({
    name,
    recettes: Math.round(recettes[i]),
    charges: Math.round(charges[i]),
    solde: Math.round(recettes[i] - charges[i]),
  }));
}

function buildChargeRepartition(depenses) {
  const map = {};
  for (const d of depenses) {
    const cat = d.categorie || "Autre";
    map[cat] = (map[cat] || 0) + (d.montant || 0);
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

export async function getComptaOverview(organizationId, { year } = {}) {
  const yearNum = Number(year) || new Date().getFullYear();

  const [org, factures, depenses, devis, equipeMembers, paiements] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { nom: true, devise: true, rccm: true, compteContribuable: true },
    }),
    prisma.facture.findMany({
      where: { organizationId },
      include: {
        client: { select: { id: true, nom: true } },
        chantier: { select: { id: true, nom: true } },
        lignes: { select: { id: true } },
      },
      orderBy: { dateEmission: "desc" },
    }),
    prisma.depense.findMany({
      where: { organizationId },
      include: { chantier: { select: { id: true, nom: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.devis.findMany({
      where: { organizationId, statut: { in: ["ACCEPTE", "ENVOYE"] } },
      select: { id: true, numero: true, montantTTC: true, statut: true, clientId: true },
    }),
    prisma.equipeMember.findMany({
      where: { organizationId, statut: "ACTIF" },
      select: { salaireTotal: true },
    }),
    prisma.facturePaiement.findMany({
      where: { facture: { organizationId } },
      select: { id: true, factureId: true, montant: true, datePaiement: true },
    }),
  ]);

  let caFacture = 0;
  let caEncaisse = 0;
  let impaye = 0;
  let avoirsTotal = 0;
  let facturesAnnee = 0;

  for (const f of factures) {
    if (f.statut === "ANNULEE") continue;
    caFacture += f.montantTTC || 0;
    caEncaisse += f.montantVerse || 0;
    avoirsTotal += f.montantAvoir || 0;
    const { netAPayer } = computeFactureNetAPayer(f);
    const reste = Math.max(0, netAPayer - (f.montantVerse || 0) - (f.montantAvoir || 0));
    if (f.statut !== "BROUILLON" && f.statut !== "PAYEE") impaye += reste;
    if (inYear(f.dateEmission || f.createdAt, yearNum)) facturesAnnee += 1;
  }

  const depensesAnnee = depenses.filter((d) => inYear(d.date, yearNum));
  const chargesTotal = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const chargesAnnee = depensesAnnee.reduce((s, d) => s + (d.montant || 0), 0);
  const chargesPayees = depenses.filter((d) => d.paye).reduce((s, d) => s + (d.montant || 0), 0);
  const chargesAPayer = chargesTotal - chargesPayees;
  const masseSalariale = equipeMembers.reduce((s, m) => s + (m.salaireTotal || 0), 0);

  const devisPipeline = devis.reduce((s, d) => s + (d.montantTTC || 0), 0);
  const tresorerieEstimee = caEncaisse - chargesPayees;
  const resultatOperationnel = caEncaisse - chargesPayees - masseSalariale;
  const margePct = caEncaisse > 0 ? Math.round((resultatOperationnel / caEncaisse) * 1000) / 10 : 0;

  const recettesAnnee = paiements
    .filter((p) => inYear(p.datePaiement, yearNum))
    .reduce((s, p) => s + (p.montant || 0), 0);

  const syncStatus = await getSyncStatus(organizationId, { year: yearNum });

  const alertes = [];
  if (!syncStatus.planInitialise) {
    alertes.push({
      type: "warning",
      titre: "Plan comptable non initialisé",
      message: "Lancez « Sync SYSCOHADA » pour créer le plan OHADA et les premières écritures.",
      action: "compta",
      tab: "sync",
    });
  } else if (syncStatus.manquantes.total > 0) {
    alertes.push({
      type: "critical",
      titre: "Écritures SYSCOHADA manquantes",
      message: `${syncStatus.manquantes.total} opération(s) de ${yearNum} sans écriture comptable (${syncStatus.manquantes.factures} facture(s), ${syncStatus.manquantes.paiements} encaissement(s), ${syncStatus.manquantes.depenses} charge(s)).`,
      action: "compta",
      tab: "sync",
    });
  } else if (syncStatus.ecrituresCount === 0) {
    alertes.push({
      type: "info",
      titre: "Journal vide",
      message: `Aucune écriture pour l'exercice ${yearNum} — synchronisez depuis factures et charges.`,
      action: "compta",
      tab: "sync",
    });
  }
  if (impaye > 0) {
    alertes.push({
      type: "warning",
      titre: "Créances clients",
      message: `${Math.round(impaye).toLocaleString("fr-FR")} FCFA de factures impayées ou partielles.`,
      action: "factures",
    });
  }
  if (chargesAPayer > 0) {
    alertes.push({
      type: "info",
      titre: "Charges à régler",
      message: `${Math.round(chargesAPayer).toLocaleString("fr-FR")} FCFA de dépenses chantier non soldées.`,
      action: "budget",
    });
  }
  if (tresorerieEstimee < 0) {
    alertes.push({
      type: "critical",
      titre: "Trésorerie négative",
      message: "Les encaissements ne couvrent pas les charges déjà payées.",
      action: "tresorerie",
    });
  }

  return {
    organization: org,
    periode: { year: yearNum, label: `Exercice ${yearNum}` },
    syncStatus,
    kpis: {
      caFacture: Math.round(caFacture),
      caEncaisse: Math.round(caEncaisse),
      impaye: Math.round(impaye),
      avoirs: Math.round(avoirsTotal),
      chargesTotal: Math.round(chargesTotal),
      chargesAnnee: Math.round(chargesAnnee),
      chargesPayees: Math.round(chargesPayees),
      chargesAPayer: Math.round(chargesAPayer),
      masseSalariale: Math.round(masseSalariale),
      tresorerieEstimee: Math.round(tresorerieEstimee),
      resultatOperationnel: Math.round(resultatOperationnel),
      margePct,
      devisPipeline: Math.round(devisPipeline),
      recettesAnnee: Math.round(recettesAnnee),
      facturesAnnee,
      depensesAnnee: depensesAnnee.length,
      ecrituresAnnee: syncStatus.ecrituresCount,
      syncManquantes: syncStatus.manquantes.total,
    },
    cashflowChart: buildMonthlyCashflow(factures, depenses, paiements, yearNum),
    repartitionCharges: buildChargeRepartition(depensesAnnee.length ? depensesAnnee : depenses),
    alertes,
    recettesRecentes: factures.slice(0, 12).map((f) => formatFactureList(f)),
    chargesRecentes: depenses.slice(0, 12).map((d) => formatDepenseList(d, org?.devise || "XOF")),
    devisPipeline: devis.slice(0, 8).map((d) =>
      toLegacy({
        ...d,
        statut: d.statut === "ACCEPTE" ? "Accepté" : "Envoyé",
      })
    ),
  };
}

export function buildComptaJournalCsv(data) {
  const headers = ["Type", "Date", "Référence", "Libellé", "Client/Chantier", "Débit", "Crédit", "Statut"];
  const rows = [];

  for (const f of data.factures || []) {
    rows.push([
      "Facture",
      f.dateEmission ? new Date(f.dateEmission).toISOString().slice(0, 10) : "",
      f.numero,
      f.description || "",
      f.client?.nom || "",
      "",
      Math.round(f.montantTTC || 0),
      FACTURE_STATUT_LABEL[f.statut] || f.statut,
    ]);
  }

  for (const d of data.depenses || []) {
    rows.push([
      "Charge",
      d.date ? new Date(d.date).toISOString().slice(0, 10) : "",
      d.id?.slice(-8) || "",
      d.libelle,
      d.chantier?.nom || "",
      Math.round(d.montant || 0),
      "",
      d.paye ? "Payée" : "À payer",
    ]);
  }

  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return [
    `# Journal comptable simplifié — ${data.orgNom || ""} — ${new Date().toISOString().slice(0, 10)}`,
    headers.join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\r\n");
}
