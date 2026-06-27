import { getOrgId, getUserId } from "./legacyMap.js";

export function isManagement(user) {
  return user?.role === "ENTREPRENEUR" || user?.role === "ADMIN";
}

export function isChefChantier(user) {
  return user?.role === "CHEF_CHANTIER";
}

export function isClientPortal(user) {
  return user?.role === "CLIENT";
}

/** Filtre Prisma pour lister uniquement les chantiers accessibles au rôle. */
export function chantierScopeWhere(user) {
  const organizationId = getOrgId(user);
  const userId = getUserId(user);

  if (isManagement(user)) return { organizationId };
  if (isChefChantier(user)) return { organizationId, chefChantierId: userId };
  if (isClientPortal(user)) return { organizationId, client: { userId } };
  return { organizationId };
}

export async function findAccessibleChantier(prisma, user, chantierId) {
  return prisma.chantier.findFirst({
    where: { id: chantierId, ...chantierScopeWhere(user) },
  });
}

export async function getAccessibleChantierIds(prisma, user) {
  const rows = await prisma.chantier.findMany({
    where: chantierScopeWhere(user),
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Masque les données financières / internes pour le portail propriétaire. */
export function sanitizeChantierDetail(detail, user) {
  if (!detail || isManagement(user) || isChefChantier(user)) return detail;

  if (isClientPortal(user)) {
    return {
      id: detail.id,
      _id: detail._id,
      nom: detail.nom,
      description: detail.description,
      adresse: detail.adresse,
      ville: detail.ville,
      statut: detail.statut,
      typeTravaux: detail.typeTravaux,
      dateDebut: detail.dateDebut,
      dateFin: detail.dateFin,
      indicateurs: detail.indicateurs,
      counts: detail.counts
        ? {
            rapports: detail.counts.rapports,
            timeline: detail.counts.timeline,
            documents: detail.counts.documents,
          }
        : undefined,
      rapports: detail.rapports,
    };
  }

  return detail;
}
