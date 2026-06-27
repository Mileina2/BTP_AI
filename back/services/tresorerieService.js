import prisma from "../config/prisma.js";
import { computeFactureNetAPayer } from "../utils/facturePayments.js";

function roundXof(n) {
  return Math.round(Number(n) || 0);
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addWeeks(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n * 7);
  return x;
}

function weekLabel(start) {
  return start.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function daysUntil(date, now = new Date()) {
  if (!date) return null;
  return Math.ceil((new Date(date).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
}

function fluxMeta(date, now) {
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

export async function getTresorerieOverview(organizationId) {
  const [factures, allPaiements, recentPaiements, depenses, equipe, engagements] = await Promise.all([
    prisma.facture.findMany({
      where: { organizationId, statut: { notIn: ["BROUILLON", "ANNULEE"] } },
      include: {
        client: { select: { nom: true } },
        chantier: { select: { id: true, nom: true } },
      },
    }),
    prisma.facturePaiement.findMany({
      where: { facture: { organizationId } },
    }),
    prisma.facturePaiement.findMany({
      where: { facture: { organizationId } },
      include: {
        facture: {
          select: { numero: true, client: { select: { nom: true } } },
        },
      },
      orderBy: { datePaiement: "desc" },
      take: 12,
    }),
    prisma.depense.findMany({
      where: { organizationId },
      include: {
        chantier: { select: { id: true, nom: true } },
        fournisseurRef: { select: { nom: true } },
      },
    }),
    prisma.equipeMember.findMany({ where: { organizationId, statut: "ACTIF" } }),
    prisma.engagementFournisseur.findMany({
      where: { organizationId, statut: { in: ["COMMANDE", "LIVRE"] } },
      include: {
        fournisseur: { select: { nom: true } },
        chantier: { select: { id: true, nom: true } },
      },
    }),
  ]);

  const masseSalariale = equipe.reduce((s, m) => s + (m.salaireTotal || 0), 0);
  const now = new Date();

  let encaisseTotal = 0;
  let parCanal = { banque: 0, caisse: 0, mobileMoney: 0, autre: 0 };

  for (const p of allPaiements) {
    encaisseTotal += p.montant || 0;
    const mode = p.modePaiement || "VIREMENT";
    if (mode === "ESPECES") parCanal.caisse += p.montant || 0;
    else if (mode === "MOBILE_MONEY") parCanal.mobileMoney += p.montant || 0;
    else if (mode === "VIREMENT" || mode === "CHEQUE") parCanal.banque += p.montant || 0;
    else parCanal.autre += p.montant || 0;
  }

  const depensesPayees = depenses.filter((d) => d.paye).reduce((s, d) => s + (d.montant || 0), 0);
  const soldeActuel = encaisseTotal - depensesPayees;

  let creancesClients = 0;
  let creancesEnRetard = 0;
  const encaissementsPrevus = [];
  const creancesDetail = [];

  for (const f of factures) {
    const { netAPayer } = computeFactureNetAPayer(f);
    const reste = Math.max(0, netAPayer - (f.montantVerse || 0) - (f.montantAvoir || 0));
    if (reste <= 0) continue;
    creancesClients += reste;
    const dateRef = f.dateEcheance || f.dateEmission;
    const meta = fluxMeta(dateRef, now);
    if (meta.enRetard) creancesEnRetard += reste;

    const item = {
      id: f.id,
      factureId: f.id,
      numero: f.numero,
      libelle: `Facture ${f.numero}`,
      client: f.client?.nom,
      chantier: f.chantier?.nom,
      chantierId: f.chantierId,
      montant: reste,
      montantTTC: f.montantTTC,
      date: dateRef,
      dateEcheance: f.dateEcheance,
      statut: f.statut,
      ...meta,
      linkPage: "factures",
      type: "creance",
    };
    creancesDetail.push(item);
    encaissementsPrevus.push({ ...item, type: "creance" });
  }

  let dettesFournisseurs = 0;
  let dettesEnRetard = 0;
  const decaissementsPrevus = [];
  const dettesDetail = [];

  for (const d of depenses.filter((x) => !x.paye)) {
    dettesFournisseurs += d.montant || 0;
    const dateRef = d.dateEcheance || d.date;
    const meta = fluxMeta(dateRef, now);
    if (meta.enRetard) dettesEnRetard += d.montant || 0;

    const item = {
      id: d.id,
      depenseId: d.id,
      libelle: d.libelle,
      categorie: d.categorie,
      fournisseur: d.fournisseurRef?.nom || d.fournisseur,
      chantier: d.chantier?.nom,
      chantierId: d.chantierId,
      montant: d.montant || 0,
      date: dateRef,
      dateEcheance: d.dateEcheance,
      ...meta,
      linkPage: "budget",
      type: "depense",
    };
    dettesDetail.push(item);
    decaissementsPrevus.push({ ...item, type: "depense" });
  }

  for (const e of engagements) {
    if (e.statut === "PAYE" || e.statut === "ANNULE") continue;
    const montant = e.montantTTC || e.montant || 0;
    dettesFournisseurs += montant;
    const dateRef = e.dateEcheance || e.dateDevis || e.createdAt;
    const meta = fluxMeta(dateRef, now);
    if (meta.enRetard) dettesEnRetard += montant;

    const item = {
      id: e.id,
      engagementId: e.id,
      numero: e.numero,
      libelle: e.objet,
      fournisseur: e.fournisseur?.nom,
      chantier: e.chantier?.nom,
      chantierId: e.chantierId,
      montant,
      date: dateRef,
      dateEcheance: e.dateEcheance,
      statut: e.statut,
      ...meta,
      linkPage: "fournisseurs",
      type: "engagement",
    };
    dettesDetail.push(item);
    if (e.dateEcheance) decaissementsPrevus.push({ ...item, type: "engagement" });
  }

  if (masseSalariale > 0) {
    const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    decaissementsPrevus.push({
      date: finMois,
      montant: masseSalariale,
      libelle: "Masse salariale mensuelle",
      type: "salaire",
      linkPage: "equipe",
      enRetard: false,
      joursRestants: daysUntil(finMois, now),
    });
  }

  const sortByDate = (a, b) => new Date(a.date || 0) - new Date(b.date || 0);
  const sortRetardFirst = (a, b) => {
    if (a.enRetard !== b.enRetard) return a.enRetard ? -1 : 1;
    return sortByDate(a, b);
  };

  creancesDetail.sort(sortRetardFirst);
  dettesDetail.sort(sortRetardFirst);

  const horizonSemaines = 13;
  const weekStart = startOfWeek(now);
  let soldeCumule = soldeActuel;
  const prevision13s = [];

  for (let w = 0; w < horizonSemaines; w++) {
    const ws = addWeeks(weekStart, w);
    const we = addWeeks(ws, 1);

    let entrees = 0;
    let sorties = 0;

    for (const item of encaissementsPrevus) {
      const dt = new Date(item.date);
      if (dt >= ws && dt < we) entrees += item.montant;
    }
    for (const item of decaissementsPrevus) {
      const dt = new Date(item.date);
      if (dt >= ws && dt < we) sorties += item.montant;
    }

    if (w > 0 && masseSalariale > 0) {
      const payrollWeek = addWeeks(new Date(now.getFullYear(), now.getMonth(), 28), 0);
      if (payrollWeek >= ws && payrollWeek < we && w % 4 === 0) {
        sorties += masseSalariale;
      }
    }

    soldeCumule += entrees - sorties;
    prevision13s.push({
      semaine: weekLabel(ws),
      entrees: roundXof(entrees),
      sorties: roundXof(sorties),
      solde: roundXof(soldeCumule),
      alerte: soldeCumule < 0,
    });
  }

  const prevision30 = prevision13s.slice(0, 5).reduce((s, w) => s + w.sorties - w.entrees, 0);
  const prevision60 = prevision13s.slice(0, 9).reduce((s, w) => s + w.sorties - w.entrees, 0);
  const prevision90 = prevision13s.reduce((s, w) => s + w.sorties - w.entrees, 0);

  const alertes = [];
  if (soldeActuel < 0) {
    alertes.push({
      type: "critical",
      titre: "Trésorerie négative",
      message: "Encaissements insuffisants vs charges payées.",
    });
  }
  if (prevision13s.some((w) => w.alerte)) {
    alertes.push({
      type: "warning",
      titre: "Rupture prévue",
      message: "Solde projeté négatif dans les 13 prochaines semaines.",
    });
  }
  if (creancesEnRetard > 0) {
    alertes.push({
      type: "warning",
      titre: "Créances en retard",
      message: `${creancesDetail.filter((c) => c.enRetard).length} facture(s) — ${roundXof(creancesEnRetard).toLocaleString("fr-FR")} FCFA à relancer.`,
      linkPage: "factures",
    });
  }
  if (dettesEnRetard > 0) {
    alertes.push({
      type: "warning",
      titre: "Dettes échues",
      message: `${dettesDetail.filter((d) => d.enRetard).length} échéance(s) fournisseur dépassée(s).`,
      linkPage: "budget",
    });
  }
  if (creancesClients > dettesFournisseurs * 1.5 && creancesClients > 0) {
    alertes.push({
      type: "info",
      titre: "Créances élevées",
      message: "Relancez les clients — créances supérieures aux dettes fournisseurs.",
    });
  }

  const mouvementsRecents = [
    ...recentPaiements.map((p) => ({
      id: p.id,
      sens: "entree",
      date: p.datePaiement,
      montant: p.montant,
      libelle: `Paiement ${p.facture?.numero || ""}`,
      tiers: p.facture?.client?.nom,
      canal: p.modePaiement || "VIREMENT",
      linkPage: "factures",
      linkId: p.factureId,
    })),
    ...depenses
      .filter((d) => d.paye)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8)
      .map((d) => ({
        id: d.id,
        sens: "sortie",
        date: d.date,
        montant: d.montant,
        libelle: d.libelle,
        tiers: d.fournisseurRef?.nom || d.fournisseur,
        canal: "DEPENSE",
        linkPage: "budget",
        linkId: d.chantierId,
      })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  return {
    kpis: {
      soldeActuel: roundXof(soldeActuel),
      encaisseTotal: roundXof(encaisseTotal),
      depensesPayees: roundXof(depensesPayees),
      creancesClients: roundXof(creancesClients),
      creancesEnRetard: roundXof(creancesEnRetard),
      dettesFournisseurs: roundXof(dettesFournisseurs),
      dettesEnRetard: roundXof(dettesEnRetard),
      masseSalariale: roundXof(masseSalariale),
      positionNette: roundXof(soldeActuel + creancesClients - dettesFournisseurs),
      nbCreances: creancesDetail.length,
      nbDettes: dettesDetail.length,
    },
    canaux: {
      banque: roundXof(parCanal.banque),
      caisse: roundXof(parCanal.caisse),
      mobileMoney: roundXof(parCanal.mobileMoney),
      autre: roundXof(parCanal.autre),
    },
    prevision13s,
    horizons: {
      j30: roundXof(soldeActuel - prevision30),
      j60: roundXof(soldeActuel - prevision60),
      j90: roundXof(soldeActuel - prevision90),
    },
    creancesDetail,
    dettesDetail,
    prochainEncaissements: encaissementsPrevus.sort(sortByDate).slice(0, 10),
    prochainsDecaissements: decaissementsPrevus.sort(sortByDate).slice(0, 10),
    mouvementsRecents,
    alertes,
    devise: "XOF",
    region: "UEMOA / OHADA",
    generatedAt: new Date().toISOString(),
  };
}

export function buildTresorerieCsv(data) {
  const lines = [];
  lines.push("Section;Libellé;Tiers;Chantier;Date échéance;Montant (FCFA);Statut;Retard");

  for (const c of data.creancesDetail || []) {
    lines.push(
      [
        "Créance",
        c.libelle,
        c.client,
        c.chantier,
        c.dateEcheance ? new Date(c.dateEcheance).toLocaleDateString("fr-FR") : "—",
        c.montant,
        c.statut,
        c.enRetard ? "Oui" : "Non",
      ]
        .map(escapeCsv)
        .join(";")
    );
  }

  for (const d of data.dettesDetail || []) {
    lines.push(
      [
        d.type === "engagement" ? "Engagement" : "Dette",
        d.libelle,
        d.fournisseur,
        d.chantier,
        d.dateEcheance ? new Date(d.dateEcheance).toLocaleDateString("fr-FR") : "—",
        d.montant,
        d.statut || d.categorie || "",
        d.enRetard ? "Oui" : "Non",
      ]
        .map(escapeCsv)
        .join(";")
    );
  }

  lines.push("");
  lines.push("KPI;Valeur (FCFA)");
  for (const [k, v] of Object.entries(data.kpis || {})) {
    if (typeof v === "number") lines.push(`${k};${v}`);
  }

  return lines.join("\n");
}
