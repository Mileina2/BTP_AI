export const LOGIN_PROFILES = [
  {
    role: "ENTREPRENEUR",
    label: "Entrepreneur",
    description: "ERP complet : clients, devis, budget, équipe",
    demoEmail: "demo@btpia.com",
    demoPassword: "demo1234",
  },
  {
    role: "CHEF_CHANTIER",
    label: "Chef de chantier",
    description: "Chantiers assignés, rapports terrain, stock",
    demoEmail: "chef@btpia.com",
    demoPassword: "chef1234",
  },
  {
    role: "CLIENT",
    label: "Propriétaire",
    description: "Suivi d'avancement et documents partagés",
    demoEmail: "proprietaire@btpia.com",
    demoPassword: "proprio1234",
  },
] as const;

/** Comptes démo visibles uniquement en développement */
export const SHOW_DEMO_LOGIN = __DEV__;

export function getLoginProfile(role: string) {
  return LOGIN_PROFILES.find((p) => p.role === role) || LOGIN_PROFILES[0];
}
