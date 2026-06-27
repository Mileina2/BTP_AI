import fs from "fs/promises";
import path from "path";
import prisma from "../config/prisma.js";
import { getOrgId } from "../utils/legacyMap.js";
import { storeDevisFile, deleteDevisStoredFile, readDevisStoredFile } from "../utils/fileStorage.js";

function formatAnnexe(a) {
  return {
    id: a.id,
    devisId: a.devisId,
    nom: a.nom,
    url: a.url,
    mimeType: a.mimeType,
    taille: a.taille,
    type: a.type,
    ordre: a.ordre,
    createdAt: a.createdAt,
  };
}

export async function listDevisAnnexes(user, devisId) {
  const orgId = getOrgId(user);
  const devis = await prisma.devis.findFirst({
    where: { id: devisId, organizationId: orgId },
    select: { id: true },
  });
  if (!devis) return null;

  const items = await prisma.devisAnnexe.findMany({
    where: { devisId, organizationId: orgId },
    orderBy: [{ ordre: "asc" }, { createdAt: "asc" }],
  });
  return items.map(formatAnnexe);
}

export async function createDevisAnnexe(user, devisId, file, { nom, type = "PLAN" } = {}) {
  const orgId = getOrgId(user);
  const devis = await prisma.devis.findFirst({
    where: { id: devisId, organizationId: orgId },
    select: { id: true },
  });
  if (!devis) return null;

  const allowedTypes = new Set(["PLAN", "DPGF", "AUTRE"]);
  const annexeType = allowedTypes.has(type) ? type : "PLAN";

  const stored = await storeDevisFile(file, { organizationId: orgId, devisId });
  const count = await prisma.devisAnnexe.count({ where: { devisId } });

  const annexe = await prisma.devisAnnexe.create({
    data: {
      organizationId: orgId,
      devisId,
      nom: nom?.trim() || file.originalname || "Annexe",
      url: stored.url,
      mimeType: stored.mimeType,
      taille: stored.taille,
      storage: stored.storage,
      publicId: stored.publicId,
      type: annexeType,
      ordre: count,
    },
  });
  return formatAnnexe(annexe);
}

export async function removeDevisAnnexe(user, devisId, annexeId) {
  const orgId = getOrgId(user);
  const annexe = await prisma.devisAnnexe.findFirst({
    where: { id: annexeId, devisId, organizationId: orgId },
  });
  if (!annexe) return false;

  await deleteDevisStoredFile(annexe);
  await prisma.devisAnnexe.delete({ where: { id: annexeId } });
  return true;
}

export async function getDevisAnnexeBuffers(devisId, organizationId) {
  const annexes = await prisma.devisAnnexe.findMany({
    where: { devisId, organizationId, mimeType: "application/pdf" },
    orderBy: [{ ordre: "asc" }, { createdAt: "asc" }],
  });

  const attachments = [];
  for (const annexe of annexes) {
    try {
      const buffer = await readDevisStoredFile(annexe);
      if (buffer?.length) {
        attachments.push({
          filename: `${annexe.nom.replace(/[^\w\s.-]/g, "_")}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        });
      }
    } catch {
      /* ignore missing files */
    }
  }
  return attachments;
}
