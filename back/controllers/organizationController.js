import prisma from "../config/prisma.js";
import { getOrgId, getUserId } from "../utils/legacyMap.js";

const ALLOWED_FIELDS = [
  "nom",
  "adresse",
  "ville",
  "pays",
  "logoUrl",
  "telephone",
  "email",
  "rccm",
  "compteContribuable",
  "banque",
  "rib",
  "assuranceRc",
  "assuranceDecennale",
  "signataireNom",
  "signataireFonction",
  "devise",
];

function sanitizeLogoUrl(url) {
  if (!url) return null;
  if (typeof url !== "string") return null;
  if (url.startsWith("data:image/")) {
    if (url.length > 3_000_000) throw new Error("Logo trop volumineux (max ~2 Mo)");
    return url;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  throw new Error("Format de logo non supporté");
}

async function ensureOrganization(req) {
  const userId = getUserId(req.user);
  let orgId = getOrgId(req.user);

  if (orgId) {
    const existing = await prisma.organization.findUnique({ where: { id: orgId } });
    if (existing) return existing;
  }

  const fallbackName =
    req.user.organization?.nom ||
    [req.user.prenom, req.user.nom].filter(Boolean).join(" ").trim() ||
    "Mon entreprise";

  const org = await prisma.organization.create({
    data: {
      nom: fallbackName.endsWith("Entreprise") ? fallbackName : `${fallbackName} — Entreprise`,
      adresse: req.user.organization?.adresse || null,
      ville: req.user.organization?.ville || null,
      pays: req.user.organization?.pays || "Côte d'Ivoire",
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { organizationId: org.id },
  });

  return org;
}

export const getOrganization = async (req, res) => {
  try {
    const org = await ensureOrganization(req);
    res.json(org);
  } catch (error) {
    console.error("Erreur getOrganization:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateOrganization = async (req, res) => {
  try {
    const org = await ensureOrganization(req);
    const data = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (data.logoUrl !== undefined) data.logoUrl = sanitizeLogoUrl(data.logoUrl);

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data,
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
