import prisma from "../config/prisma.js";

export const DEFAULT_PRESTATIONS = [
  { designation: "Maçonnerie — murs porteurs", unite: "m²", prixUnitaire: 0, categorie: "Gros œuvre" },
  { designation: "Coffrage et ferraillage", unite: "m²", prixUnitaire: 0, categorie: "Gros œuvre" },
  { designation: "Enduit intérieur / extérieur", unite: "m²", prixUnitaire: 0, categorie: "Second œuvre" },
  { designation: "Carrelage sol et mur", unite: "m²", prixUnitaire: 0, categorie: "Second œuvre" },
  { designation: "Plomberie — installation sanitaire", unite: "forfait", prixUnitaire: 0, categorie: "Lots techniques" },
  { designation: "Électricité — câblage complet", unite: "forfait", prixUnitaire: 0, categorie: "Lots techniques" },
  { designation: "Peinture intérieure", unite: "m²", prixUnitaire: 0, categorie: "Finitions" },
  { designation: "Menuiserie bois / aluminium", unite: "u", prixUnitaire: 0, categorie: "Finitions" },
];

export async function ensureDefaultPrestations(organizationId) {
  const count = await prisma.prestationCatalog.count({ where: { organizationId } });
  if (count > 0) return;

  await prisma.prestationCatalog.createMany({
    data: DEFAULT_PRESTATIONS.map((p, i) => ({
      organizationId,
      ...p,
      ordre: i,
    })),
  });
}

export async function listPrestations(organizationId) {
  await ensureDefaultPrestations(organizationId);
  return prisma.prestationCatalog.findMany({
    where: { organizationId },
    orderBy: [{ ordre: "asc" }, { designation: "asc" }],
  });
}

export async function createPrestation(organizationId, data) {
  const maxOrdre = await prisma.prestationCatalog.aggregate({
    where: { organizationId },
    _max: { ordre: true },
  });

  return prisma.prestationCatalog.create({
    data: {
      organizationId,
      designation: data.designation.trim(),
      unite: data.unite?.trim() || "u",
      prixUnitaire: Number(data.prixUnitaire) || 0,
      categorie: data.categorie?.trim() || null,
      ordre: (maxOrdre._max.ordre ?? -1) + 1,
    },
  });
}

export async function deletePrestation(organizationId, id) {
  const item = await prisma.prestationCatalog.findFirst({
    where: { id, organizationId },
  });
  if (!item) return null;
  await prisma.prestationCatalog.delete({ where: { id } });
  return item;
}
