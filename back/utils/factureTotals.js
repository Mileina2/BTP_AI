import {
  ligneTotal,
  lignesActives,
  computeDevisAmounts,
  groupLignesBySection,
  shouldShowSections,
} from "./devisTotals.js";

export {
  ligneTotal,
  lignesActives,
  computeDevisAmounts as computeFactureAmounts,
  groupLignesBySection,
  shouldShowSections,
};

export function applyFactureStoredAmounts(data, lignes, defaultTva = 18, remisePercent = 0, retenueGarantie = 0) {
  const amounts = computeDevisAmounts(lignes, defaultTva, remisePercent, retenueGarantie);
  data.montantHT = amounts.montantHT;
  data.montantTVA = amounts.montantTVA;
  data.montantTTC = amounts.montantTTC;
  return amounts;
}
