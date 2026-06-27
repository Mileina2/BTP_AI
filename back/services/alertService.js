import prisma from "../config/prisma.js";

export async function syncAlerts(organizationId, userId) {
  const generated = [];

  // Factures impayées
  const facturesImpayees = await prisma.facture.findMany({
    where: { organizationId, statut: { in: ["ENVOYEE", "IMPAYEE"] } },
    include: { client: { select: { nom: true } } },
  });

  for (const f of facturesImpayees) {
    const exists = await prisma.alert.findFirst({
      where: {
        organizationId,
        type: "FACTURE_IMPAYEE",
        resolu: false,
        message: { contains: f.numero },
      },
    });
    if (!exists) {
      const alert = await prisma.alert.create({
        data: {
          organizationId,
          userId,
          type: "FACTURE_IMPAYEE",
          priorite: "HAUTE",
          titre: "Facture impayée",
          message: `Relancer la facture ${f.numero} — ${f.client.nom} (${f.montantTTC.toLocaleString("fr-FR")} F CFA)`,
          actionLabel: "Voir factures",
          actionUrl: "#/factures",
        },
      });
      generated.push(alert);
    }
  }

  // Stock bas
  const stocksAlerte = await prisma.stockArticle.findMany({
    where: { organizationId, etat: { in: ["ALERTE", "RUPTURE"] } },
  });

  for (const s of stocksAlerte) {
    const exists = await prisma.alert.findFirst({
      where: { organizationId, type: "STOCK_BAS", resolu: false, message: { contains: s.nom } },
    });
    if (!exists) {
      const alert = await prisma.alert.create({
        data: {
          organizationId,
          userId,
          type: "STOCK_BAS",
          priorite: s.etat === "RUPTURE" ? "CRITIQUE" : "MOYENNE",
          titre: s.etat === "RUPTURE" ? "Rupture de stock" : "Stock bas",
          message: `Commander ${s.nom} — reste ${s.quantiteActuelle} ${s.unite}`,
          actionLabel: "Voir stock",
          actionUrl: "#/stock",
        },
      });
      generated.push(alert);
    }
  }

  // Budget dépassé
  const chantiers = await prisma.chantier.findMany({
    where: { organizationId, statut: { in: ["EN_COURS", "EN_PREPARATION"] } },
  });

  for (const c of chantiers) {
    if (c.budget > 0 && c.depenses / c.budget >= 0.8) {
      const exists = await prisma.alert.findFirst({
        where: { organizationId, chantierId: c.id, type: "BUDGET_DEPASSE", resolu: false },
      });
      if (!exists) {
        const ratio = Math.round((c.depenses / c.budget) * 100);
        const alert = await prisma.alert.create({
          data: {
            organizationId,
            userId,
            chantierId: c.id,
            type: "BUDGET_DEPASSE",
            priorite: ratio > 100 ? "CRITIQUE" : "HAUTE",
            titre: "Risque budgétaire",
            message: `${c.nom} : ${ratio}% du budget consommé`,
            actionLabel: "Voir budget",
            actionUrl: "#/budget",
          },
        });
        generated.push(alert);
      }
    }
  }

  // Devis prêts à envoyer
  const devisEnAttente = await prisma.devis.findMany({
    where: { organizationId, statut: "EN_ATTENTE" },
    include: { client: { select: { nom: true } } },
  });

  for (const d of devisEnAttente) {
    const exists = await prisma.alert.findFirst({
      where: { organizationId, type: "DEVIS_A_ENVOYER", resolu: false, message: { contains: d.numero } },
    });
    if (!exists) {
      const alert = await prisma.alert.create({
        data: {
          organizationId,
          userId,
          type: "DEVIS_A_ENVOYER",
          priorite: "MOYENNE",
          titre: "Devis prêt à envoyer",
          message: `Devis ${d.numero} pour ${d.client.nom} (${d.montantTTC.toLocaleString("fr-FR")} F CFA)`,
          actionLabel: "Voir devis",
          actionUrl: "#/devis",
        },
      });
      generated.push(alert);
    }
  }

  // Demandes matériel urgentes
  const demandes = await prisma.demandeMateriel.findMany({
    where: { organizationId, statut: "EN_ATTENTE", urgence: "HAUTE" },
    include: { chantier: { select: { nom: true } } },
  });

  for (const d of demandes) {
    const exists = await prisma.alert.findFirst({
      where: { organizationId, type: "DEMANDE_MATERIEL", resolu: false, message: { contains: d.designation } },
    });
    if (!exists) {
      const alert = await prisma.alert.create({
        data: {
          organizationId,
          userId,
          chantierId: d.chantierId,
          type: "DEMANDE_MATERIEL",
          priorite: "HAUTE",
          titre: "Demande matériel urgente",
          message: `${d.chantier.nom} : ${d.quantite} ${d.unite} de ${d.designation}`,
          actionLabel: "Traiter demande",
          actionUrl: "#/stock",
        },
      });
      generated.push(alert);
    }
  }

  return generated;
}

export async function getActiveAlerts(organizationId, limit = 20) {
  return prisma.alert.findMany({
    where: { organizationId, resolu: false },
    orderBy: [{ priorite: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { chantier: { select: { nom: true } } },
  });
}

export async function markAlertRead(id, organizationId) {
  return prisma.alert.updateMany({
    where: { id, organizationId },
    data: { lu: true },
  });
}

export async function resolveAlert(id, organizationId) {
  return prisma.alert.updateMany({
    where: { id, organizationId },
    data: { resolu: true, lu: true },
  });
}
