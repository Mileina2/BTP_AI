import prisma from "../config/prisma.js";
import {
  SYSCOHADA_BTP_PLAN,
  JOURNAL_LABELS,
  CHARGE_BY_CATEGORIE,
  tresorerieCompte,
  journalFromModePaiement,
} from "../utils/syscohadaPlan.js";

function roundXof(n) {
  return Math.round(Number(n) || 0);
}

function exerciceFromDate(d) {
  return new Date(d).getFullYear();
}

function inExercice(dateEcriture, year) {
  return exerciceFromDate(dateEcriture) === year;
}

async function getCompteMap(organizationId) {
  const comptes = await prisma.compteComptable.findMany({ where: { organizationId, actif: true } });
  const map = new Map(comptes.map((c) => [c.numero, c]));
  return { comptes, map, byId: new Map(comptes.map((c) => [c.id, c])) };
}

function compteOrThrow(map, numero) {
  const c = map.get(numero);
  if (!c) throw new Error(`Compte SYSCOHADA ${numero} introuvable — initialisez le plan comptable.`);
  return c;
}

function balancedLines(lines) {
  const debit = lines.reduce((s, l) => s + roundXof(l.debit), 0);
  const credit = lines.reduce((s, l) => s + roundXof(l.credit), 0);
  if (Math.abs(debit - credit) > 0.01) {
    throw new Error(`Écriture déséquilibrée : débit ${debit} ≠ crédit ${credit}`);
  }
  return lines.map((l) => ({
    compteId: l.compteId,
    debit: roundXof(l.debit),
    credit: roundXof(l.credit),
    libelle: l.libelle || null,
  }));
}

export async function initSyscohadaPlan(organizationId) {
  const existing = await prisma.compteComptable.count({ where: { organizationId } });
  if (existing > 0) {
    const comptes = await prisma.compteComptable.findMany({
      where: { organizationId },
      orderBy: [{ classe: "asc" }, { numero: "asc" }],
    });
    return { initialized: false, count: comptes.length, comptes };
  }

  await prisma.compteComptable.createMany({
    data: SYSCOHADA_BTP_PLAN.map((c) => ({
      organizationId,
      numero: c.numero,
      libelle: c.libelle,
      classe: c.classe,
      typeCompte: c.typeCompte,
      systeme: true,
    })),
  });

  const comptes = await prisma.compteComptable.findMany({
    where: { organizationId },
    orderBy: [{ classe: "asc" }, { numero: "asc" }],
  });
  return { initialized: true, count: comptes.length, comptes };
}

export async function ensureSyscohadaPlan(organizationId) {
  const count = await prisma.compteComptable.count({ where: { organizationId } });
  if (count === 0) return initSyscohadaPlan(organizationId);
  const comptes = await prisma.compteComptable.findMany({
    where: { organizationId },
    orderBy: [{ classe: "asc" }, { numero: "asc" }],
  });
  return { initialized: false, count: comptes.length, comptes };
}

async function nextEcritureNumero(organizationId, journal, exercice) {
  const count = await prisma.ecritureComptable.count({
    where: { organizationId, journal, exercice },
  });
  const seq = String(count + 1).padStart(4, "0");
  return `${journal}-${exercice}-${seq}`;
}

async function createEcriture(organizationId, data, lines) {
  const mapped = balancedLines(lines);
  return prisma.ecritureComptable.create({
    data: {
      organizationId,
      journal: data.journal,
      numero: data.numero,
      dateEcriture: data.dateEcriture,
      libelle: data.libelle,
      reference: data.reference || null,
      sourceType: data.sourceType || "MANUEL",
      sourceKey: data.sourceKey || null,
      exercice: data.exercice,
      verrouillee: data.verrouillee ?? false,
      lignes: { create: mapped },
    },
    include: {
      lignes: { include: { compte: true } },
    },
  });
}

export async function syncEcritureFacture(organizationId, facture, { map } = {}) {
  if (!map) ({ map } = await getCompteMap(organizationId));
  if (facture.statut === "BROUILLON" || facture.statut === "ANNULEE") return null;

  const sourceKey = `FACTURE:${facture.id}`;
  const existing = await prisma.ecritureComptable.findUnique({
    where: { organizationId_sourceKey: { organizationId, sourceKey } },
  });
  if (existing) return { created: false, ecriture: existing };

  const ht = roundXof(facture.montantHT);
  const tva = roundXof(facture.montantTVA);
  const ttc = roundXof(facture.montantTTC);
  const date = facture.dateEmission || facture.createdAt || new Date();
  const exercice = exerciceFromDate(date);
  const numero = await nextEcritureNumero(organizationId, "VT", exercice);

  const c411 = compteOrThrow(map, "411000");
  const c706 = compteOrThrow(map, "706000");
  const c443 = compteOrThrow(map, "443000");

  return { created: true, ecriture: await createEcriture(
    organizationId,
    {
      journal: "VT",
      numero,
      dateEcriture: date,
      libelle: `Facture ${facture.numero}`,
      reference: facture.numero,
      sourceType: "FACTURE",
      sourceKey,
      exercice,
      verrouillee: true,
    },
    [
      { compteId: c411.id, debit: ttc, credit: 0, libelle: facture.client?.nom || "Client" },
      { compteId: c706.id, debit: 0, credit: ht, libelle: "Prestations BTP" },
      { compteId: c443.id, debit: 0, credit: tva, libelle: `TVA ${facture.tva ?? 18}%` },
    ]
  ) };
}

export async function syncEcriturePaiement(organizationId, paiement, facture, { map } = {}) {
  if (!map) ({ map } = await getCompteMap(organizationId));

  const sourceKey = `PAIEMENT:${paiement.id}`;
  const existing = await prisma.ecritureComptable.findUnique({
    where: { organizationId_sourceKey: { organizationId, sourceKey } },
  });
  if (existing) return { created: false, ecriture: existing };

  const montant = roundXof(paiement.montant);
  const mode = paiement.modePaiement || facture.modePaiement || "VIREMENT";
  const journal = journalFromModePaiement(mode);
  const tresoNum = tresorerieCompte(mode);
  const date = paiement.datePaiement || new Date();
  const exercice = exerciceFromDate(date);
  const numero = await nextEcritureNumero(organizationId, journal, exercice);

  const cTreso = compteOrThrow(map, tresoNum);
  const c411 = compteOrThrow(map, "411000");

  return { created: true, ecriture: await createEcriture(
    organizationId,
    {
      journal,
      numero,
      dateEcriture: date,
      libelle: `Encaissement facture ${facture.numero}`,
      reference: paiement.reference || facture.numero,
      sourceType: "PAIEMENT",
      sourceKey,
      exercice,
      verrouillee: true,
    },
    [
      { compteId: cTreso.id, debit: montant, credit: 0, libelle: JOURNAL_LABELS[journal] },
      { compteId: c411.id, debit: 0, credit: montant, libelle: facture.client?.nom || "Client" },
    ]
  ) };
}

export async function syncEcritureDepense(organizationId, depense, { map } = {}) {
  if (!map) ({ map } = await getCompteMap(organizationId));

  const sourceKey = `DEPENSE:${depense.id}`;
  const existing = await prisma.ecritureComptable.findUnique({
    where: { organizationId_sourceKey: { organizationId, sourceKey } },
  });
  if (existing) return { created: false, ecriture: existing };

  const montant = roundXof(depense.montant);
  const chargeNum = CHARGE_BY_CATEGORIE[depense.categorie] || CHARGE_BY_CATEGORIE.Autre;
  const date = depense.date || new Date();
  const exercice = exerciceFromDate(date);
  const numero = await nextEcritureNumero(organizationId, "AC", exercice);

  const cCharge = compteOrThrow(map, chargeNum);
  const lines = [{ compteId: cCharge.id, debit: montant, credit: 0, libelle: depense.libelle }];

  if (depense.paye) {
    const c521 = compteOrThrow(map, "521000");
    lines.push({ compteId: c521.id, debit: 0, credit: montant, libelle: "Règlement charge" });
  } else {
    const c401 = compteOrThrow(map, "401000");
    lines.push({ compteId: c401.id, debit: 0, credit: montant, libelle: depense.fournisseur || "Fournisseur" });
  }

  return { created: true, ecriture: await createEcriture(
    organizationId,
    {
      journal: "AC",
      numero,
      dateEcriture: date,
      libelle: depense.libelle,
      reference: depense.chantier?.nom || null,
      sourceType: "DEPENSE",
      sourceKey,
      exercice,
      verrouillee: true,
    },
    lines
  ) };
}

export async function syncEcritureAvoir(organizationId, avoir, facture, { map } = {}) {
  if (!map) ({ map } = await getCompteMap(organizationId));

  const sourceKey = `AVOIR:${avoir.id}`;
  const existing = await prisma.ecritureComptable.findUnique({
    where: { organizationId_sourceKey: { organizationId, sourceKey } },
  });
  if (existing) return { created: false, ecriture: existing };

  const ht = roundXof(avoir.montantHT);
  const tva = roundXof(avoir.montantTVA);
  const ttc = roundXof(avoir.montantTTC);
  const date = avoir.dateEmission || new Date();
  const exercice = exerciceFromDate(date);
  const numero = await nextEcritureNumero(organizationId, "VT", exercice);

  const c411 = compteOrThrow(map, "411000");
  const c706 = compteOrThrow(map, "706000");
  const c443 = compteOrThrow(map, "443000");

  return { created: true, ecriture: await createEcriture(
    organizationId,
    {
      journal: "VT",
      numero,
      dateEcriture: date,
      libelle: `Avoir ${avoir.numero} — ${facture.numero}`,
      reference: avoir.numero,
      sourceType: "AVOIR",
      sourceKey,
      exercice,
      verrouillee: true,
    },
    [
      { compteId: c706.id, debit: ht, credit: 0, libelle: "Contrepassation produit" },
      { compteId: c443.id, debit: tva, credit: 0, libelle: "Contrepassation TVA" },
      { compteId: c411.id, debit: 0, credit: ttc, libelle: "Crédit client" },
    ]
  ) };
}

export async function getSyncStatus(organizationId, { year } = {}) {
  const yearNum = Number(year) || new Date().getFullYear();
  const start = new Date(yearNum, 0, 1);
  const end = new Date(yearNum, 11, 31, 23, 59, 59);

  const [planCount, ecritures, factures, paiements, depenses, avoirs] = await Promise.all([
    prisma.compteComptable.count({ where: { organizationId } }),
    prisma.ecritureComptable.findMany({
      where: { organizationId, exercice: yearNum },
      select: { sourceKey: true, sourceType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.facture.findMany({
      where: {
        organizationId,
        statut: { notIn: ["BROUILLON", "ANNULEE"] },
        dateEmission: { gte: start, lte: end },
      },
      select: {
        id: true,
        numero: true,
        dateEmission: true,
        montantTTC: true,
        statut: true,
        client: { select: { nom: true } },
      },
    }),
    prisma.facturePaiement.findMany({
      where: {
        facture: { organizationId },
        datePaiement: { gte: start, lte: end },
      },
      select: {
        id: true,
        montant: true,
        datePaiement: true,
        facture: { select: { numero: true } },
      },
    }),
    prisma.depense.findMany({
      where: { organizationId, date: { gte: start, lte: end } },
      select: {
        id: true,
        libelle: true,
        montant: true,
        date: true,
        paye: true,
        chantier: { select: { nom: true } },
      },
    }),
    prisma.avoir.findMany({
      where: {
        organizationId,
        statut: { in: ["EMIS", "APPLIQUE"] },
        dateEmission: { gte: start, lte: end },
      },
      select: { id: true, numero: true, montantTTC: true, dateEmission: true },
    }),
  ]);

  const syncedKeys = new Set(ecritures.map((e) => e.sourceKey).filter(Boolean));

  const items = [];

  for (const f of factures) {
    const key = `FACTURE:${f.id}`;
    if (!syncedKeys.has(key)) {
      items.push({
        type: "facture",
        sourceKey: key,
        id: f.id,
        label: f.numero,
        detail: f.client?.nom || "Client",
        montant: roundXof(f.montantTTC),
        date: f.dateEmission,
        action: "factures",
      });
    }
  }

  for (const p of paiements) {
    const key = `PAIEMENT:${p.id}`;
    if (!syncedKeys.has(key)) {
      items.push({
        type: "paiement",
        sourceKey: key,
        id: p.id,
        label: p.facture?.numero || "Encaissement",
        detail: `Paiement ${roundXof(p.montant).toLocaleString("fr-FR")} FCFA`,
        montant: roundXof(p.montant),
        date: p.datePaiement,
        action: "factures",
      });
    }
  }

  for (const d of depenses) {
    const key = `DEPENSE:${d.id}`;
    if (!syncedKeys.has(key)) {
      items.push({
        type: "depense",
        sourceKey: key,
        id: d.id,
        label: d.libelle,
        detail: d.chantier?.nom || "Chantier",
        montant: roundXof(d.montant),
        date: d.date,
        paye: d.paye,
        action: "budget",
      });
    }
  }

  for (const a of avoirs) {
    const key = `AVOIR:${a.id}`;
    if (!syncedKeys.has(key)) {
      items.push({
        type: "avoir",
        sourceKey: key,
        id: a.id,
        label: a.numero,
        detail: "Avoir client",
        montant: roundXof(a.montantTTC),
        date: a.dateEmission,
        action: "factures",
      });
    }
  }

  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const manquantes = {
    factures: items.filter((i) => i.type === "facture").length,
    paiements: items.filter((i) => i.type === "paiement").length,
    depenses: items.filter((i) => i.type === "depense").length,
    avoirs: items.filter((i) => i.type === "avoir").length,
    total: items.length,
  };

  const synced = {
    factures: factures.length - manquantes.factures,
    paiements: paiements.length - manquantes.paiements,
    depenses: depenses.length - manquantes.depenses,
    avoirs: avoirs.length - manquantes.avoirs,
  };

  const derniereSync = ecritures.length ? ecritures[0].createdAt : null;

  return {
    exercice: yearNum,
    planInitialise: planCount > 0,
    ecrituresCount: ecritures.length,
    sourcesAttendues: factures.length + paiements.length + depenses.length + avoirs.length,
    manquantes,
    synced,
    aJour: manquantes.total === 0 && planCount > 0,
    derniereSync,
    items: items.slice(0, 30),
  };
}

export async function syncComptabiliteSyscohada(organizationId, { year } = {}) {
  await ensureSyscohadaPlan(organizationId);
  const { map } = await getCompteMap(organizationId);

  const yearFilter = year ? Number(year) : null;

  const [factures, paiements, depenses, avoirs] = await Promise.all([
    prisma.facture.findMany({
      where: {
        organizationId,
        statut: { notIn: ["BROUILLON", "ANNULEE"] },
        ...(yearFilter
          ? {
              dateEmission: {
                gte: new Date(yearFilter, 0, 1),
                lte: new Date(yearFilter, 11, 31, 23, 59, 59),
              },
            }
          : {}),
      },
      include: { client: { select: { nom: true } } },
    }),
    prisma.facturePaiement.findMany({
      where: { facture: { organizationId } },
      include: { facture: { include: { client: { select: { nom: true } } } } },
    }),
    prisma.depense.findMany({
      where: { organizationId },
      include: { chantier: { select: { nom: true } } },
    }),
    prisma.avoir.findMany({
      where: { organizationId, statut: { in: ["EMIS", "APPLIQUE"] } },
      include: { facture: true },
    }),
  ]);

  const results = { factures: 0, paiements: 0, depenses: 0, avoirs: 0, errors: [] };

  for (const f of factures) {
    try {
      const r = await syncEcritureFacture(organizationId, f, { map });
      if (r?.created) results.factures += 1;
    } catch (err) {
      results.errors.push(`Facture ${f.numero}: ${err.message}`);
    }
  }

  for (const p of paiements) {
    if (yearFilter && !inExercice(p.datePaiement, yearFilter)) continue;
    try {
      const r = await syncEcriturePaiement(organizationId, p, p.facture, { map });
      if (r?.created) results.paiements += 1;
    } catch (err) {
      results.errors.push(`Paiement: ${err.message}`);
    }
  }

  for (const d of depenses) {
    if (yearFilter && !inExercice(d.date, yearFilter)) continue;
    try {
      const r = await syncEcritureDepense(organizationId, d, { map });
      if (r?.created) results.depenses += 1;
    } catch (err) {
      results.errors.push(`Dépense ${d.libelle}: ${err.message}`);
    }
  }

  for (const a of avoirs) {
    if (yearFilter && !inExercice(a.dateEmission, yearFilter)) continue;
    try {
      const r = await syncEcritureAvoir(organizationId, a, a.facture, { map });
      if (r?.created) results.avoirs += 1;
    } catch (err) {
      results.errors.push(`Avoir ${a.numero}: ${err.message}`);
    }
  }

  return results;
}

export async function createEcritureManuelle(organizationId, body) {
  await ensureSyscohadaPlan(organizationId);
  const { map } = await getCompteMap(organizationId);

  const { journal = "OD", dateEcriture, libelle, reference, lignes = [] } = body;
  if (!libelle?.trim()) throw new Error("Libellé requis.");
  if (lignes.length < 2) throw new Error("Au moins 2 lignes (débit/crédit).");

  const date = dateEcriture ? new Date(dateEcriture) : new Date();
  const exercice = exerciceFromDate(date);
  const j = ["VT", "AC", "BQ", "CA", "MM", "OD", "AN"].includes(journal) ? journal : "OD";
  const numero = await nextEcritureNumero(organizationId, j, exercice);

  const mappedLines = lignes.map((l) => {
    const compte = l.compteId
      ? { id: l.compteId }
      : compteOrThrow(map, l.compteNumero);
    return {
      compteId: compte.id,
      debit: l.debit,
      credit: l.credit,
      libelle: l.libelle,
    };
  });

  return createEcriture(
    organizationId,
    {
      journal: j,
      numero,
      dateEcriture: date,
      libelle: libelle.trim(),
      reference: reference?.trim() || null,
      sourceType: "MANUEL",
      sourceKey: null,
      exercice,
    },
    mappedLines
  );
}

export async function getPlanComptable(organizationId) {
  await ensureSyscohadaPlan(organizationId);
  return prisma.compteComptable.findMany({
    where: { organizationId, actif: true },
    orderBy: [{ classe: "asc" }, { numero: "asc" }],
  });
}

export async function getJournalComptable(organizationId, { year, journal } = {}) {
  const yearNum = Number(year) || new Date().getFullYear();
  const where = { organizationId, exercice: yearNum };
  if (journal && journal !== "TOUS") where.journal = journal;

  const ecritures = await prisma.ecritureComptable.findMany({
    where,
    include: {
      lignes: { include: { compte: true } },
    },
    orderBy: [{ dateEcriture: "asc" }, { numero: "asc" }],
  });

  return ecritures.map((e) => ({
    id: e.id,
    numero: e.numero,
    journal: e.journal,
    journalLabel: JOURNAL_LABELS[e.journal] || e.journal,
    dateEcriture: e.dateEcriture,
    libelle: e.libelle,
    reference: e.reference,
    sourceType: e.sourceType,
    verrouillee: e.verrouillee,
    totalDebit: e.lignes.reduce((s, l) => s + l.debit, 0),
    totalCredit: e.lignes.reduce((s, l) => s + l.credit, 0),
    lignes: e.lignes.map((l) => ({
      id: l.id,
      compteNumero: l.compte.numero,
      compteLibelle: l.compte.libelle,
      debit: l.debit,
      credit: l.credit,
      libelle: l.libelle,
    })),
  }));
}

export async function getBalanceComptable(organizationId, { year } = {}) {
  const yearNum = Number(year) || new Date().getFullYear();
  await ensureSyscohadaPlan(organizationId);

  const comptes = await prisma.compteComptable.findMany({
    where: { organizationId, actif: true },
    orderBy: [{ classe: "asc" }, { numero: "asc" }],
  });

  const lignes = await prisma.ecritureLigne.findMany({
    where: {
      ecriture: { organizationId, exercice: yearNum },
    },
    include: { compte: true },
  });

  const totals = new Map();
  for (const l of lignes) {
    if (!totals.has(l.compteId)) {
      totals.set(l.compteId, { debit: 0, credit: 0 });
    }
    const t = totals.get(l.compteId);
    t.debit += l.debit;
    t.credit += l.credit;
  }

  const rows = comptes.map((c) => {
    const t = totals.get(c.id) || { debit: 0, credit: 0 };
    const debit = roundXof(t.debit);
    const credit = roundXof(t.credit);
    const solde = debit - credit;
    return {
      compteId: c.id,
      numero: c.numero,
      libelle: c.libelle,
      classe: c.classe,
      typeCompte: c.typeCompte,
      totalDebit: debit,
      totalCredit: credit,
      soldeDebiteur: solde > 0 ? solde : 0,
      soldeCrediteur: solde < 0 ? Math.abs(solde) : 0,
      solde,
    };
  });

  const actifs = rows.filter((r) => r.totalDebit > 0 || r.totalCredit > 0);
  const totalDebit = actifs.reduce((s, r) => s + r.totalDebit, 0);
  const totalCredit = actifs.reduce((s, r) => s + r.totalCredit, 0);

  const produits = rows.filter((r) => r.classe === 7 && (r.totalDebit > 0 || r.totalCredit > 0));
  const charges = rows.filter((r) => r.classe === 6 && (r.totalDebit > 0 || r.totalCredit > 0));
  const totalProduits = produits.reduce((s, r) => s + (r.totalCredit - r.totalDebit), 0);
  const totalCharges = charges.reduce((s, r) => s + (r.totalDebit - r.totalCredit), 0);

  return {
    exercice: yearNum,
    norme: "SYSCOHADA révisé — OHADA / UEMOA (XOF)",
    rows: actifs,
    totaux: {
      debit: totalDebit,
      credit: totalCredit,
      ecart: Math.abs(totalDebit - totalCredit),
      equilibre: Math.abs(totalDebit - totalCredit) < 1,
    },
    resultat: {
      produits: roundXof(totalProduits),
      charges: roundXof(totalCharges),
      net: roundXof(totalProduits - totalCharges),
    },
  };
}

export async function getGrandLivre(organizationId, { compteId, compteNumero, year } = {}) {
  const yearNum = Number(year) || new Date().getFullYear();
  await ensureSyscohadaPlan(organizationId);

  let compte;
  if (compteId) {
    compte = await prisma.compteComptable.findFirst({ where: { id: compteId, organizationId } });
  } else if (compteNumero) {
    compte = await prisma.compteComptable.findFirst({ where: { numero: compteNumero, organizationId } });
  }
  if (!compte) throw new Error("Compte introuvable.");

  const lignes = await prisma.ecritureLigne.findMany({
    where: {
      compteId: compte.id,
      ecriture: { organizationId, exercice: yearNum },
    },
    include: {
      ecriture: true,
    },
    orderBy: [{ ecriture: { dateEcriture: "asc" } }, { ecriture: { numero: "asc" } }],
  });

  let cumul = 0;
  const mouvements = lignes.map((l) => {
    cumul += l.debit - l.credit;
    return {
      date: l.ecriture.dateEcriture,
      ecritureNumero: l.ecriture.numero,
      journal: l.ecriture.journal,
      libelle: l.libelle || l.ecriture.libelle,
      reference: l.ecriture.reference,
      debit: l.debit,
      credit: l.credit,
      solde: roundXof(cumul),
    };
  });

  return {
    compte: { id: compte.id, numero: compte.numero, libelle: compte.libelle, classe: compte.classe },
    exercice: yearNum,
    mouvements,
    soldeFinal: roundXof(cumul),
  };
}

export function buildBalanceCsv(balance) {
  const headers = ["Classe", "N° compte", "Libellé", "Total débit", "Total crédit", "Solde débiteur", "Solde créditeur"];
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = balance.rows.map((r) =>
    [r.classe, r.numero, r.libelle, r.totalDebit, r.totalCredit, r.soldeDebiteur, r.soldeCrediteur]
      .map(escape)
      .join(",")
  );
  return [
    `# Balance générale SYSCOHADA — Exercice ${balance.exercice} — ${balance.norme}`,
    `# Résultat : Produits ${balance.resultat.produits} | Charges ${balance.resultat.charges} | Net ${balance.resultat.net}`,
    headers.join(","),
    ...rows,
  ].join("\r\n");
}

export function buildGrandLivreCsv(grandLivre) {
  const headers = ["Date", "Journal", "N° écriture", "Libellé", "Réf.", "Débit", "Crédit", "Solde"];
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const rows = grandLivre.mouvements.map((m) =>
    [fmtDate(m.date), m.journal, m.ecritureNumero, m.libelle, m.reference, m.debit, m.credit, m.solde]
      .map(escape)
      .join(",")
  );
  return [
    `# Grand livre — Compte ${grandLivre.compte.numero} ${grandLivre.compte.libelle} — Exercice ${grandLivre.exercice}`,
    `# Solde final : ${grandLivre.soldeFinal} XOF`,
    headers.join(","),
    ...rows,
  ].join("\r\n");
}
