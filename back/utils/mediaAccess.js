import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs/promises";
import { getJwtSecret } from "../config/security.js";
import { UPLOADS_ROOT, UPLOADS_DEVIS_ROOT } from "./fileStorage.js";

const MEDIA_TTL = process.env.MEDIA_ACCESS_TTL || "4h";

export function signMediaAccess({ organizationId, chantierId, publicId }) {
  return jwt.sign(
    { typ: "media", scope: "chantier", organizationId, chantierId, publicId },
    getJwtSecret(),
    { expiresIn: MEDIA_TTL }
  );
}

export function signDevisMediaAccess({ organizationId, devisId, publicId }) {
  return jwt.sign(
    { typ: "media", scope: "devis", organizationId, devisId, publicId },
    getJwtSecret(),
    { expiresIn: MEDIA_TTL }
  );
}

export function verifyMediaAccess(token, { organizationId, chantierId, publicId }) {
  const decoded = jwt.verify(token, getJwtSecret());
  if (decoded.typ !== "media") throw new Error("Token média invalide");
  if (decoded.organizationId !== organizationId) throw new Error("Organisation invalide");
  const scopeId = decoded.chantierId || decoded.scopeId;
  if (scopeId !== chantierId) throw new Error("Chantier invalide");
  if (decoded.publicId !== publicId) throw new Error("Fichier invalide");
  return decoded;
}

export function verifyDevisMediaAccess(token, { organizationId, devisId, publicId }) {
  const decoded = jwt.verify(token, getJwtSecret());
  if (decoded.typ !== "media" || decoded.scope !== "devis") throw new Error("Token média invalide");
  if (decoded.organizationId !== organizationId) throw new Error("Organisation invalide");
  if (decoded.devisId !== devisId) throw new Error("Devis invalide");
  if (decoded.publicId !== publicId) throw new Error("Fichier invalide");
  return decoded;
}

export function buildLocalMediaUrl(organizationId, chantierId, publicId) {
  const base = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
  const access = signMediaAccess({ organizationId, chantierId, publicId });
  return `${base}/api/media/chantiers/${organizationId}/${chantierId}/${encodeURIComponent(publicId)}?access=${access}`;
}

export function buildDevisMediaUrl(organizationId, devisId, publicId) {
  const base = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
  const access = signDevisMediaAccess({ organizationId, devisId, publicId });
  return `${base}/api/media/devis/${organizationId}/${devisId}/${encodeURIComponent(publicId)}?access=${access}`;
}

export async function serveLocalMediaFile(organizationId, chantierId, publicId) {
  const safeName = path.basename(publicId);
  const filePath = path.join(UPLOADS_ROOT, organizationId, chantierId, safeName);
  const resolved = path.resolve(filePath);
  const root = path.resolve(UPLOADS_ROOT);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error("Chemin invalide");
  }
  return fs.readFile(resolved);
}

export async function serveDevisMediaFile(organizationId, devisId, publicId) {
  const safeName = path.basename(publicId);
  const filePath = path.join(UPLOADS_DEVIS_ROOT, organizationId, devisId, safeName);
  const resolved = path.resolve(filePath);
  const root = path.resolve(UPLOADS_DEVIS_ROOT);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error("Chemin invalide");
  }
  return fs.readFile(resolved);
}
