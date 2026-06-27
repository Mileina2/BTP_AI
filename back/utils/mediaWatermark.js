import sharp from "sharp";

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildWatermarkLines({
  chantierNom,
  orgNom,
  latitude,
  longitude,
  capturedAt = new Date(),
}) {
  const dateStr = capturedAt.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const lines = [];
  if (orgNom) lines.push(String(orgNom).slice(0, 60));
  if (chantierNom) lines.push(String(chantierNom).slice(0, 70));
  lines.push(dateStr);
  if (latitude != null && longitude != null && !Number.isNaN(Number(latitude))) {
    lines.push(`GPS ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`);
  }
  lines.push("BTP IA — preuve terrain");
  return lines;
}

/** Filigrane sur buffer image (JPEG/PNG/WebP). */
export async function watermarkImageBuffer(buffer, meta) {
  const image = sharp(buffer);
  const { width, height } = await image.metadata();
  if (!width || !height) return buffer;

  const lines = buildWatermarkLines(meta);
  const fontSize = Math.max(16, Math.round(width / 42));
  const lineHeight = Math.round(fontSize * 1.35);
  const padX = Math.round(fontSize * 0.75);
  const padY = Math.round(fontSize * 0.65);
  const boxH = padY * 2 + lines.length * lineHeight;

  const textSvg = lines
    .map(
      (line, i) =>
        `<text x="${padX}" y="${padY + fontSize + i * lineHeight}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="600" fill="#ffffff">${escapeXml(line)}</text>`
    )
    .join("");

  const svg = Buffer.from(
    `<svg width="${width}" height="${boxH}">
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.58)"/>
      ${textSvg}
    </svg>`
  );

  return image
    .composite([{ input: svg, top: Math.max(0, height - boxH), left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

export function parseWatermarkMeta(body = {}, defaults = {}) {
  const lat = body.latitude != null && body.latitude !== "" ? Number(body.latitude) : defaults.latitude;
  const lng = body.longitude != null && body.longitude !== "" ? Number(body.longitude) : defaults.longitude;
  return {
    chantierNom: defaults.chantierNom,
    orgNom: defaults.orgNom,
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lng) ? lng : undefined,
    capturedAt: new Date(),
  };
}
