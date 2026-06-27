/** Profils de connexion affichés sur la page login. */
export const LOGIN_PROFILES = [
  {
    role: "ENTREPRENEUR",
    label: "Entrepreneur",
    description: "ERP complet : clients, devis, budget, équipe",
    demoEmail: "demo@btpia.com",
    demoPassword: "demo1234",
    allowRegister: true,
  },
  {
    role: "CHEF_CHANTIER",
    label: "Chef de chantier",
    description: "Chantiers assignés, rapports terrain, stock",
    demoEmail: "chef@btpia.com",
    demoPassword: "chef1234",
    allowRegister: false,
  },
  {
    role: "CLIENT",
    label: "Propriétaire",
    description: "Suivi d'avancement et documents partagés",
    demoEmail: "proprietaire@btpia.com",
    demoPassword: "proprio1234",
    allowRegister: false,
  },
];

/** Comptes démo et pré-remplissage — développement uniquement */
export const SHOW_DEMO_LOGIN = import.meta.env.DEV;

export function getLoginProfile(role) {
  return LOGIN_PROFILES.find((p) => p.role === role) || LOGIN_PROFILES[0];
}
