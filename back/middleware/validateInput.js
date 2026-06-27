import validator from "validator";

export function validateLoginBody(req, res, next) {
  const email = req.body.email?.trim()?.toLowerCase();
  const pwd = req.body.motDePasse || req.body.password;

  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }
  if (!pwd || String(pwd).length > 128) {
    return res.status(400).json({ error: "Mot de passe requis." });
  }

  req.body.email = email;
  next();
}

export function validateRegisterBody(req, res, next) {
  const email = req.body.email?.trim()?.toLowerCase();
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }
  if (!req.body.nom?.trim() || !req.body.prenom?.trim()) {
    return res.status(400).json({ error: "Nom et prénom requis." });
  }
  req.body.email = email;
  next();
}
