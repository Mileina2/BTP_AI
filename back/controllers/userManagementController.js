import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { getOrgId, getUserId } from "../utils/legacyMap.js";
import { validatePassword } from "../utils/passwordPolicy.js";
import { logAudit } from "../utils/auditService.js";
import { isManagement } from "../utils/accessControl.js";
import { createPasswordSetupLink, getLoginUrl } from "../utils/passwordSetupToken.js";
import { isSmtpConfigured, sendTeamInvitationEmail } from "../utils/emailService.js";

function formatTeamUser(u) {
  return {
    id: u.id,
    _id: u.id,
    nom: u.nom,
    prenom: u.prenom,
    email: u.email,
    role: u.role,
    statut: u.statut,
    telephone: u.telephone,
    clientProfile: u.clientProfile
      ? { id: u.clientProfile.id, nom: u.clientProfile.nom }
      : null,
    chantiersAssigned: u.chantiersAssigned?.map((c) => ({ id: c.id, nom: c.nom })) || [],
  };
}

async function loadOrganization(orgId) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { nom: true },
  });
}

async function dispatchInvitationEmail({
  user,
  roleLabel,
  profileLabel,
  organizationName,
  tempPassword,
  contextLines,
}) {
  if (!isSmtpConfigured()) {
    return { sent: false };
  }

  const passwordSetupUrl = await createPasswordSetupLink(user.id);

  return sendTeamInvitationEmail({
    to: user.email,
    prenom: user.prenom,
    roleLabel,
    profileLabel,
    organizationName,
    loginUrl: getLoginUrl(),
    email: user.email,
    tempPassword,
    passwordSetupUrl,
    contextLines,
  });
}

export const listTeamUsers = async (req, res) => {
  try {
    if (!isManagement(req.user)) {
      return res.status(403).json({ error: "Accès réservé à l'entrepreneur." });
    }
    const users = await prisma.user.findMany({
      where: { organizationId: getOrgId(req.user) },
      include: {
        clientProfile: { select: { id: true, nom: true } },
        chantiersAssigned: { select: { id: true, nom: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(users.map(formatTeamUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const inviteChefChantier = async (req, res) => {
  try {
    if (!isManagement(req.user)) {
      return res.status(403).json({ error: "Accès réservé à l'entrepreneur." });
    }
    const orgId = getOrgId(req.user);
    const { nom, prenom, email, telephone, motDePasse, chantierId } = req.body;

    if (!nom?.trim() || !prenom?.trim() || !email?.trim()) {
      return res.status(400).json({ error: "Nom, prénom et email requis." });
    }

    const pwdErr = validatePassword(motDePasse || "chef123456");
    if (motDePasse && pwdErr) return res.status(400).json({ error: pwdErr });

    const exists = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (exists) return res.status(400).json({ error: "Un compte existe déjà avec cet email." });

    const password = motDePasse || "chef123456";
    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim().toLowerCase(),
        telephone: telephone?.trim() || null,
        motDePasse: hashed,
        role: "CHEF_CHANTIER",
        emailVerifiedAt: new Date(),
      },
    });

    let chantierNom = null;
    if (chantierId) {
      const ch = await prisma.chantier.findFirst({
        where: { id: chantierId, organizationId: orgId },
      });
      if (ch) {
        chantierNom = ch.nom;
        await prisma.chantier.update({
          where: { id: chantierId },
          data: { chefChantierId: user.id },
        });
      }
    }

    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "INVITE_CHEF",
      entity: "User",
      entityId: user.id,
      details: email,
    });

    const org = await loadOrganization(orgId);
    const mail = await dispatchInvitationEmail({
      user,
      roleLabel: "Chef de chantier",
      profileLabel: "Chef de chantier",
      organizationName: org?.nom,
      tempPassword: motDePasse ? undefined : password,
      contextLines: chantierNom ? [`Chantier assigné : <strong>${chantierNom}</strong>.`] : [],
    });

    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        clientProfile: { select: { id: true, nom: true } },
        chantiersAssigned: { select: { id: true, nom: true } },
      },
    });

    res.status(201).json({
      message: mail.sent
        ? "Chef de chantier créé. Une invitation a été envoyée par email."
        : "Chef de chantier créé. Email non envoyé (SMTP non configuré).",
      user: formatTeamUser(full),
      emailSent: mail.sent,
      motDePasseTemporaire: mail.sent ? undefined : motDePasse ? undefined : password,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const linkClientPortal = async (req, res) => {
  try {
    if (!isManagement(req.user)) {
      return res.status(403).json({ error: "Accès réservé à l'entrepreneur." });
    }
    const orgId = getOrgId(req.user);
    const { clientId, email, motDePasse, nom, prenom } = req.body;

    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: orgId },
    });
    if (!client) return res.status(404).json({ error: "Client introuvable." });

    const loginEmail = (email || client.email)?.trim()?.toLowerCase();
    if (!loginEmail) {
      return res.status(400).json({ error: "Email requis pour le portail propriétaire." });
    }

    let portalUser = await prisma.user.findUnique({ where: { email: loginEmail } });
    let tempPassword;

    if (portalUser) {
      if (portalUser.organizationId !== orgId) {
        return res.status(400).json({ error: "Cet email est utilisé par une autre organisation." });
      }
      if (portalUser.role !== "CLIENT" && portalUser.role !== "ENTREPRENEUR") {
        return res.status(400).json({ error: "Cet email est déjà utilisé avec un autre rôle." });
      }
      if (portalUser.role !== "CLIENT") {
        await prisma.user.update({
          where: { id: portalUser.id },
          data: { role: "CLIENT" },
        });
        portalUser.role = "CLIENT";
      }
      if (motDePasse) {
        const pwdErr = validatePassword(motDePasse);
        if (pwdErr) return res.status(400).json({ error: pwdErr });
        await prisma.user.update({
          where: { id: portalUser.id },
          data: { motDePasse: await bcrypt.hash(motDePasse, 12) },
        });
        tempPassword = motDePasse;
      }
    } else {
      const pwd = motDePasse || "proprio123456";
      tempPassword = motDePasse ? undefined : pwd;
      const pwdErr = validatePassword(pwd);
      if (pwdErr) return res.status(400).json({ error: pwdErr });

      portalUser = await prisma.user.create({
        data: {
          organizationId: orgId,
          nom: nom?.trim() || client.nom.split(" ").pop() || "Client",
          prenom: prenom?.trim() || client.nom.split(" ")[0] || "",
          email: loginEmail,
          motDePasse: await bcrypt.hash(pwd, 12),
          role: "CLIENT",
          telephone: client.telephone,
          emailVerifiedAt: new Date(),
        },
      });
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { userId: portalUser.id, email: loginEmail },
    });

    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "LINK_CLIENT_PORTAL",
      entity: "Client",
      entityId: clientId,
      details: loginEmail,
    });

    const org = await loadOrganization(orgId);
    const chantiers = await prisma.chantier.findMany({
      where: { clientId, organizationId: orgId },
      select: { nom: true },
      take: 5,
    });
    const chantierLine =
      chantiers.length > 0
        ? [`Chantier(s) : ${chantiers.map((c) => c.nom).join(", ")}.`]
        : [];

    const mail = await dispatchInvitationEmail({
      user: portalUser,
      roleLabel: "Propriétaire",
      profileLabel: "Propriétaire",
      organizationName: org?.nom,
      tempPassword,
      contextLines: [
        `Client : <strong>${client.nom}</strong>.`,
        ...chantierLine,
        "Vous pourrez suivre l'avancement, consulter devis et factures.",
      ],
    });

    res.json({
      message: mail.sent
        ? "Portail propriétaire activé. Une invitation a été envoyée par email."
        : "Portail propriétaire activé. Email non envoyé (SMTP non configuré).",
      user: { id: portalUser.id, email: loginEmail, role: "CLIENT" },
      emailSent: mail.sent,
      motDePasseTemporaire: mail.sent ? undefined : tempPassword,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const assignChefToChantier = async (req, res) => {
  try {
    if (!isManagement(req.user)) {
      return res.status(403).json({ error: "Accès réservé à l'entrepreneur." });
    }
    const orgId = getOrgId(req.user);
    const { chantierId, chefUserId } = req.body;

    const chantier = await prisma.chantier.findFirst({
      where: { id: chantierId, organizationId: orgId },
    });
    if (!chantier) return res.status(404).json({ error: "Chantier introuvable." });

    if (chefUserId) {
      const chef = await prisma.user.findFirst({
        where: { id: chefUserId, organizationId: orgId, role: "CHEF_CHANTIER" },
      });
      if (!chef) return res.status(400).json({ error: "Chef de chantier introuvable." });
    }

    await prisma.chantier.update({
      where: { id: chantierId },
      data: { chefChantierId: chefUserId || null },
    });

    res.json({ message: "Chef assigné au chantier." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const listAuditLogs = async (req, res) => {
  try {
    if (!isManagement(req.user)) {
      return res.status(403).json({ error: "Accès réservé à l'entrepreneur." });
    }
    const logs = await prisma.auditLog.findMany({
      where: { organizationId: getOrgId(req.user) },
      include: { user: { select: { nom: true, prenom: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
