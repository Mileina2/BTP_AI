/** Mappe les enums Prisma vers les labels français utilisés par le front legacy */

export const CHANTIER_STATUT_LABEL = {
  EN_PREPARATION: "En préparation",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
  SUSPENDU: "Suspendu",
};

export const CHANTIER_STATUT_FROM_LABEL = Object.fromEntries(
  Object.entries(CHANTIER_STATUT_LABEL).map(([k, v]) => [v, k])
);

export const DEVIS_STATUT_LABEL = {
  EN_ATTENTE: "En attente",
  ENVOYE: "Envoyé",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
};

export const DEVIS_STATUT_FROM_LABEL = Object.fromEntries(
  Object.entries(DEVIS_STATUT_LABEL).map(([k, v]) => [v, k])
);

export const FACTURE_STATUT_LABEL = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PARTIELLEMENT_PAYEE: "Partiellement payée",
  PAYEE: "Payée",
  IMPAYEE: "Impayée",
  ANNULEE: "Annulée",
};

export const FACTURE_STATUT_FROM_LABEL = Object.fromEntries(
  Object.entries(FACTURE_STATUT_LABEL).map(([k, v]) => [v, k])
);

export const MODE_PAIEMENT_LABEL = {
  ESPECES: "Espèces",
  VIREMENT: "Virement bancaire",
  CHEQUE: "Chèque",
  MOBILE_MONEY: "Mobile Money",
};

export const MODE_PAIEMENT_FROM_LABEL = Object.fromEntries(
  Object.entries(MODE_PAIEMENT_LABEL).map(([k, v]) => [v, k])
);

export const CLIENT_RELATION_LABEL = {
  PROSPECT: "Prospect",
  ACTIF: "Actif",
  INACTIF: "Inactif",
  VIP: "VIP",
};

export const CLIENT_RELATION_FROM_LABEL = Object.fromEntries(
  Object.entries(CLIENT_RELATION_LABEL).map(([k, v]) => [v, k])
);

export const CLIENT_TYPE_LABEL = {
  PARTICULIER: "Particulier",
  ENTREPRISE: "Entreprise",
};

export const CLIENT_TYPE_FROM_LABEL = Object.fromEntries(
  Object.entries(CLIENT_TYPE_LABEL).map(([k, v]) => [v, k])
);

export const EQUIPE_STATUT_LABEL = {
  ACTIF: "Actif",
  INACTIF: "Inactif",
  ARCHIVE: "Archivé",
};

export const TYPE_TRAVAUX_LABEL = {
  CONSTRUCTION: "Construction",
  RENOVATION: "Rénovation",
  AMENAGEMENT: "Aménagement",
  INFRASTRUCTURE: "Infrastructure",
  AUTRE: "Autre",
};

export const TYPE_TRAVAUX_FROM_LABEL = Object.fromEntries(
  Object.entries(TYPE_TRAVAUX_LABEL).map(([k, v]) => [v, k])
);

/** Compatibilité MongoDB _id → id */
export function toLegacy(doc) {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(toLegacy);
  const { id, ...rest } = doc;
  return { _id: id, id, ...rest };
}

export function getOrgId(user) {
  return user.organizationId || user.organization?.id;
}

export function getUserId(user) {
  return user.id || user._id;
}

export async function genererNumero(prefix, count) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}
