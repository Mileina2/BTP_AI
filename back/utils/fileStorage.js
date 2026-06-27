import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { buildLocalMediaUrl, buildDevisMediaUrl } from "./mediaAccess.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.join(__dirname, "..", "uploads", "chantiers");
export const UPLOADS_DEVIS_ROOT = path.join(__dirname, "..", "uploads", "devis");

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const MAX_DOC_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

function isVideoMime(mime) {
  return mime?.startsWith("video/");
}

export function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export function getStorageInfo() {
  const cloud = isCloudinaryConfigured();
  return {
    mode: cloud ? "cloudinary" : "local",
    label: cloud ? "Cloudinary (cloud)" : "Stockage local",
    cloudinaryConfigured: cloud,
    cloudName: cloud ? process.env.CLOUDINARY_CLOUD_NAME : null,
    localFallback: true,
    hint: cloud
      ? "Les photos et vidéos sont envoyées sur Cloudinary. En cas d'échec, sauvegarde locale automatique."
      : "Fichiers dans back/uploads/chantiers/. Ajoutez CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET dans back/.env pour le cloud.",
  };
}

export function validateUploadFile(file) {
  if (!file) throw new Error("Fichier requis");
  const max = isVideoMime(file.mimetype) ? MAX_VIDEO_BYTES : MAX_DOC_BYTES;
  if (file.size > max) {
    throw new Error(isVideoMime(file.mimetype) ? "Vidéo trop volumineuse (max 80 Mo)" : "Fichier trop volumineux (max 15 Mo)");
  }
  if (!ALLOWED_MIME.has(file.mimetype) && !isVideoMime(file.mimetype)) {
    throw new Error("Type de fichier non autorisé (PDF, images, vidéos, Word, Excel, texte)");
  }
}

function publicBaseUrl() {
  return process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
}

function cloudinaryResourceType(mime) {
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("image/")) return "image";
  return "auto";
}

async function getCloudinary() {
  const cloudinary = (await import("cloudinary")).v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

async function uploadToCloudinary(file, { organizationId, chantierId }) {
  const cloudinary = await getCloudinary();
  const resourceType = cloudinaryResourceType(file.mimetype);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `btpia/${organizationId}/${chantierId}`,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          storage: "cloudinary",
          mimeType: file.mimetype,
          taille: file.size,
        });
      }
    );
    stream.end(file.buffer);
  });
}

async function uploadToLocal(file, { organizationId, chantierId }) {
  const dir = path.join(UPLOADS_ROOT, organizationId, chantierId);
  await fs.mkdir(dir, { recursive: true });
  let ext = path.extname(file.originalname || "");
  if (!ext && file.mimetype === "video/webm") ext = ".webm";
  if (!ext && file.mimetype === "video/mp4") ext = ".mp4";
  if (!ext && file.mimetype === "image/jpeg") ext = ".jpg";
  if (!ext && file.mimetype === "image/png") ext = ".png";
  const stored = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, stored), file.buffer);
  return {
    url: buildLocalMediaUrl(organizationId, chantierId, stored),
    publicId: stored,
    storage: "local",
    mimeType: file.mimetype,
    taille: file.size,
  };
}

async function maybeWatermarkFile(file, watermark) {
  if (!watermark || !file.mimetype?.startsWith("image/")) return file;
  if (watermark.skip === true) return file;
  try {
    const { watermarkImageBuffer } = await import("./mediaWatermark.js");
    const buffer = await watermarkImageBuffer(file.buffer, watermark);
    return {
      ...file,
      buffer,
      size: buffer.length,
      mimetype: "image/jpeg",
      originalname: (file.originalname || "photo").replace(/\.[^.]+$/, "") + "_filigrane.jpg",
    };
  } catch (err) {
    console.warn("⚠️ Filigrane serveur ignoré :", err.message);
    return file;
  }
}

async function uploadDevisToLocal(file, { organizationId, devisId }) {
  const dir = path.join(UPLOADS_DEVIS_ROOT, organizationId, devisId);
  await fs.mkdir(dir, { recursive: true });
  let ext = path.extname(file.originalname || "");
  if (!ext && file.mimetype === "application/pdf") ext = ".pdf";
  if (!ext && file.mimetype === "image/jpeg") ext = ".jpg";
  if (!ext && file.mimetype === "image/png") ext = ".png";
  const stored = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, stored), file.buffer);
  return {
    url: buildDevisMediaUrl(organizationId, devisId, stored),
    publicId: stored,
    storage: "local",
    mimeType: file.mimetype,
    taille: file.size,
  };
}

async function uploadDevisToCloudinary(file, { organizationId, devisId }) {
  const cloudinary = await getCloudinary();
  const resourceType = cloudinaryResourceType(file.mimetype);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `btpia/devis/${organizationId}/${devisId}`,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          storage: "cloudinary",
          mimeType: file.mimetype,
          taille: file.size,
        });
      }
    );
    stream.end(file.buffer);
  });
}

export async function storeDevisFile(file, { organizationId, devisId }) {
  validateUploadFile(file);

  if (isCloudinaryConfigured()) {
    try {
      return await uploadDevisToCloudinary(file, { organizationId, devisId });
    } catch (err) {
      console.warn("⚠️ Cloudinary devis indisponible, fallback local :", err.message);
      return uploadDevisToLocal(file, { organizationId, devisId });
    }
  }
  return uploadDevisToLocal(file, { organizationId, devisId });
}

export async function deleteDevisStoredFile(doc) {
  if (doc.storage === "cloudinary" && doc.publicId && isCloudinaryConfigured()) {
    try {
      const cloudinary = await getCloudinary();
      const resourceType = doc.mimeType?.startsWith("video/") ? "video" : "auto";
      await cloudinary.uploader.destroy(doc.publicId, { resource_type: resourceType });
    } catch {
      /* ignore */
    }
    return;
  }
  if (doc.storage === "local" && doc.publicId) {
    const filePath = path.join(UPLOADS_DEVIS_ROOT, doc.organizationId, doc.devisId, doc.publicId);
    await fs.unlink(filePath).catch(() => {});
  }
}

export async function readDevisStoredFile(doc) {
  if (doc.storage === "cloudinary" && doc.url) {
    const res = await fetch(doc.url);
    if (!res.ok) throw new Error("Fichier cloud inaccessible");
    return Buffer.from(await res.arrayBuffer());
  }
  if (doc.storage === "local" && doc.publicId) {
    const filePath = path.join(UPLOADS_DEVIS_ROOT, doc.organizationId, doc.devisId, doc.publicId);
    return fs.readFile(filePath);
  }
  return null;
}

export async function storeChantierFile(file, { organizationId, chantierId, watermark = null }) {
  validateUploadFile(file);
  const processed = await maybeWatermarkFile(file, watermark);

  if (isCloudinaryConfigured()) {
    try {
      return await uploadToCloudinary(processed, { organizationId, chantierId });
    } catch (err) {
      console.warn("⚠️ Cloudinary indisponible, fallback local :", err.message);
      return uploadToLocal(processed, { organizationId, chantierId });
    }
  }
  return uploadToLocal(processed, { organizationId, chantierId });
}

export async function deleteStoredFile(doc) {
  if (doc.storage === "cloudinary" && doc.publicId && isCloudinaryConfigured()) {
    try {
      const cloudinary = await getCloudinary();
      const resourceType = doc.mimeType?.startsWith("video/") ? "video" : "image";
      await cloudinary.uploader.destroy(doc.publicId, { resource_type: resourceType });
    } catch {
      /* ignore */
    }
    return;
  }
  if (doc.storage === "local" && doc.publicId) {
    const filePath = path.join(UPLOADS_ROOT, doc.organizationId, doc.chantierId, doc.publicId);
    await fs.unlink(filePath).catch(() => {});
  }
}
