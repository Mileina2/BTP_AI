/** Pages accessibles par rôle (clés = hash App.jsx). */
export const NAV_KEYS_BY_ROLE = {
  ENTREPRENEUR: [
    "entreprise",
    "acces",
    "dashboard",
    "chantiers",
    "terrain",
    "clients",
    "devis",
    "factures",
    "compta",
    "tresorerie",
    "fournisseurs",
    "conformite",
    "budget",
    "equipe",
    "stock",
  ],
  ADMIN: [
    "entreprise",
    "acces",
    "dashboard",
    "chantiers",
    "terrain",
    "clients",
    "devis",
    "factures",
    "compta",
    "tresorerie",
    "fournisseurs",
    "conformite",
    "budget",
    "equipe",
    "stock",
  ],
  CHEF_CHANTIER: ["chantiers", "terrain", "stock"],
  CLIENT: ["portail"],
};

export const DEFAULT_PAGE_BY_ROLE = {
  ENTREPRENEUR: "dashboard",
  ADMIN: "dashboard",
  CHEF_CHANTIER: "terrain",
  CLIENT: "portail",
};

export const ROLE_LABELS = {
  ENTREPRENEUR: "Entrepreneur",
  CHEF_CHANTIER: "Chef de chantier",
  CLIENT: "Propriétaire",
  ADMIN: "Administrateur",
};

export function navKeysForRole(role) {
  return NAV_KEYS_BY_ROLE[role] || NAV_KEYS_BY_ROLE.ENTREPRENEUR;
}

export function defaultPageForRole(role) {
  return DEFAULT_PAGE_BY_ROLE[role] || "dashboard";
}
