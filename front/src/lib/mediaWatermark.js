import { formatGps } from "./geoLocation";

export function formatCaptureDate(date = new Date()) {
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Lignes affichées sur le filigrane (bas de l'image). */
export function buildWatermarkLines({ chantierNom, orgNom, latitude, longitude, capturedAt = new Date() }) {
  const lines = [];
  if (orgNom) lines.push(String(orgNom).slice(0, 60));
  if (chantierNom) lines.push(String(chantierNom).slice(0, 70));
  lines.push(formatCaptureDate(capturedAt));
  const gps = formatGps(latitude, longitude);
  if (gps) lines.push(gps);
  lines.push("BTP IA — preuve terrain");
  return lines;
}

/** Dessine le filigrane sur un canvas 2D (coin bas-gauche). */
export function drawWatermarkOnCanvas(ctx, width, height, meta) {
  const lines = buildWatermarkLines(meta);
  const fontSize = Math.max(14, Math.round(width / 42));
  const lineHeight = fontSize * 1.35;
  const padX = Math.round(fontSize * 0.75);
  const padY = Math.round(fontSize * 0.65);
  const boxH = padY * 2 + lines.length * lineHeight;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, height - boxH, width, boxH);

  ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, padX, height - boxH + padY + i * lineHeight);
  });
  ctx.restore();
}

/** Applique le filigrane à un fichier image (galerie / appareil natif). */
export async function watermarkImageFile(file, meta) {
  if (!file.type?.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, meta);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Filigrane impossible"))), "image/jpeg", 0.92);
  });

  const base = file.name.replace(/\.[^.]+$/, "") || "photo_chantier";
  return new File([blob], `${base}_filigrane.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

export function uploadWatermarkFields(meta, alreadyWatermarked = true) {
  const fields = { watermarked: alreadyWatermarked ? "1" : "0" };
  if (meta?.latitude != null) fields.latitude = String(meta.latitude);
  if (meta?.longitude != null) fields.longitude = String(meta.longitude);
  return fields;
}
