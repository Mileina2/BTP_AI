import prisma from "../config/prisma.js";
import { toLegacy, getOrgId } from "../utils/legacyMap.js";
import { buildLocalMediaUrl } from "../utils/mediaAccess.js";
import {
  findAccessibleChantier,
  isClientPortal,
} from "../utils/accessControl.js";

function formatTimelineEntry(e) {
  const auteurNom = e.auteur
    ? `${e.auteur.prenom || ""} ${e.auteur.nom || ""}`.trim()
    : "Utilisateur";
  return toLegacy({
    id: e.id,
    type: e.type,
    titre: e.titre,
    description: e.description,
    jour: e.jour,
    photos: e.photos,
    visibleClient: e.visibleClient,
    date: e.date,
    auteur: auteurNom,
    auteurId: e.auteurId,
  });
}

function formatDocument(d) {
  const auteurNom = d.uploadedBy
    ? `${d.uploadedBy.prenom || ""} ${d.uploadedBy.nom || ""}`.trim()
    : "—";
  let url = d.url;
  if (d.storage === "local" && d.publicId && d.organizationId && d.chantierId) {
    url = buildLocalMediaUrl(d.organizationId, d.chantierId, d.publicId);
  }
  return toLegacy({
    id: d.id,
    nom: d.nom,
    url,
    mimeType: d.mimeType,
    taille: d.taille,
    storage: d.storage,
    createdAt: d.createdAt,
    uploadedBy: auteurNom,
  });
}

export async function assertChantierAccess(user, chantierId) {
  const chantier = await findAccessibleChantier(prisma, user, chantierId);
  if (!chantier) return null;
  return { id: chantier.id, nom: chantier.nom };
}

export async function listTimeline(user, chantierId) {
  const orgId = getOrgId(user);
  const where = { organizationId: orgId, chantierId };
  if (isClientPortal(user)) where.visibleClient = true;

  const entries = await prisma.chantierTimelineEntry.findMany({
    include: { auteur: { select: { nom: true, prenom: true } } },
    orderBy: { date: "desc" },
  });
  return entries.map(formatTimelineEntry);
}

export async function addTimelineComment(user, chantierId, userId, { texte, titre, visibleClient }) {
  const orgId = getOrgId(user);
  const author = await prisma.user.findFirst({
    where: { id: userId, organizationId: orgId },
    select: { nom: true, prenom: true },
  });
  const auteurLabel = author ? `${author.prenom} ${author.nom}`.trim() : "Équipe";

  const entry = await prisma.chantierTimelineEntry.create({
    data: {
      organizationId: orgId,
      chantierId,
      auteurId: userId,
      type: "COMMENTAIRE",
      titre: titre?.trim() || `Note de ${auteurLabel}`,
      description: texte?.trim(),
      visibleClient: visibleClient !== false,
    },
    include: { auteur: { select: { nom: true, prenom: true } } },
  });
  return formatTimelineEntry(entry);
}

export async function deleteTimelineEntry(user, chantierId, entryId) {
  const orgId = getOrgId(user);
  const existing = await prisma.chantierTimelineEntry.findFirst({
    where: { id: entryId, chantierId, organizationId: orgId },
  });
  if (!existing) return null;
  await prisma.chantierTimelineEntry.delete({ where: { id: entryId } });
  return true;
}

export async function listDocuments(user, chantierId) {
  const orgId = getOrgId(user);
  const docs = await prisma.chantierDocument.findMany({
    where: { organizationId: orgId, chantierId },
    include: { uploadedBy: { select: { nom: true, prenom: true } } },
    orderBy: { createdAt: "desc" },
  });
  return docs.map(formatDocument);
}

export async function createDocument(user, chantierId, userId, file, nom, uploadMeta = {}) {
  const orgId = getOrgId(user);
  const { storeChantierFile } = await import("../utils/fileStorage.js");
  const { parseWatermarkMeta } = await import("../utils/mediaWatermark.js");

  const chantier = await prisma.chantier.findFirst({
    where: { id: chantierId, organizationId: orgId },
    select: { nom: true, organization: { select: { nom: true } } },
  });

  const alreadyWatermarked = uploadMeta.watermarked === "1" || uploadMeta.watermarked === true;
  const watermark = file.mimetype?.startsWith("image/")
    ? {
        ...parseWatermarkMeta(uploadMeta, {
          chantierNom: chantier?.nom,
          orgNom: chantier?.organization?.nom,
        }),
        skip: alreadyWatermarked,
      }
    : null;

  const stored = await storeChantierFile(file, { organizationId: orgId, chantierId, watermark });

  const doc = await prisma.chantierDocument.create({
    data: {
      organizationId: orgId,
      chantierId,
      uploadedById: userId,
      nom: nom?.trim() || file.originalname || "Document",
      url: stored.url,
      mimeType: stored.mimeType,
      taille: stored.taille,
      storage: stored.storage,
      publicId: stored.publicId,
    },
    include: { uploadedBy: { select: { nom: true, prenom: true } } },
  });
  return formatDocument(doc);
}

export async function removeDocument(user, chantierId, docId) {
  const orgId = getOrgId(user);
  const doc = await prisma.chantierDocument.findFirst({
    where: { id: docId, chantierId, organizationId: orgId },
  });
  if (!doc) return null;

  const { deleteStoredFile } = await import("../utils/fileStorage.js");
  await deleteStoredFile(doc);
  await prisma.chantierDocument.delete({ where: { id: docId } });
  return true;
}
