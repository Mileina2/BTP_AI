export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Non authentifié." });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: "Accès refusé. Rôle insuffisant pour cette action.",
    });
  }
  next();
};

export const entrepreneurOnly = authorize("ENTREPRENEUR", "ADMIN");
export const chefOrEntrepreneur = authorize("ENTREPRENEUR", "CHEF_CHANTIER", "ADMIN");
export const clientPortal = authorize("CLIENT", "ENTREPRENEUR", "ADMIN");
export const allAppRoles = authorize("ENTREPRENEUR", "CHEF_CHANTIER", "CLIENT", "ADMIN");
export const fieldTeam = authorize("ENTREPRENEUR", "CHEF_CHANTIER", "ADMIN");
