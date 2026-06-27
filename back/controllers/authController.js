import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import prisma from "../config/prisma.js";
import { validatePassword } from "../utils/passwordPolicy.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  isSmtpConfigured,
} from "../utils/emailService.js";
import { createSessionTokens, rotateRefreshToken, revokeRefreshToken } from "../services/tokenService.js";
import {
  canUseTwoFactor,
  sendOtpToUser,
  verifyOtpForUser,
  createChallengeToken,
  verifyChallengeToken,
  clearOtp,
} from "../services/twoFactorService.js";

const VERIFY_TOKEN_MS = 24 * 60 * 60 * 1000;

function formatUser(user) {
  return {
    id: user.id,
    _id: user.id,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organization: user.organization,
    emailVerified: Boolean(user.emailVerifiedAt),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
  };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function frontBaseUrl() {
  return process.env.FRONTEND_URL || "http://localhost:5173";
}

function needsEmailVerification(user) {
  return user.role === "ENTREPRENEUR" && !user.emailVerifiedAt && !user.googleId;
}

async function issueSession(user, res, message) {
  const { accessToken, refreshToken } = await createSessionTokens(user);
  res.json({
    message,
    token: accessToken,
    refreshToken,
    user: formatUser(user),
  });
}

export const register = async (req, res) => {
  try {
    if (!isSmtpConfigured()) {
      return res.status(503).json({
        error:
          "L'envoi d'emails n'est pas activé sur ce serveur. Impossible de créer un compte pour le moment.",
        emailConfigured: false,
      });
    }

    const {
      nom,
      prenom,
      email,
      motDePasse,
      telephone,
      nomEntreprise,
      adresseEntreprise,
      villeEntreprise,
      paysEntreprise,
    } = req.body;

    const normalizedEmail = email?.trim()?.toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ error: "Email requis." });

    const pwdErr = validatePassword(motDePasse);
    if (pwdErr) return res.status(400).json({ error: pwdErr });

    const existe = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existe) {
      return res.status(400).json({ error: "Un compte existe déjà avec cet email." });
    }

    const hashed = await bcrypt.hash(motDePasse, 12);
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyHashed = hashToken(verifyToken);
    const verifyExpire = new Date(Date.now() + VERIFY_TOKEN_MS);
    const orgNom = nomEntreprise || `${prenom} ${nom} — Entreprise`;

    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          nom: orgNom,
          adresse: adresseEntreprise,
          ville: villeEntreprise,
          pays: paysEntreprise || "Côte d'Ivoire",
        },
      });

      return tx.user.create({
        data: {
          organizationId: org.id,
          nom,
          prenom,
          email: normalizedEmail,
          motDePasse: hashed,
          telephone,
          role: "ENTREPRENEUR",
          verifyToken: verifyHashed,
          verifyTokenExpire: verifyExpire,
        },
        include: { organization: true },
      });
    });

    const verifyURL = `${frontBaseUrl()}/#/verify/${verifyToken}`;
    const mail = await sendVerificationEmail(normalizedEmail, verifyURL);

    res.status(201).json({
      message:
        "Compte créé. Un email de validation a été envoyé — consultez votre boîte mail (et les spams).",
      needsVerification: true,
      email: normalizedEmail,
      emailSent: mail.sent,
      devVerifyUrl:
        !mail.sent && process.env.NODE_ENV !== "production" ? verifyURL : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const hashed = hashToken(req.params.token);
    const user = await prisma.user.findFirst({
      where: { verifyToken: hashed, verifyTokenExpire: { gt: new Date() } },
    });

    if (!user) {
      return res.status(400).json({ error: "Lien de validation invalide ou expiré." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verifyToken: null,
        verifyTokenExpire: null,
      },
    });

    await sendWelcomeEmail(user.email, user.prenom || user.nom);

    res.json({ message: "Email validé. Vous pouvez maintenant vous connecter." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const email = req.body.email?.trim()?.toLowerCase();
    if (!email) return res.status(400).json({ error: "Email requis." });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt || user.googleId) {
      return res.json({
        message: "Si un compte en attente de validation existe, un nouvel email a été envoyé.",
      });
    }

    const verifyToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyToken: hashToken(verifyToken),
        verifyTokenExpire: new Date(Date.now() + VERIFY_TOKEN_MS),
      },
    });

    const verifyURL = `${frontBaseUrl()}/#/verify/${verifyToken}`;
    const mail = await sendVerificationEmail(email, verifyURL);

    res.json({
      message: mail.sent
        ? "Email de validation renvoyé. Consultez votre boîte mail."
        : "Si un compte en attente existe, un email de validation sera envoyé.",
      emailSent: mail.sent,
      devVerifyUrl:
        !mail.sent && process.env.NODE_ENV !== "production" ? verifyURL : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, motDePasse, password } = req.body;
    const pwd = motDePasse || password;
    if (!pwd) return res.status(400).json({ error: "Mot de passe requis." });

    const normalizedEmail = email?.trim()?.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { organization: true },
    });

    if (!user || !user.motDePasse) {
      return res.status(401).json({
        error: user?.googleId
          ? "Ce compte utilise Google. Connectez-vous avec Google."
          : "Identifiants invalides.",
      });
    }

    const valid = await bcrypt.compare(pwd, user.motDePasse);
    if (!valid) return res.status(401).json({ error: "Identifiants invalides." });

    if (needsEmailVerification(user)) {
      return res.status(403).json({
        error: "Confirmez votre email avant de vous connecter.",
        needsVerification: true,
        email: user.email,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { derniereConnexion: new Date() },
    });

    if (user.twoFactorEnabled && canUseTwoFactor(user)) {
      const { maskedEmail } = await sendOtpToUser(user, "login");
      return res.json({
        requires2FA: true,
        challengeToken: createChallengeToken(user.id),
        message: `Code de sécurité envoyé à ${maskedEmail}`,
        maskedEmail,
      });
    }

    await issueSession(user, res, "Connexion réussie");
  } catch (error) {
    if (error.code === "SMTP_REQUIRED") {
      return res.status(503).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: "Connexion Google non configurée sur ce serveur." });
    }

    const { idToken, nomEntreprise, villeEntreprise, paysEntreprise } = req.body;
    if (!idToken) return res.status(400).json({ error: "Token Google requis." });

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase();
    const googleId = payload.sub;

    if (!email || !googleId) {
      return res.status(400).json({ error: "Profil Google incomplet." });
    }

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
      include: { organization: true },
    });

    if (user) {
      if (user.role !== "ENTREPRENEUR" && user.role !== "ADMIN") {
        return res.status(403).json({
          error: "Ce compte est géré par votre entreprise. Utilisez email et mot de passe.",
        });
      }

      const updates = {};
      if (!user.googleId) updates.googleId = googleId;
      if (!user.emailVerifiedAt && payload.email_verified) {
        updates.emailVerifiedAt = new Date();
      }
      if (Object.keys(updates).length) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updates,
          include: { organization: true },
        });
      }
    } else {
      const orgNom =
        nomEntreprise?.trim() ||
        `${payload.given_name || "Entreprise"} ${payload.family_name || ""} — BTP`.trim();

      user = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            nom: orgNom,
            ville: villeEntreprise,
            pays: paysEntreprise || "Côte d'Ivoire",
          },
        });

        return tx.user.create({
          data: {
            organizationId: org.id,
            nom: payload.family_name || "Utilisateur",
            prenom: payload.given_name || "",
            email,
            googleId,
            role: "ENTREPRENEUR",
            emailVerifiedAt: payload.email_verified ? new Date() : null,
          },
          include: { organization: true },
        });
      });
    }

    if (needsEmailVerification(user)) {
      return res.status(403).json({
        error: "Email Google non vérifié. Utilisez un compte Google validé.",
        needsVerification: true,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { derniereConnexion: new Date() },
    });

    await issueSession(user, res, "Connexion Google réussie");
  } catch (error) {
    console.error("Google auth:", error.message);
    res.status(401).json({ error: "Connexion Google échouée. Réessayez." });
  }
};

export const demanderResetMotDePasse = async (req, res) => {
  try {
    if (!isSmtpConfigured()) {
      return res.status(503).json({
        error:
          "L'envoi d'emails n'est pas activé. Les identifiants Brevo doivent être configurés sur le serveur.",
        emailConfigured: false,
      });
    }

    const email = req.body.email?.trim()?.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    let mail = { sent: false };
    if (user) {
      if (!user.motDePasse) {
        return res.json({
          message: "Ce compte utilise Google. Connectez-vous avec le bouton Google.",
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashed = hashToken(resetToken);
      const expire = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: hashed, resetTokenExpire: expire },
      });

      const resetURL = `${frontBaseUrl()}/#/reset/${resetToken}`;
      mail = await sendPasswordResetEmail(email, resetURL);
    }

    res.json({
      message:
        "Si un compte existe avec cet email, vous recevrez un lien dans quelques minutes. Vérifiez aussi les spams.",
      emailSent: mail.sent,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resetMotDePasse = async (req, res) => {
  try {
    const { token } = req.params;
    const { nouveauMotDePasse } = req.body;

    const pwdErr = validatePassword(nouveauMotDePasse);
    if (pwdErr) return res.status(400).json({ error: pwdErr });

    const hashedToken = hashToken(token);
    const user = await prisma.user.findFirst({
      where: { resetToken: hashedToken, resetTokenExpire: { gt: new Date() } },
    });

    if (!user) {
      return res.status(400).json({ error: "Lien de réinitialisation invalide ou expiré." });
    }

    const hashed = await bcrypt.hash(nouveauMotDePasse, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        motDePasse: hashed,
        resetToken: null,
        resetTokenExpire: null,
      },
    });

    res.json({ message: "Mot de passe réinitialisé avec succès." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMonProfil = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true },
    });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
    const { motDePasse, resetToken, verifyToken, twoFactorOtpHash, twoFactorOtpExpire, refreshTokenHash, refreshTokenExpire, ...safe } = user;
    res.json({ ...safe, _id: user.id, emailVerified: Boolean(user.emailVerifiedAt), twoFactorEnabled: Boolean(user.twoFactorEnabled) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfil = async (req, res) => {
  try {
    const { nom, prenom, telephone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { nom, prenom, telephone },
      include: { organization: true },
    });
    const { motDePasse, resetToken, verifyToken, ...safe } = user;
    res.json({ ...safe, _id: user.id, emailVerified: Boolean(user.emailVerifiedAt) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const desactiverProfil = async (req, res) => {
  try {
    await revokeRefreshToken(req.user.id);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { statut: "INACTIF" },
    });
    res.json({ message: "Compte désactivé." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProfil = async (req, res) => {
  try {
    await revokeRefreshToken(req.user.id);
    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ message: "Compte supprimé." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const refreshSession = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await rotateRefreshToken(refreshToken);
    res.json({
      token: result.accessToken,
      refreshToken: result.refreshToken,
      user: formatUser(result.user),
    });
  } catch (error) {
    const status = error.code === "INVALID_REFRESH" ? 401 : 500;
    res.status(status).json({ error: "Session expirée. Reconnectez-vous." });
  }
};

export const logoutSession = async (req, res) => {
  try {
    await revokeRefreshToken(req.user.id);
    res.json({ message: "Déconnexion réussie." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const verify2FALogin = async (req, res) => {
  try {
    const { challengeToken, code } = req.body;
    if (!challengeToken || !code) {
      return res.status(400).json({ error: "Code et jeton requis." });
    }

    const userId = verifyChallengeToken(challengeToken);
    const ok = await verifyOtpForUser(userId, code);
    if (!ok) return res.status(401).json({ error: "Code invalide ou expiré." });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!user || user.statut !== "ACTIF") {
      return res.status(401).json({ error: "Compte indisponible." });
    }

    await issueSession(user, res, "Connexion réussie");
  } catch (error) {
    res.status(401).json({ error: "Session 2FA expirée. Reconnectez-vous." });
  }
};

export const resend2FALogin = async (req, res) => {
  try {
    const { challengeToken } = req.body;
    if (!challengeToken) return res.status(400).json({ error: "Jeton requis." });

    const userId = verifyChallengeToken(challengeToken);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled) {
      return res.status(400).json({ error: "Double authentification inactive." });
    }

    const { maskedEmail } = await sendOtpToUser(user, "login");
    res.json({ message: `Nouveau code envoyé à ${maskedEmail}`, maskedEmail });
  } catch (error) {
    if (error.code === "SMTP_REQUIRED") {
      return res.status(503).json({ error: error.message });
    }
    res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
  }
};

export const requestEnable2FA = async (req, res) => {
  try {
    if (!canUseTwoFactor(req.user)) {
      return res.status(403).json({ error: "2FA réservée aux comptes entrepreneur avec mot de passe." });
    }
    if (req.user.twoFactorEnabled) {
      return res.status(400).json({ error: "La double authentification est déjà active." });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const { maskedEmail } = await sendOtpToUser(user, "enable");
    res.json({ message: `Code d'activation envoyé à ${maskedEmail}`, maskedEmail });
  } catch (error) {
    if (error.code === "SMTP_REQUIRED") {
      return res.status(503).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const confirmEnable2FA = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Code requis." });

    const ok = await verifyOtpForUser(req.user.id, code);
    if (!ok) return res.status(401).json({ error: "Code invalide ou expiré." });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorEnabled: true },
    });

    res.json({ message: "Double authentification activée.", twoFactorEnabled: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const requestDisable2FA = async (req, res) => {
  try {
    const { motDePasse, password } = req.body;
    const pwd = motDePasse || password;
    if (!pwd) return res.status(400).json({ error: "Mot de passe requis." });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.twoFactorEnabled) {
      return res.status(400).json({ error: "La double authentification n'est pas active." });
    }

    const valid = await bcrypt.compare(pwd, user.motDePasse);
    if (!valid) return res.status(401).json({ error: "Mot de passe incorrect." });

    const { maskedEmail } = await sendOtpToUser(user, "disable");
    res.json({ message: `Code de confirmation envoyé à ${maskedEmail}`, maskedEmail });
  } catch (error) {
    if (error.code === "SMTP_REQUIRED") {
      return res.status(503).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const confirmDisable2FA = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Code requis." });

    const ok = await verifyOtpForUser(req.user.id, code);
    if (!ok) return res.status(401).json({ error: "Code invalide ou expiré." });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorEnabled: false },
    });
    await clearOtp(req.user.id);

    res.json({ message: "Double authentification désactivée.", twoFactorEnabled: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
