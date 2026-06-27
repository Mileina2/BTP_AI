import prisma from "../config/prisma.js";
import { DEVIS_STATUT_LABEL, FACTURE_STATUT_LABEL, getOrgId, getUserId, toLegacy } from "../utils/legacyMap.js";
import { isClientPortal, chantierScopeWhere } from "../utils/accessControl.js";
import { logAudit } from "../utils/auditService.js";
import { streamDevisPdf } from "../utils/devisPdf.js";
import { streamFacturePdf } from "../utils/facturePdf.js";
import { notifyEntrepreneurDevisStatus } from "../utils/devisNotify.js";

function formatDevisBrief(d) {
  return toLegacy({
    id: d.id,
    numero: d.numero,
    montantTTC: d.montantTTC,
    statut: DEVIS_STATUT_LABEL[d.statut] || d.statut,
    statutRaw: d.statut,
    dateEmission: d.dateEmission,
    chantier: d.chantier?.nom,
    chantierId: d.chantierId,
    signatureData: d.signatureData ? true : false,
  });
}

function formatFactureBrief(f) {
  return toLegacy({
    id: f.id,
    numero: f.numero,
    montantTTC: f.montantTTC,
    statut: FACTURE_STATUT_LABEL[f.statut] || f.statut,
    statutRaw: f.statut,
    dateEmission: f.dateEmission,
    dateEcheance: f.dateEcheance,
    chantier: f.chantier?.nom,
    chantierId: f.chantierId,
  });
}

async function clientPortalFilter(user) {
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const chantierIds = (
    await prisma.chantier.findMany({
      where: chantierScopeWhere(user),
      select: { id: true },
    })
  ).map((c) => c.id);

  return {
    organizationId: orgId,
    OR: [
      { client: { userId } },
      ...(chantierIds.length ? [{ chantierId: { in: chantierIds } }] : []),
    ],
  };
}

export const getPortalDevis = async (req, res) => {
  try {
    if (!isClientPortal(req.user)) {
      return res.status(403).json({ error: "Réservé au portail propriétaire." });
    }
    const devis = await prisma.devis.findMany({
      where: await clientPortalFilter(req.user),
      include: { chantier: { select: { nom: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(devis.map(formatDevisBrief));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPortalFactures = async (req, res) => {
  try {
    if (!isClientPortal(req.user)) {
      return res.status(403).json({ error: "Réservé au portail propriétaire." });
    }
    const factures = await prisma.facture.findMany({
      where: await clientPortalFilter(req.user),
      include: { chantier: { select: { nom: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(factures.map(formatFactureBrief));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const acceptPortalDevis = async (req, res) => {
  try {
    if (!isClientPortal(req.user)) {
      return res.status(403).json({ error: "Réservé au portail propriétaire." });
    }
    const where = await clientPortalFilter(req.user);
    const devis = await prisma.devis.findFirst({
      where: { id: req.params.id, ...where },
    });
    if (!devis) return res.status(404).json({ error: "Devis introuvable." });

    const { signatureNom, signatureData } = req.body;
    const updated = await prisma.devis.update({
      where: { id: devis.id },
      data: {
        statut: "ACCEPTE",
        clientAccepteNom: signatureNom || [req.user.prenom, req.user.nom].filter(Boolean).join(" ") || req.user.email,
        clientAccepteLe: new Date(),
        clientSignatureData: signatureData || null,
      },
      include: { chantier: { select: { nom: true } } },
    });

    await logAudit({
      organizationId: getOrgId(req.user),
      userId: getUserId(req.user),
      action: "DEVIS_ACCEPTE_CLIENT",
      entity: "Devis",
      entityId: devis.id,
      details: devis.numero,
    });

    await notifyEntrepreneurDevisStatus(devis.id, "ACCEPTE", {
      clientName: req.user.nom || signatureNom,
      signatureNom,
    });

    res.json({ message: "Devis accepté. Merci pour votre confiance.", devis: formatDevisBrief(updated) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const refusePortalDevis = async (req, res) => {
  try {
    if (!isClientPortal(req.user)) {
      return res.status(403).json({ error: "Réservé au portail propriétaire." });
    }
    const where = await clientPortalFilter(req.user);
    const devis = await prisma.devis.findFirst({
      where: { id: req.params.id, ...where },
      include: { chantier: { select: { nom: true } } },
    });
    if (!devis) return res.status(404).json({ error: "Devis introuvable." });
    if (devis.statut === "ACCEPTE") {
      return res.status(400).json({ error: "Ce devis est déjà accepté." });
    }

    const { motif } = req.body;
    const updated = await prisma.devis.update({
      where: { id: devis.id },
      data: { statut: "REFUSE" },
      include: { chantier: { select: { nom: true } } },
    });

    await logAudit({
      organizationId: getOrgId(req.user),
      userId: getUserId(req.user),
      action: "DEVIS_REFUSE_CLIENT",
      entity: "Devis",
      entityId: devis.id,
      details: motif || devis.numero,
    });

    await notifyEntrepreneurDevisStatus(devis.id, "REFUSE", {
      clientName: [req.user.prenom, req.user.nom].filter(Boolean).join(" ") || req.user.email,
      signatureNom: motif,
    });

    res.json({ message: "Devis refusé. L'entrepreneur en a été informé.", devis: formatDevisBrief(updated) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const downloadPortalDevisPdf = async (req, res) => {
  try {
    if (!isClientPortal(req.user)) {
      return res.status(403).json({ error: "Réservé au portail propriétaire." });
    }
    const orgId = getOrgId(req.user);
    const where = await clientPortalFilter(req.user);
    const devis = await prisma.devis.findFirst({
      where: { id: req.params.id, ...where },
      include: {
        client: true,
        chantier: true,
        lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
        parentDevis: { select: { numero: true } },
      },
    });
    if (!devis) return res.status(404).json({ error: "Devis introuvable." });

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    streamDevisPdf(res, devis, organization, {
      nom: organization?.signataireNom || "Entreprise",
      fonction: organization?.signataireFonction || "",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadPortalFacturePdf = async (req, res) => {
  try {
    if (!isClientPortal(req.user)) {
      return res.status(403).json({ error: "Réservé au portail propriétaire." });
    }
    const orgId = getOrgId(req.user);
    const where = await clientPortalFilter(req.user);
    const facture = await prisma.facture.findFirst({
      where: { id: req.params.id, ...where },
      include: { client: true, chantier: true, lignes: true },
    });
    if (!facture) return res.status(404).json({ error: "Facture introuvable." });

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    streamFacturePdf(res, facture, organization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPortalStats = async (req, res) => {
  try {
    if (!isClientPortal(req.user)) {
      return res.status(403).json({ error: "Réservé au portail propriétaire." });
    }
    const chantiers = await prisma.chantier.findMany({
      where: chantierScopeWhere(req.user),
      select: {
        id: true,
        nom: true,
        avancementPhysique: true,
        statut: true,
        updatedAt: true,
      },
    });
    res.json({
      chantiers,
      moyenneAvancement:
        chantiers.length > 0
          ? Math.round(chantiers.reduce((s, c) => s + c.avancementPhysique, 0) / chantiers.length)
          : 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
