/**
 * Plan comptable SYSCOHADA révisé — version PME BTP Afrique francophone (OHADA).
 * Adapté Côte d'Ivoire / UEMOA (XOF). Comptes essentiels pour ventes, achats, trésorerie.
 */
export const SYSCOHADA_BTP_PLAN = [
  { numero: "101000", libelle: "Capital social", classe: 1, typeCompte: "PASSIF" },
  { numero: "120000", libelle: "Résultat de l'exercice", classe: 1, typeCompte: "PASSIF" },
  { numero: "218100", libelle: "Matériel et outillage", classe: 2, typeCompte: "ACTIF" },
  { numero: "321000", libelle: "Matières premières et fournitures", classe: 3, typeCompte: "ACTIF" },
  { numero: "401000", libelle: "Fournisseurs", classe: 4, typeCompte: "PASSIF" },
  { numero: "411000", libelle: "Clients", classe: 4, typeCompte: "ACTIF" },
  { numero: "443000", libelle: "État — TVA facturée", classe: 4, typeCompte: "PASSIF" },
  { numero: "445000", libelle: "État — TVA due", classe: 4, typeCompte: "PASSIF" },
  { numero: "444000", libelle: "État — impôts et taxes", classe: 4, typeCompte: "PASSIF" },
  { numero: "521000", libelle: "Banques", classe: 5, typeCompte: "TRESORERIE" },
  { numero: "571000", libelle: "Caisse", classe: 5, typeCompte: "TRESORERIE" },
  { numero: "572000", libelle: "Mobile Money (Orange / MTN / Wave)", classe: 5, typeCompte: "TRESORERIE" },
  { numero: "601000", libelle: "Achats de matières premières", classe: 6, typeCompte: "CHARGE" },
  { numero: "604000", libelle: "Achats de matières consommables", classe: 6, typeCompte: "CHARGE" },
  { numero: "604100", libelle: "Sous-traitance BTP", classe: 6, typeCompte: "CHARGE" },
  { numero: "621000", libelle: "Personnel — salaires", classe: 6, typeCompte: "CHARGE" },
  { numero: "622000", libelle: "Rémunérations d'intermédiaires", classe: 6, typeCompte: "CHARGE" },
  { numero: "631000", libelle: "Impôts et taxes", classe: 6, typeCompte: "CHARGE" },
  { numero: "641000", libelle: "Charges de personnel", classe: 6, typeCompte: "CHARGE" },
  { numero: "658000", libelle: "Charges diverses de gestion", classe: 6, typeCompte: "CHARGE" },
  { numero: "701000", libelle: "Ventes de produits finis", classe: 7, typeCompte: "PRODUIT" },
  { numero: "706000", libelle: "Prestations de services BTP", classe: 7, typeCompte: "PRODUIT" },
  { numero: "707000", libelle: "Ventes de marchandises", classe: 7, typeCompte: "PRODUIT" },
];

export const JOURNAL_LABELS = {
  VT: "Journal des ventes",
  AC: "Journal des achats",
  BQ: "Journal de banque",
  CA: "Journal de caisse",
  MM: "Journal Mobile Money",
  OD: "Opérations diverses",
  AN: "À-nouveaux",
};

export const CHARGE_BY_CATEGORIE = {
  Matériaux: "601000",
  "Main-d'œuvre": "621000",
  Transport: "658000",
  "Sous-traitance": "604100",
  Autre: "604000",
};

export function tresorerieCompte(modePaiement) {
  switch (modePaiement) {
    case "ESPECES":
      return "571000";
    case "MOBILE_MONEY":
      return "572000";
    case "VIREMENT":
    case "CHEQUE":
    default:
      return "521000";
  }
}

export function journalFromModePaiement(modePaiement) {
  switch (modePaiement) {
    case "ESPECES":
      return "CA";
    case "MOBILE_MONEY":
      return "MM";
    default:
      return "BQ";
  }
}
