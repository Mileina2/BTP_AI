import prisma from "../config/prisma.js";
import { fmtMoney } from "./currency.js";
import { sendDevisStatusNotificationEmail } from "./emailService.js";
import { DEVIS_STATUT_LABEL } from "./legacyMap.js";

export async function notifyEntrepreneurDevisStatus(devisId, statutRaw, { clientName, signatureNom } = {}) {
  const devis = await prisma.devis.findUnique({
    where: { id: devisId },
    include: {
      client: { select: { nom: true } },
      organization: { select: { nom: true, devise: true } },
    },
  });
  if (!devis) return { sent: false };

  const entrepreneurs = await prisma.user.findMany({
    where: {
      organizationId: devis.organizationId,
      role: { in: ["ENTREPRENEUR", "ADMIN"] },
      statut: "ACTIF",
    },
    select: { email: true, prenom: true, nom: true },
  });

  const recipients = entrepreneurs.filter((u) => u.email);
  if (!recipients.length) return { sent: false, reason: "no_email" };

  const statutLabel = DEVIS_STATUT_LABEL[statutRaw] || statutRaw;
  const client = clientName || devis.client?.nom || "Client";
  const versionSuffix = devis.version > 1 ? ` (v${devis.version})` : "";

  const results = [];
  for (const user of recipients) {
    const r = await sendDevisStatusNotificationEmail({
      to: user.email,
      entrepreneurName: [user.prenom, user.nom].filter(Boolean).join(" ") || user.email,
      devisNumero: `${devis.numero}${versionSuffix}`,
      clientName: client,
      statut: statutLabel,
      statutRaw,
      montantLabel: fmtMoney(devis.montantTTC, devis.organization?.devise),
      organizationName: devis.organization?.nom,
      signatureNom,
    });
    results.push(r);
  }

  return { sent: results.some((r) => r.sent), count: results.filter((r) => r.sent).length };
}
