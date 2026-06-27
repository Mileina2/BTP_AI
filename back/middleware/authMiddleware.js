import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { getJwtSecret } from "../config/security.js";

const JWT_SECRET = getJwtSecret();

export const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Accès refusé. Aucun token fourni." });
    }

    const token = auth.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Token invalide ou expiré." });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { organization: true },
    });

    if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
    if (user.statut === "INACTIF") {
      return res.status(403).json({ error: "Compte désactivé. Contactez l'administrateur." });
    }

    const needsVerify =
      user.role === "ENTREPRENEUR" && !user.emailVerifiedAt && !user.googleId;
    if (needsVerify) {
      return res.status(403).json({
        error: "Confirmez votre email avant d'utiliser l'application.",
        needsVerification: true,
        email: user.email,
      });
    }

    req.user = {
      id: user.id,
      _id: user.id,
      organizationId: user.organizationId,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      statut: user.statut,
      organization: user.organization,
    };

    next();
  } catch (err) {
    console.error("⚠️ Erreur middleware protect :", err.message);
    res.status(401).json({ error: "Authentification invalide ou expirée." });
  }
};
