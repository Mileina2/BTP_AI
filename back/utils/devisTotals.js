export function ligneTotal(l) {
  return (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0);
}

export function lignesActives(lignes = []) {
  return lignes.filter((l) => l.designation?.trim());
}

export function lignesPrincipales(lignes = []) {
  return lignesActives(lignes).filter((l) => !l.isOption);
}

export function lignesOptions(lignes = []) {
  return lignesActives(lignes).filter((l) => l.isOption);
}

export function computeDevisAmounts(lignes = [], defaultTva = 18, remisePercent = 0, retenueGarantie = 0) {
  const main = lignesPrincipales(lignes);
  const options = lignesOptions(lignes);
  const montantHTBrut = main.reduce((s, l) => s + ligneTotal(l), 0);
  const pct = Math.min(100, Math.max(0, Number(remisePercent) || 0));
  const montantRemise = pct > 0 ? (montantHTBrut * pct) / 100 : 0;

  const lineNets = main.map((l) => {
    const lt = ligneTotal(l);
    const weight = montantHTBrut > 0 ? lt / montantHTBrut : 0;
    const netHT = lt - montantRemise * weight;
    const tvaRate = Number(l.tva ?? defaultTva) || 0;
    return { netHT, tvaRate, tvaAmount: (netHT * tvaRate) / 100 };
  });

  const montantHT = lineNets.reduce((s, x) => s + x.netHT, 0);
  const montantTVA = lineNets.reduce((s, x) => s + x.tvaAmount, 0);
  const montantTTC = montantHT + montantTVA;

  const tvaMap = new Map();
  for (const x of lineNets) {
    const key = String(x.tvaRate);
    if (!tvaMap.has(key)) tvaMap.set(key, { rate: x.tvaRate, baseHT: 0, montantTVA: 0 });
    const g = tvaMap.get(key);
    g.baseHT += x.netHT;
    g.montantTVA += x.tvaAmount;
  }
  const tvaBreakdown = [...tvaMap.values()].sort((a, b) => b.rate - a.rate);

  const retenuePct = Math.min(100, Math.max(0, Number(retenueGarantie) || 0));
  const montantRetenue = retenuePct > 0 ? (montantTTC * retenuePct) / 100 : 0;
  const netAPayer = montantTTC - montantRetenue;
  const optionsHT = options.reduce((s, l) => s + ligneTotal(l), 0);

  return {
    montantHTBrut,
    montantRemise,
    remisePercent: pct,
    montantHT,
    montantTVA,
    montantTTC,
    tvaBreakdown,
    retenueGarantie: retenuePct,
    montantRetenue,
    netAPayer,
    optionsHT,
    nbLignes: main.length,
    nbOptions: options.length,
  };
}

export function groupLignesBySection(lignes = [], { optionsOnly = false } = {}) {
  const pool = optionsOnly ? lignesOptions(lignes) : lignesPrincipales(lignes);
  const groups = new Map();
  const order = [];

  for (const l of pool) {
    const section = optionsOnly ? "Options et variantes" : l.section?.trim() || "Général";
    if (!groups.has(section)) {
      groups.set(section, []);
      order.push(section);
    }
    groups.get(section).push(l);
  }

  return order.map((section) => {
    const items = groups.get(section);
    return {
      section,
      lignes: items,
      subtotal: items.reduce((s, l) => s + ligneTotal(l), 0),
      isOptions: optionsOnly,
    };
  });
}

export function shouldShowSections(groups) {
  return groups.length > 1 || (groups.length === 1 && groups[0].section !== "Général");
}

export const SECTION_REF_PREFIX = {
  "Général": "GEN",
  "Gros œuvre": "GO",
  "Second œuvre": "SO",
  "Lots techniques": "LT",
  "Finitions": "FIN",
  "Divers": "DIV",
};

export function autoGenerateReferences(lignes = []) {
  const counters = {};
  return lignes.map((l) => {
    if (!l.designation?.trim() || l.reference?.trim()) return l;
    const section = l.section?.trim() || "Général";
    const prefix = SECTION_REF_PREFIX[section] || "LIG";
    counters[prefix] = (counters[prefix] || 0) + 1;
    return { ...l, reference: `${prefix}-${String(counters[prefix]).padStart(2, "0")}` };
  });
}

export const TVA_RATES = [0, 10, 18];
