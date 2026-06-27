export const NAV_KEYS_BY_ROLE = {
  ENTREPRENEUR: [
    "dashboard",
    "chantiers",
    "factures",
    "tresorerie",
    "terrain",
    "stock",
    "menu",
  ],
  ADMIN: ["dashboard", "chantiers", "factures", "tresorerie", "terrain", "stock", "menu"],
  CHEF_CHANTIER: ["terrain", "chantiers", "stock", "menu"],
  CLIENT: ["portail"],
} as const;

export const TAB_LABELS: Record<string, string> = {
  dashboard: "Accueil",
  chantiers: "Chantiers",
  factures: "Factures",
  tresorerie: "Trésorerie",
  terrain: "Terrain",
  stock: "Stock",
  portail: "Mon chantier",
  menu: "Menu",
};

export const ROLE_LABELS: Record<string, string> = {
  ENTREPRENEUR: "Entrepreneur",
  CHEF_CHANTIER: "Chef de chantier",
  CLIENT: "Propriétaire",
  ADMIN: "Administrateur",
};

export type UserRole = keyof typeof NAV_KEYS_BY_ROLE;

export function navKeysForRole(role?: string): string[] {
  return [...(NAV_KEYS_BY_ROLE[role as UserRole] || NAV_KEYS_BY_ROLE.ENTREPRENEUR)];
}
