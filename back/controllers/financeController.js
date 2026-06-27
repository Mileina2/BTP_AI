import prisma from "../config/prisma.js";
import {
  DEVIS_STATUT_FROM_LABEL,
  DEVIS_STATUT_LABEL,
  FACTURE_STATUT_FROM_LABEL,
  FACTURE_STATUT_LABEL,
  MODE_PAIEMENT_FROM_LABEL,
  genererNumero,
  getOrgId,
  getUserId,
  toLegacy,
} from "../utils/legacyMap.js";
import { getDevisOverview, getDevisDetail } from "../services/devisService.js";
import {
  listPrestations,
  createPrestation,
  deletePrestation,
} from "../services/prestationCatalogService.js";
import { getFactureOverview, getFactureDetail } from "../services/factureService.js";
import { getComptaOverview, buildComptaJournalCsv } from "../services/comptaService.js";
import {
  initSyscohadaPlan,
  ensureSyscohadaPlan,
  syncComptabiliteSyscohada,
  getSyncStatus,
  createEcritureManuelle,
  getPlanComptable,
  getJournalComptable,
  getBalanceComptable,
  getGrandLivre,
  buildBalanceCsv,
  buildGrandLivreCsv,
} from "../services/comptaComptableService.js";
import { JOURNAL_LABELS } from "../utils/syscohadaPlan.js";
import {
  syncChantierDepenses,
  formatDepenseList,
  buildBudgetAnalyse,
  getBudgetOverview,
  getChantierBudget,
  getDepenseDetail,
  parseDepenseInput,
  buildBudgetCsv,
} from "../services/budgetService.js";
import {
  parseMembreInput,
  formatEquipe,
  computeSalaireTotal,
  syncSalaireDepense,
  getEquipeOverview,
  buildAnalyseMasseSalariale,
  getMembresForExport,
} from "../services/equipeService.js";
import {
  parseStockInput,
  formatStock,
  recalcStockEtat,
  getStockOverview,
  buildStockAnalyse,
  syncStockDepense,
  getArticlesForExport,
  articleValeur,
} from "../services/stockService.js";
import { streamDevisPdf, bufferDevisPdf } from "../utils/devisPdf.js";
import { streamFacturePdf, bufferFacturePdf } from "../utils/facturePdf.js";
import { streamAvoirPdf } from "../utils/avoirPdf.js";
import { buildFacturesComptableCsv } from "../utils/factureExport.js";
import {
  assertFactureEditable,
  computeFactureNetAPayer,
  syncFacturePaymentStatus,
} from "../utils/facturePayments.js";
import { streamBudgetPdf, streamBudgetConsolidatedPdf } from "../utils/budgetPdf.js";
import { streamEquipePdf } from "../utils/equipePdf.js";
import { streamStockPdf } from "../utils/stockPdf.js";
import { fmtMoney } from "../utils/currency.js";
import { pickAllowed } from "../utils/pickFields.js";
import { logAudit } from "../utils/auditService.js";
import { sendDocumentEmail } from "../utils/emailService.js";
import { buildWhatsAppUrl } from "../utils/whatsapp.js";
import { notifyEntrepreneurDevisStatus } from "../utils/devisNotify.js";
import { computeDevisAmounts } from "../utils/devisTotals.js";
import { applyFactureStoredAmounts } from "../utils/factureTotals.js";
import { isManagement, getAccessibleChantierIds } from "../utils/accessControl.js";
import { parseDpgfWorkbook, buildDpgfTemplateWorkbook } from "../utils/dpgfImport.js";
import {
  listDevisAnnexes,
  createDevisAnnexe,
  removeDevisAnnexe,
  getDevisAnnexeBuffers,
} from "../services/devisAnnexeService.js";

function mapPlanningInput(taches) {
  if (!Array.isArray(taches)) return [];
  return taches
    .filter((t) => t?.libelle?.trim() && t?.dateDebut && t?.dateFin)
    .map((t, index) => ({
      libelle: t.libelle.trim(),
      section: t.section?.trim() || "Général",
      dateDebut: new Date(t.dateDebut),
      dateFin: new Date(t.dateFin),
      ordre: index,
      progression: Math.min(100, Math.max(0, Number(t.progression) || 0)),
    }))
    .filter((t) => !Number.isNaN(t.dateDebut.getTime()) && !Number.isNaN(t.dateFin.getTime()));
}

async function syncPlanningTaches(devisId, taches) {
  if (!Array.isArray(taches)) return;
  await prisma.devisPlanningTache.deleteMany({ where: { devisId } });
  if (!taches.length) return;
  await prisma.devisPlanningTache.createMany({ data: taches.map((t) => ({ devisId, ...t })) });
}

function mapIndexationFields(body) {
  const data = {};
  if (body.indexationActive !== undefined) data.indexationActive = Boolean(body.indexationActive);
  if (body.indexationReference !== undefined) data.indexationReference = body.indexationReference?.trim() || null;
  if (body.indexationDateBase !== undefined) {
    data.indexationDateBase = body.indexationDateBase ? new Date(body.indexationDateBase) : null;
  }
  if (body.indexationTauxMax !== undefined) data.indexationTauxMax = Number(body.indexationTauxMax) || 0;
  if (body.indexationClause !== undefined) data.indexationClause = body.indexationClause?.trim() || null;
  if (body.planningDebut !== undefined) data.planningDebut = body.planningDebut ? new Date(body.planningDebut) : null;
  if (body.planningFin !== undefined) data.planningFin = body.planningFin ? new Date(body.planningFin) : null;
  return data;
}

function derivePlanningBounds(taches) {
  if (!taches?.length) return { planningDebut: null, planningFin: null };
  const starts = taches.map((t) => t.dateDebut.getTime());
  const ends = taches.map((t) => t.dateFin.getTime());
  return {
    planningDebut: new Date(Math.min(...starts)),
    planningFin: new Date(Math.max(...ends)),
  };
}

function orgDevise(user) {
  return user?.organization?.devise || "XOF";
}

function mapLigneInput(l, index, defaultTva = 18) {
  return {
    section: l.section?.trim() || "Général",
    reference: l.reference?.trim() || null,
    designation: l.designation,
    detailDescription: l.detailDescription?.trim() || null,
    quantite: Number(l.quantite) || 1,
    unite: l.unite || "u",
    prixUnitaire: Number(l.prixUnitaire) || 0,
    tva: Number(l.tva ?? defaultTva) || 0,
    isOption: Boolean(l.isOption),
    ordre: index,
  };
}

function applyDevisAmounts(body, lignes, existing = {}) {
  const tva = body.tva ?? existing.tva ?? 18;
  const remisePercent = body.remisePercent ?? existing.remisePercent ?? 0;
  const retenueGarantie = body.retenueGarantie ?? existing.retenueGarantie ?? 0;
  const amounts = computeDevisAmounts(lignes, tva, remisePercent, retenueGarantie);
  body.montantHT = amounts.montantHT;
  body.montantTVA = amounts.montantTVA;
  body.montantTTC = amounts.montantTTC;
  return amounts;
}

const DEVIS_PDF_INCLUDE = {
  client: true,
  chantier: true,
  lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
  parentDevis: { select: { numero: true } },
  annexes: { orderBy: [{ ordre: "asc" }, { createdAt: "asc" }] },
  planningTaches: { orderBy: [{ ordre: "asc" }, { dateDebut: "asc" }] },
};

const DEVIS_DETAIL_INCLUDE = {
  client: true,
  chantier: true,
  lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
  annexes: { orderBy: [{ ordre: "asc" }, { createdAt: "asc" }] },
  planningTaches: { orderBy: [{ ordre: "asc" }, { dateDebut: "asc" }] },
};

function formatDepense(d, deviseCode = "XOF") {
  return formatDepenseList(d, deviseCode);
}

function formatDevis(d) {
  const versionLabel = d.version > 1 ? ` (v${d.version})` : "";
  return toLegacy({
    ...d,
    statut: DEVIS_STATUT_LABEL[d.statut] || d.statut,
    numeroAffiche: `${d.numero}${versionLabel}`,
    lignes: d.lignes?.map((l) => toLegacy(l)),
    client: d.client ? toLegacy(d.client) : d.clientId,
    chantier: d.chantier ? toLegacy(d.chantier) : d.chantierId,
  });
}

async function cloneDevisFromSource(source, { orgId, parentDevisId = null, version = 1 }) {
  const count = await prisma.devis.count({ where: { organizationId: orgId } });
  const numero = await genererNumero("DEV", count);

  const copy = await prisma.devis.create({
    data: {
      organizationId: orgId,
      clientId: source.clientId,
      chantierId: source.chantierId,
      parentDevisId,
      version,
      numero,
      description: source.description,
      conditions: source.conditions,
      validite: source.validite,
      tva: source.tva,
      remisePercent: source.remisePercent ?? 0,
      acomptePercent: source.acomptePercent ?? 30,
      delaiExecution: source.delaiExecution,
      retenueGarantie: source.retenueGarantie ?? 0,
      referenceInterne: source.referenceInterne,
      indexationActive: source.indexationActive ?? false,
      indexationReference: source.indexationReference,
      indexationDateBase: source.indexationDateBase,
      indexationTauxMax: source.indexationTauxMax ?? 5,
      indexationClause: source.indexationClause,
      planningDebut: source.planningDebut,
      planningFin: source.planningFin,
      montantHT: source.montantHT,
      montantTVA: source.montantTVA,
      montantTTC: source.montantTTC,
      statut: "EN_ATTENTE",
      signataireNom: source.signataireNom,
      signataireFonction: source.signataireFonction,
      signatureData: null,
      lignes: {
        create: source.lignes.map((l, i) => ({
          section: l.section || "Général",
          reference: l.reference,
          designation: l.designation,
          detailDescription: l.detailDescription,
          quantite: l.quantite,
          unite: l.unite || "u",
          prixUnitaire: l.prixUnitaire,
          tva: l.tva ?? source.tva ?? 18,
          isOption: l.isOption ?? false,
          ordre: l.ordre ?? i,
        })),
      },
    },
    include: { lignes: true, client: true, chantier: true },
  });

  if (source.planningTaches?.length) {
    await prisma.devisPlanningTache.createMany({
      data: source.planningTaches.map((t, i) => ({
        devisId: copy.id,
        libelle: t.libelle,
        section: t.section || "Général",
        dateDebut: t.dateDebut,
        dateFin: t.dateFin,
        ordre: t.ordre ?? i,
        progression: t.progression ?? 0,
      })),
    });
  }

  return prisma.devis.findFirst({
    where: { id: copy.id },
    include: DEVIS_DETAIL_INCLUDE,
  });
}

export const getDevisOverviewHandler = async (req, res) => {
  try {
    const data = await getDevisOverview(getOrgId(req.user));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDevisDetailHandler = async (req, res) => {
  try {
    const detail = await getDevisDetail(getOrgId(req.user), req.params.id);
    if (!detail) return res.status(404).json({ error: "Devis introuvable" });
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createDevis = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const { client, chantier, lignes = [], tva, description, conditions, validite, signataireNom, signataireFonction, signatureData, remisePercent, acomptePercent, delaiExecution, retenueGarantie, referenceInterne, planningTaches } = req.body;

    const existingClient = await prisma.client.findFirst({
      where: { id: client, organizationId: orgId },
    });
    if (!existingClient) return res.status(400).json({ error: "Client non trouvé" });

    if (chantier) {
      const ch = await prisma.chantier.findFirst({ where: { id: chantier, organizationId: orgId } });
      if (!ch) return res.status(400).json({ error: "Chantier non trouvé" });
    }

    const _tva = typeof tva === "number" ? tva : 18;
    const _remise = Number(remisePercent) || 0;
    const _retenue = Number(retenueGarantie) || 0;
    const mappedLignes = lignes.map((l, i) => mapLigneInput(l, i, _tva));
    const amounts = computeDevisAmounts(mappedLignes, _tva, _remise, _retenue);
    const count = await prisma.devis.count({ where: { organizationId: orgId } });
    const numero = await genererNumero("DEV", count);
    const mappedPlanning = mapPlanningInput(planningTaches);
    const planningBounds = mappedPlanning.length ? derivePlanningBounds(mappedPlanning) : {};

    const devis = await prisma.devis.create({
      data: {
        organizationId: orgId,
        clientId: client,
        chantierId: chantier || null,
        numero,
        description,
        conditions,
        validite: validite || 30,
        tva: _tva,
        remisePercent: _remise,
        acomptePercent: Number(acomptePercent) || 30,
        delaiExecution: delaiExecution?.trim() || null,
        retenueGarantie: _retenue,
        referenceInterne: referenceInterne?.trim() || null,
        ...mapIndexationFields(req.body),
        ...(mappedPlanning.length
          ? { planningDebut: planningBounds.planningDebut, planningFin: planningBounds.planningFin }
          : {}),
        montantHT: amounts.montantHT,
        montantTVA: amounts.montantTVA,
        montantTTC: amounts.montantTTC,
        statut: "EN_ATTENTE",
        signataireNom: signataireNom || null,
        signataireFonction: signataireFonction || null,
        signatureData: signatureData || null,
        lignes: {
          create: mappedLignes,
        },
        ...(mappedPlanning.length
          ? {
              planningTaches: {
                create: mappedPlanning,
              },
            }
          : {}),
      },
      include: DEVIS_DETAIL_INCLUDE,
    });

    res.status(201).json(formatDevis(devis));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const listPrestationsHandler = async (req, res) => {
  try {
    const items = await listPrestations(getOrgId(req.user));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createPrestationHandler = async (req, res) => {
  try {
    const { designation, unite, prixUnitaire, categorie } = req.body;
    if (!designation?.trim()) {
      return res.status(400).json({ error: "Désignation requise." });
    }
    const item = await createPrestation(getOrgId(req.user), {
      designation,
      unite,
      prixUnitaire,
      categorie,
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deletePrestationHandler = async (req, res) => {
  try {
    const item = await deletePrestation(getOrgId(req.user), req.params.prestationId);
    if (!item) return res.status(404).json({ error: "Prestation introuvable." });
    res.json({ message: "Prestation supprimée." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const duplicateDevis = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const source = await prisma.devis.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: { lignes: true, planningTaches: true },
    });
    if (!source) return res.status(404).json({ error: "Devis introuvable" });

    const copy = await cloneDevisFromSource(source, { orgId, version: 1, parentDevisId: null });

    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "DUPLICATE_DEVIS",
      entity: "Devis",
      entityId: copy.id,
      details: `${source.numero} → ${copy.numero}`,
    });

    res.status(201).json({
      message: "Devis dupliqué.",
      devis: formatDevis(copy),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createDevisVersion = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const source = await prisma.devis.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: { lignes: true, planningTaches: true },
    });
    if (!source) return res.status(404).json({ error: "Devis introuvable" });

    const rootId = source.parentDevisId || source.id;
    const maxV = await prisma.devis.aggregate({
      where: { OR: [{ id: rootId }, { parentDevisId: rootId }] },
      _max: { version: true },
    });
    const newVersion = (maxV._max.version || 1) + 1;

    const copy = await cloneDevisFromSource(source, {
      orgId,
      parentDevisId: rootId,
      version: newVersion,
    });

    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "DEVIS_VERSION",
      entity: "Devis",
      entityId: copy.id,
      details: `${source.numero} → ${copy.numero} v${newVersion}`,
    });

    res.status(201).json({
      message: `Nouvelle version v${newVersion} créée.`,
      devis: formatDevis(copy),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllDevis = async (req, res) => {
  try {
    const devis = await prisma.devis.findMany({
      where: { organizationId: getOrgId(req.user) },
      include: { client: true, chantier: true, lignes: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(devis.map(formatDevis));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDevisById = async (req, res) => {
  try {
    const devis = await prisma.devis.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
      include: DEVIS_DETAIL_INCLUDE,
    });
    if (!devis) return res.status(404).json({ error: "Devis introuvable" });
    res.json(formatDevis(devis));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateDevis = async (req, res) => {
  try {
    const existing = await prisma.devis.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
    });
    if (!existing) return res.status(404).json({ error: "Devis introuvable" });

    const body = pickAllowed(req.body, [
      "description",
      "conditions",
      "validite",
      "tva",
      "remisePercent",
      "acomptePercent",
      "delaiExecution",
      "retenueGarantie",
      "referenceInterne",
      "indexationActive",
      "indexationReference",
      "indexationDateBase",
      "indexationTauxMax",
      "indexationClause",
      "planningDebut",
      "planningFin",
      "statut",
      "signataireNom",
      "signataireFonction",
      "signatureData",
      "chantierId",
      "lignes",
    ]);
    if (req.body.chantier !== undefined) body.chantierId = req.body.chantier || null;
    if (body.statut) body.statut = DEVIS_STATUT_FROM_LABEL[body.statut] || body.statut;
    Object.assign(body, mapIndexationFields(req.body));

    if (req.body.planningTaches !== undefined) {
      const mappedPlanning = mapPlanningInput(req.body.planningTaches);
      await syncPlanningTaches(req.params.id, mappedPlanning);
      if (mappedPlanning.length) {
        Object.assign(body, derivePlanningBounds(mappedPlanning));
      } else if (req.body.planningTaches.length === 0) {
        body.planningDebut = null;
        body.planningFin = null;
      }
    }

    if (body.lignes) {
      await prisma.devisLigne.deleteMany({ where: { devisId: req.params.id } });
      const mappedLignes = body.lignes.map((l, i) => mapLigneInput(l, i, body.tva ?? existing.tva ?? 18));
      applyDevisAmounts(body, mappedLignes, existing);
      await prisma.devisLigne.createMany({
        data: mappedLignes.map((l) => ({
          devisId: req.params.id,
          ...l,
        })),
      });
      delete body.lignes;
    } else if (body.remisePercent !== undefined || body.tva !== undefined || body.retenueGarantie !== undefined) {
      const currentLignes = await prisma.devisLigne.findMany({
        where: { devisId: req.params.id },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
      });
      applyDevisAmounts(body, currentLignes, existing);
    }

    const devis = await prisma.devis.update({
      where: { id: req.params.id },
      data: body,
      include: DEVIS_DETAIL_INCLUDE,
    });
    res.json(formatDevis(devis));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteDevis = async (req, res) => {
  try {
    const existing = await prisma.devis.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
    });
    if (!existing) return res.status(404).json({ error: "Devis introuvable" });
    await prisma.devis.delete({ where: { id: req.params.id } });
    res.json({ message: "Devis supprimé" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const searchDevis = async (req, res) => {
  try {
    const q = req.query.q?.trim();
    const devis = await prisma.devis.findMany({
      where: {
        organizationId: getOrgId(req.user),
        OR: [
          { numero: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { client: true, chantier: true },
    });
    res.json(devis.map(formatDevis));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const importDpgfExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Fichier Excel requis (champ « file »)" });
    const result = await parseDpgfWorkbook(req.file.buffer);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const downloadDpgfTemplate = async (_req, res) => {
  try {
    const workbook = await buildDpgfTemplateWorkbook();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=modele_dpgf.xlsx");
    await workbook.xlsx.write(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDevisAnnexesHandler = async (req, res) => {
  try {
    const items = await listDevisAnnexes(req.user, req.params.id);
    if (items === null) return res.status(404).json({ error: "Devis introuvable" });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addDevisAnnexeHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Fichier requis (champ « file »)" });
    const annexe = await createDevisAnnexe(req.user, req.params.id, req.file, {
      nom: req.body.nom,
      type: req.body.type,
    });
    if (!annexe) return res.status(404).json({ error: "Devis introuvable" });
    res.status(201).json({ message: "Annexe ajoutée", annexe });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteDevisAnnexeHandler = async (req, res) => {
  try {
    const ok = await removeDevisAnnexe(req.user, req.params.id, req.params.annexeId);
    if (!ok) return res.status(404).json({ error: "Annexe introuvable" });
    res.json({ message: "Annexe supprimée" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const generateDevisPDF = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const devis = await prisma.devis.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: DEVIS_PDF_INCLUDE,
    });
    if (!devis) return res.status(404).json({ error: "Devis introuvable" });

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    const user = await prisma.user.findUnique({ where: { id: getUserId(req.user) } });
    const signatory = {
      nom: devis.signataireNom || organization?.signataireNom || `${user?.prenom || ""} ${user?.nom || ""}`.trim(),
      fonction: devis.signataireFonction || organization?.signataireFonction || "Gérant",
    };

    streamDevisPdf(res, devis, organization, signatory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const sendDevisWhatsApp = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const devis = await prisma.devis.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: { client: true },
    });
    if (!devis) return res.status(404).json({ error: "Devis introuvable" });

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { nom: true, devise: true },
    });

    if (!devis.client?.telephone) {
      return res.status(400).json({ error: "Numéro de téléphone client requis pour WhatsApp." });
    }

    const msg = [
      `Bonjour ${devis.client.nom},`,
      "",
      `Votre devis n° *${devis.numero}* est disponible.`,
      `Montant total TTC : *${fmtMoney(devis.montantTTC, organization?.devise)}*`,
      `Validité : ${devis.validite || 30} jours`,
      "",
      "Le PDF vous a été ou sera envoyé par email. N'hésitez pas à nous contacter pour toute question.",
      "",
      `Cordialement,`,
      organization?.nom || "Votre entreprise BTP",
    ].join("\n");

    const url = buildWhatsAppUrl(devis.client.telephone, msg);
    if (!url) {
      return res.status(400).json({ error: "Numéro de téléphone client invalide." });
    }

    res.json({ url, whatsappUrl: url, message: "Conversation WhatsApp prête à envoyer." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const sendDevisEmail = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const devis = await prisma.devis.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: DEVIS_PDF_INCLUDE,
    });
    if (!devis) return res.status(404).json({ error: "Devis introuvable" });

    const to = (req.body.email || devis.client?.email)?.trim()?.toLowerCase();
    if (!to) {
      return res.status(400).json({ error: "Email client requis pour l'envoi." });
    }

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    const user = await prisma.user.findUnique({ where: { id: getUserId(req.user) } });
    const signatory = {
      nom: devis.signataireNom || organization?.signataireNom || `${user?.prenom || ""} ${user?.nom || ""}`.trim(),
      fonction: devis.signataireFonction || organization?.signataireFonction || "Gérant",
    };

    const pdfBuffer = await bufferDevisPdf(devis, organization, signatory);
    const extraAttachments = await getDevisAnnexeBuffers(devis.id, orgId);
    const mail = await sendDocumentEmail({
      to,
      subject: `Devis ${devis.numero} — ${organization?.nom || "BTP IA"}`,
      docType: "Devis",
      docNumber: devis.numero,
      clientName: devis.client.nom,
      organizationName: organization?.nom,
      amountLabel: fmtMoney(devis.montantTTC, organization?.devise),
      extraLines: [
        `Validité : ${devis.validite || 30} jours`,
        devis.chantier?.nom ? `Chantier : ${devis.chantier.nom}` : "",
        extraAttachments.length ? `${extraAttachments.length} annexe(s) PDF jointe(s)` : "",
      ].filter(Boolean),
      attachment: {
        filename: `devis_${devis.numero}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
      extraAttachments,
    });

    if (!mail.sent) {
      return res.status(502).json({
        error: mail.error || "Email non envoyé. Vérifiez la configuration SMTP (Brevo).",
      });
    }

    if (devis.statut === "EN_ATTENTE") {
      await prisma.devis.update({
        where: { id: devis.id },
        data: { statut: "ENVOYE" },
      });
    }

    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "SEND_DEVIS_EMAIL",
      entity: "Devis",
      entityId: devis.id,
      details: to,
    });

    res.json({
      message: `Devis envoyé par email à ${to}.`,
      emailSent: true,
      email: to,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const sendFactureEmail = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const facture = await prisma.facture.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: FACTURE_PDF_INCLUDE,
    });
    if (!facture) return res.status(404).json({ error: "Facture introuvable" });

    const to = (req.body.email || facture.client?.email)?.trim()?.toLowerCase();
    if (!to) {
      return res.status(400).json({ error: "Email client requis pour l'envoi." });
    }

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    const pdfBuffer = await bufferFacturePdf(facture, organization);
    const extraLines = [
      facture.dateEcheance
        ? `Échéance : ${new Date(facture.dateEcheance).toLocaleDateString("fr-FR")}`
        : "",
      facture.chantier?.nom ? `Chantier : ${facture.chantier.nom}` : "",
    ].filter(Boolean);

    const mail = await sendDocumentEmail({
      to,
      subject: `Facture ${facture.numero} — ${organization?.nom || "BTP IA"}`,
      docType: "Facture",
      docNumber: facture.numero,
      clientName: facture.client.nom,
      organizationName: organization?.nom,
      amountLabel: fmtMoney(facture.montantTTC, organization?.devise),
      extraLines,
      attachment: {
        filename: `facture_${facture.numero}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    });

    if (!mail.sent) {
      return res.status(502).json({
        error: mail.error || "Email non envoyé. Vérifiez la configuration SMTP (Brevo).",
      });
    }

    if (facture.statut === "BROUILLON") {
      await prisma.facture.update({
        where: { id: facture.id },
        data: { statut: "ENVOYEE" },
      });
    }

    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "SEND_FACTURE_EMAIL",
      entity: "Facture",
      entityId: facture.id,
      details: to,
    });

    res.json({
      message: `Facture envoyée par email à ${to}.`,
      emailSent: true,
      email: to,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const sendFactureWhatsApp = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const facture = await prisma.facture.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: { client: true },
    });
    if (!facture) return res.status(404).json({ error: "Facture introuvable" });

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { nom: true, devise: true },
    });

    if (!facture.client?.telephone) {
      return res.status(400).json({ error: "Numéro de téléphone client requis pour WhatsApp." });
    }

    const echeance = facture.dateEcheance
      ? `Échéance : ${new Date(facture.dateEcheance).toLocaleDateString("fr-FR")}`
      : null;

    const msg = [
      `Bonjour ${facture.client.nom},`,
      "",
      `Votre facture n° *${facture.numero}* est disponible.`,
      `Montant total TTC : *${fmtMoney(facture.montantTTC, organization?.devise)}*`,
      echeance,
      "",
      "Le PDF vous a été ou sera envoyé par email. Merci de procéder au règlement dans les délais.",
      "",
      `Cordialement,`,
      organization?.nom || "Votre entreprise BTP",
    ]
      .filter(Boolean)
      .join("\n");

    const url = buildWhatsAppUrl(facture.client.telephone, msg);
    if (!url) {
      return res.status(400).json({ error: "Numéro de téléphone client invalide." });
    }

    res.json({ url, whatsappUrl: url, message: "Conversation WhatsApp prête à envoyer." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDevisHistorique = async (req, res) => {
  res.json({ historique: [] });
};

// ─── BUDGET / DÉPENSES ───────────────────────────────────

export const getBudgetOverviewHandler = async (req, res) => {
  try {
    const data = await getBudgetOverview(getOrgId(req.user));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportBudgetCsvHandler = async (req, res) => {
  try {
    const data = await getBudgetOverview(getOrgId(req.user));
    const csv = buildBudgetCsv(data);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=budget_charges_${stamp}.csv`);
    res.send(`\ufeff${csv}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDepenseDetailHandler = async (req, res) => {
  try {
    const detail = await getDepenseDetail(getOrgId(req.user), req.params.id);
    if (!detail) return res.status(404).json({ error: "Dépense introuvable" });
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createDepense = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const body = req.body;
    const chantier = await prisma.chantier.findFirst({
      where: { id: body.chantier, organizationId: orgId },
    });
    if (!chantier) return res.status(403).json({ error: "Chantier non autorisé" });

    const data = parseDepenseInput(body);

    const depense = await prisma.depense.create({
      data: {
        organizationId: orgId,
        chantierId: body.chantier,
        ...data,
      },
    });

    await syncChantierDepenses(body.chantier);
    const updated = await prisma.chantier.findUnique({ where: { id: body.chantier } });
    const budgetRestant = updated.budget - updated.depenses;

    const devise = orgDevise(req.user);

    res.json({
      message: "Dépense enregistrée",
      depense: formatDepense(depense, devise),
      chantier: toLegacy({ ...updated, budgetRestant }),
      warning: budgetRestant < 0 ? `Dépassement de budget de ${fmtMoney(Math.abs(budgetRestant), devise)}` : null,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllDepenses = async (req, res) => {
  try {
    const depenses = await prisma.depense.findMany({
      where: { organizationId: getOrgId(req.user) },
      include: { chantier: { select: { id: true, nom: true } } },
      orderBy: { date: "desc" },
    });
    res.json(depenses.map((d) => formatDepense(d, orgDevise(req.user))));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDepenseById = async (req, res) => {
  try {
    const depense = await prisma.depense.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
      include: { chantier: true },
    });
    if (!depense) return res.status(404).json({ error: "Dépense introuvable" });
    res.json(formatDepense(depense, orgDevise(req.user)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateDepense = async (req, res) => {
  try {
    const existing = await prisma.depense.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
    });
    if (!existing) return res.status(404).json({ error: "Dépense introuvable" });

    const data = parseDepenseInput({ ...existing, ...req.body });
    const depense = await prisma.depense.update({
      where: { id: req.params.id },
      data,
    });
    await syncChantierDepenses(depense.chantierId);
    res.json(formatDepense(depense, orgDevise(req.user)));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteDepense = async (req, res) => {
  try {
    const existing = await prisma.depense.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
    });
    if (!existing) return res.status(404).json({ error: "Dépense introuvable" });

    await prisma.depense.delete({ where: { id: req.params.id } });
    await syncChantierDepenses(existing.chantierId);
    res.json({ message: "Dépense supprimée" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBudgetByChantier = async (req, res) => {
  try {
    const data = await getChantierBudget(getOrgId(req.user), req.params.chantierId);
    if (!data) return res.status(404).json({ error: "Chantier introuvable" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBudgetAnalyse = async (req, res) => {
  try {
    const chantier = await prisma.chantier.findFirst({
      where: { id: req.params.chantierId, organizationId: getOrgId(req.user) },
    });
    if (!chantier) return res.status(404).json({ error: "Chantier introuvable" });

    const depenses = await prisma.depense.findMany({
      where: { chantierId: req.params.chantierId, organizationId: getOrgId(req.user) },
    });
    res.json(buildBudgetAnalyse(depenses, chantier.budget));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const predictBudget = async (req, res) => {
  try {
    const data = await getChantierBudget(getOrgId(req.user), req.params.chantierId);
    if (!data) return res.status(404).json({ error: "Chantier introuvable" });
    res.json({ prediction: data.prediction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportBudgetPDF = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const data = await getChantierBudget(orgId, req.params.chantierId);
    if (!data) return res.status(404).json({ error: "Chantier introuvable" });

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const chantier = data.chantier;
    streamBudgetPdf(res, chantier, data.depenses, org, data.controle || data.resume, data.controle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportBudgetConsolidatedPDF = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const overview = await getBudgetOverview(orgId);
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    streamBudgetConsolidatedPdf(res, overview, org);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportBudgetExcelConsolidated = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const overview = await getBudgetOverview(orgId);
    const depenses = overview.items || [];

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Charges consolidées");
    sheet.columns = [
      { header: "Chantier", key: "chantier", width: 24 },
      { header: "Date", key: "date", width: 14 },
      { header: "Libellé", key: "libelle", width: 28 },
      { header: "Catégorie", key: "categorie", width: 16 },
      { header: "Quantité", key: "quantite", width: 10 },
      { header: "Unité", key: "unite", width: 10 },
      { header: "Prix unitaire", key: "prixUnitaire", width: 14 },
      { header: "Montant", key: "montant", width: 14 },
      { header: "Payé", key: "paye", width: 8 },
      { header: "Fournisseur", key: "fournisseur", width: 18 },
    ];

    depenses.forEach((d) => {
      sheet.addRow({
        chantier: d.chantierNom || d.chantier || "",
        date: d.date ? new Date(d.date).toLocaleDateString("fr-FR") : "",
        libelle: d.libelle,
        categorie: d.categorie,
        quantite: d.quantite,
        unite: d.unite,
        prixUnitaire: d.prixUnitaire,
        montant: d.montant,
        paye: d.paye ? "Oui" : "Non",
        fournisseur: d.fournisseur || "",
      });
    });
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=budget_consolide.xlsx");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportBudgetExcel = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const data = await getChantierBudget(orgId, req.params.chantierId);
    if (!data) return res.status(404).json({ error: "Chantier introuvable" });

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();

    const synth = workbook.addWorksheet("Synthèse");
    const c = data.controle || data.resume || {};
    synth.addRow(["Chantier", data.chantier?.nom || ""]);
    synth.addRow(["Budget prévisionnel", c.budget ?? c.budgetInitial ?? 0]);
    synth.addRow(["Charges réelles", c.depenses ?? c.totalDepenses ?? 0]);
    synth.addRow(["Écart", c.ecart ?? 0]);
    synth.addRow(["Encaissements", c.encaisse ?? 0]);
    synth.addRow(["Marge opérationnelle", c.margeOperationnelle ?? 0]);
    synth.getColumn(1).width = 22;
    synth.getColumn(2).width = 18;

    const sheet = workbook.addWorksheet("Charges");
    sheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Libellé", key: "libelle", width: 28 },
      { header: "Catégorie", key: "categorie", width: 16 },
      { header: "Quantité", key: "quantite", width: 10 },
      { header: "Unité", key: "unite", width: 10 },
      { header: "Prix unitaire", key: "prixUnitaire", width: 14 },
      { header: "Montant", key: "montant", width: 14 },
      { header: "Payé", key: "paye", width: 8 },
      { header: "Fournisseur", key: "fournisseur", width: 18 },
    ];

    (data.depenses || []).forEach((d) => {
      sheet.addRow({
        date: d.date ? new Date(d.date).toLocaleDateString("fr-FR") : "",
        libelle: d.libelle,
        categorie: d.categorie,
        quantite: d.quantite,
        unite: d.unite,
        prixUnitaire: d.prixUnitaire,
        montant: d.montant,
        paye: d.paye ? "Oui" : "Non",
        fournisseur: d.fournisseur || "",
      });
    });
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const slug = (data.chantier?.nom || "projet").replace(/[^\w\-]+/g, "_").slice(0, 40);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=budget_${slug}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── FACTURES ────────────────────────────────────────────

const FACTURE_PDF_INCLUDE = {
  client: true,
  chantier: true,
  devis: { select: { numero: true } },
  lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
  paiements: { orderBy: { datePaiement: "asc" } },
};

const FACTURE_DETAIL_INCLUDE = {
  client: true,
  chantier: true,
  devis: { select: { id: true, numero: true } },
  lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
  paiements: { orderBy: { datePaiement: "desc" } },
  avoirs: { orderBy: { dateEmission: "desc" } },
};

const FACTURE_TYPE_LABEL = {
  INTEGRALE: "Facture intégrale",
  ACOMPTE: "Facture d'acompte",
  SOLDE: "Facture de solde",
};

function mapFactureLigneInput(l, index, defaultTva = 18) {
  return {
    section: l.section?.trim() || "Général",
    reference: l.reference?.trim() || null,
    designation: l.designation,
    detailDescription: l.detailDescription?.trim() || null,
    quantite: Number(l.quantite) || 1,
    unite: l.unite || "u",
    prixUnitaire: Number(l.prixUnitaire) || 0,
    tva: Number(l.tva ?? defaultTva) || 0,
    ordre: index,
  };
}

function formatFacture(f) {
  return toLegacy({
    ...f,
    statut: FACTURE_STATUT_LABEL[f.statut] || f.statut,
    typeFacture: FACTURE_TYPE_LABEL[f.typeFacture] || f.typeFacture,
    typeFactureRaw: f.typeFacture,
    montant: f.montantTTC,
    client: f.client ? toLegacy(f.client) : f.clientId,
    chantier: f.chantier ? toLegacy(f.chantier) : f.chantierId,
    nbLignes: f.lignes?.length ?? 0,
    lignes: f.lignes?.map((l) => toLegacy(l)),
  });
}

function calcFactureTotals(lignes, tva = 18, remisePercent = 0, retenueGarantie = 0) {
  return computeDevisAmounts(lignes, tva, remisePercent, retenueGarantie);
}

async function buildFactureFormSuggestions(orgId, { clientId, chantierId } = {}) {
  const count = await prisma.facture.count({ where: { organizationId: orgId } });
  const nextReference = await genererNumero("FAC", count);

  const devisWhere = {
    organizationId: orgId,
    statut: { in: ["ACCEPTE", "ENVOYE"] },
  };
  if (chantierId) devisWhere.chantierId = chantierId;
  else if (clientId) devisWhere.clientId = clientId;

  const devis =
    clientId || chantierId
      ? await prisma.devis.findFirst({
          where: devisWhere,
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            numero: true,
            description: true,
            referenceInterne: true,
            remisePercent: true,
            retenueGarantie: true,
            tva: true,
          },
        })
      : null;

  return {
    numeroPreview: nextReference,
    referenceInterne: devis?.referenceInterne || nextReference,
    referenceDevis: devis?.numero || null,
    devisId: devis?.id || null,
    description: devis?.description || null,
    remisePercent: devis?.remisePercent ?? 0,
    retenueGarantie: devis?.retenueGarantie ?? 0,
    tva: devis?.tva ?? null,
    fromDevis: Boolean(devis),
  };
}

export const getFactureFormSuggestions = async (req, res) => {
  try {
    const data = await buildFactureFormSuggestions(getOrgId(req.user), {
      clientId: req.query.clientId || null,
      chantierId: req.query.chantierId || null,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFactureOverviewHandler = async (req, res) => {
  try {
    const data = await getFactureOverview(getOrgId(req.user));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFactureDetailHandler = async (req, res) => {
  try {
    const detail = await getFactureDetail(getOrgId(req.user), req.params.id);
    if (!detail) return res.status(404).json({ error: "Facture introuvable" });
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createFacture = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const {
      client,
      chantier,
      lignes = [],
      tva,
      description,
      conditions,
      referenceDevis,
      devisId,
      statut,
      dateEcheance,
      modePaiement,
      remisePercent,
      retenueGarantie,
      referenceInterne,
      typeFacture,
    } = req.body;

    const existingClient = await prisma.client.findFirst({
      where: { id: client, organizationId: orgId },
    });
    if (!existingClient) return res.status(400).json({ error: "Client non trouvé" });

    if (chantier) {
      const ch = await prisma.chantier.findFirst({ where: { id: chantier, organizationId: orgId } });
      if (!ch) return res.status(400).json({ error: "Chantier non trouvé" });
    }

    const _tva = typeof tva === "number" ? tva : 18;
    const _remise = Number(remisePercent) || 0;
    const _retenue = Number(retenueGarantie) || 0;
    const mappedLignes = lignes.filter((l) => l.designation?.trim()).map((l, i) => mapFactureLigneInput(l, i, _tva));
    if (mappedLignes.length === 0) return res.status(400).json({ error: "Ajoutez au moins une ligne de prestation" });

    const amounts = calcFactureTotals(mappedLignes, _tva, _remise, _retenue);
    const count = await prisma.facture.count({ where: { organizationId: orgId } });
    const numero = await genererNumero("FAC", count);
    const _refInterne = referenceInterne?.trim() || (await genererNumero("FAC", count));
    const _type = ["ACOMPTE", "SOLDE"].includes(typeFacture) ? typeFacture : "INTEGRALE";

    const facture = await prisma.facture.create({
      data: {
        organizationId: orgId,
        clientId: client,
        chantierId: chantier || null,
        devisId: devisId || null,
        numero,
        description,
        conditions,
        referenceDevis,
        remisePercent: _remise,
        retenueGarantie: _retenue,
        referenceInterne: _refInterne,
        typeFacture: _type,
        tva: _tva,
        montantHT: amounts.montantHT,
        montantTVA: amounts.montantTVA,
        montantTTC: amounts.montantTTC,
        statut: FACTURE_STATUT_FROM_LABEL[statut] || "BROUILLON",
        dateEcheance: dateEcheance ? new Date(dateEcheance) : undefined,
        modePaiement: modePaiement ? MODE_PAIEMENT_FROM_LABEL[modePaiement] || modePaiement : null,
        lignes: {
          create: mappedLignes,
        },
      },
      include: FACTURE_DETAIL_INCLUDE,
    });

    res.status(201).json(formatFacture(facture));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllFactures = async (req, res) => {
  try {
    const factures = await prisma.facture.findMany({
      where: { organizationId: getOrgId(req.user) },
      include: { client: true, chantier: true, lignes: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(factures.map(formatFacture));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFactureById = async (req, res) => {
  try {
    const facture = await prisma.facture.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
      include: FACTURE_DETAIL_INCLUDE,
    });
    if (!facture) return res.status(404).json({ error: "Facture introuvable" });
    res.json(formatFacture(facture));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateFacture = async (req, res) => {
  try {
    const existing = await prisma.facture.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
    });
    if (!existing) return res.status(404).json({ error: "Facture introuvable" });

    const body = pickAllowed(req.body, [
      "description",
      "conditions",
      "referenceDevis",
      "referenceInterne",
      "remisePercent",
      "retenueGarantie",
      "tva",
      "statut",
      "dateEcheance",
      "modePaiement",
      "chantierId",
      "lignes",
    ]);
    if (req.body.chantier !== undefined) body.chantierId = req.body.chantier || null;

    const structuralChange =
      body.lignes ||
      body.remisePercent !== undefined ||
      body.retenueGarantie !== undefined ||
      body.tva !== undefined;
    if (existing.verrouillee && structuralChange) {
      return res.status(400).json({ error: "Facture verrouillée — lignes et montants non modifiables." });
    }

    if (body.statut) {
      body.statut = FACTURE_STATUT_FROM_LABEL[body.statut] || body.statut;
      if (body.statut === "PAYEE" && !existing.verrouillee) {
        body.verrouillee = true;
      }
      if (body.statut === "PAYEE" && !existing.montantVerse) {
        body.datePaiement = new Date();
      }
      if (body.statut === "ENVOYEE" && existing.statut === "BROUILLON") {
        body.verrouillee = true;
      }
    }
    if (body.modePaiement) {
      body.modePaiement = MODE_PAIEMENT_FROM_LABEL[body.modePaiement] || body.modePaiement;
    }

    if (body.lignes) {
      await prisma.factureLigne.deleteMany({ where: { factureId: req.params.id } });
      const tva = body.tva ?? existing.tva ?? 18;
      const remise = body.remisePercent ?? existing.remisePercent ?? 0;
      const retenue = body.retenueGarantie ?? existing.retenueGarantie ?? 0;
      const mappedLignes = body.lignes.filter((l) => l.designation?.trim()).map((l, i) => mapFactureLigneInput(l, i, tva));
      const amounts = calcFactureTotals(mappedLignes, tva, remise, retenue);
      body.montantHT = amounts.montantHT;
      body.montantTVA = amounts.montantTVA;
      body.montantTTC = amounts.montantTTC;
      await prisma.factureLigne.createMany({
        data: mappedLignes.map((l) => ({
          factureId: req.params.id,
          ...l,
        })),
      });
      delete body.lignes;
    } else if (body.remisePercent !== undefined || body.tva !== undefined || body.retenueGarantie !== undefined) {
      const currentLignes = await prisma.factureLigne.findMany({
        where: { factureId: req.params.id },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
      });
      const amounts = calcFactureTotals(
        currentLignes,
        body.tva ?? existing.tva ?? 18,
        body.remisePercent ?? existing.remisePercent ?? 0,
        body.retenueGarantie ?? existing.retenueGarantie ?? 0
      );
      body.montantHT = amounts.montantHT;
      body.montantTVA = amounts.montantTVA;
      body.montantTTC = amounts.montantTTC;
    }

    if (body.dateEcheance) body.dateEcheance = new Date(body.dateEcheance);

    const facture = await prisma.facture.update({
      where: { id: req.params.id },
      data: body,
      include: FACTURE_DETAIL_INCLUDE,
    });
    res.json(formatFacture(facture));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteFacture = async (req, res) => {
  try {
    const existing = await prisma.facture.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
    });
    if (!existing) return res.status(404).json({ error: "Facture introuvable" });
    if (existing.verrouillee) {
      return res.status(400).json({ error: "Impossible de supprimer une facture verrouillée." });
    }

    await prisma.facture.delete({ where: { id: req.params.id } });
    res.json({ message: "Facture supprimée" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const validerFacture = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const existing = await prisma.facture.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!existing) return res.status(404).json({ error: "Facture introuvable" });
    if (existing.verrouillee) {
      return res.status(400).json({ error: "Facture déjà verrouillée." });
    }

    const facture = await prisma.facture.update({
      where: { id: req.params.id },
      data: {
        verrouillee: true,
        statut: existing.statut === "BROUILLON" ? "ENVOYEE" : existing.statut,
      },
      include: FACTURE_DETAIL_INCLUDE,
    });

    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "FACTURE_VALIDEE",
      entity: "Facture",
      entityId: facture.id,
      details: facture.numero,
    });

    res.json(formatFacture(facture));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const addFacturePaiement = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const { montant, datePaiement, modePaiement, reference, commentaire } = req.body;
    const amount = Number(montant);
    if (!amount || amount <= 0) return res.status(400).json({ error: "Montant invalide." });

    const facture = await prisma.facture.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: { lignes: true },
    });
    if (!facture) return res.status(404).json({ error: "Facture introuvable" });
    if (facture.statut === "ANNULEE") return res.status(400).json({ error: "Facture annulée." });

    const { netAPayer } = computeFactureNetAPayer(facture);
    const reste = Math.max(0, netAPayer - (facture.montantVerse || 0) - (facture.montantAvoir || 0));
    if (amount > reste + 0.01) {
      return res.status(400).json({ error: `Montant supérieur au reste dû (${Math.round(reste)} FCFA).` });
    }

    await prisma.facturePaiement.create({
      data: {
        factureId: facture.id,
        montant: amount,
        datePaiement: datePaiement ? new Date(datePaiement) : new Date(),
        modePaiement: modePaiement ? MODE_PAIEMENT_FROM_LABEL[modePaiement] || modePaiement : null,
        reference: reference?.trim() || null,
        commentaire: commentaire?.trim() || null,
      },
    });

    if (!facture.verrouillee) {
      await prisma.facture.update({ where: { id: facture.id }, data: { verrouillee: true } });
    }

    await syncFacturePaymentStatus(facture.id);
    const detail = await getFactureDetail(orgId, facture.id);
    res.status(201).json(detail);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteFacturePaiement = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const facture = await prisma.facture.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!facture) return res.status(404).json({ error: "Facture introuvable" });

    const paiement = await prisma.facturePaiement.findFirst({
      where: { id: req.params.paiementId, factureId: facture.id },
    });
    if (!paiement) return res.status(404).json({ error: "Paiement introuvable" });

    await prisma.facturePaiement.delete({ where: { id: paiement.id } });
    await syncFacturePaymentStatus(facture.id);
    const detail = await getFactureDetail(orgId, facture.id);
    res.json(detail);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createFactureAvoir = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const { motif, montantTTC, lignes = [] } = req.body;

    const facture = await prisma.facture.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: { lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] } },
    });
    if (!facture) return res.status(404).json({ error: "Facture introuvable" });
    if (facture.statut === "ANNULEE") return res.status(400).json({ error: "Facture annulée." });

    const { netAPayer } = computeFactureNetAPayer(facture);
    const reste = Math.max(0, netAPayer - (facture.montantVerse || 0) - (facture.montantAvoir || 0));
    if (reste <= 0) return res.status(400).json({ error: "Aucun montant restant à créditer." });

    let avoirLignes;
    let montantHT;
    let montantTVA;
    let montantTTCFinal;

    if (lignes.length > 0) {
      avoirLignes = lignes
        .filter((l) => l.designation?.trim())
        .map((l, i) => ({
          designation: l.designation,
          quantite: Number(l.quantite) || 1,
          prixUnitaire: Number(l.prixUnitaire) || 0,
          tva: Number(l.tva ?? facture.tva) || 18,
          ordre: i,
        }));
      if (avoirLignes.length === 0) return res.status(400).json({ error: "Ajoutez au moins une ligne d'avoir." });
      montantHT = avoirLignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
      montantTVA = avoirLignes.reduce((s, l) => s + (l.quantite * l.prixUnitaire * l.tva) / 100, 0);
      montantTTCFinal = montantHT + montantTVA;
    } else {
      const target = montantTTC ? Math.min(Number(montantTTC), reste) : reste;
      const tvaRate = facture.tva ?? 18;
      montantTTCFinal = target;
      montantHT = target / (1 + tvaRate / 100);
      montantTVA = target - montantHT;
      avoirLignes = [
        {
          designation: motif?.trim() || `Avoir sur facture ${facture.numero}`,
          quantite: 1,
          prixUnitaire: Math.round(montantHT * 100) / 100,
          tva: tvaRate,
          ordre: 0,
        },
      ];
    }

    if (montantTTCFinal > reste + 0.01) {
      return res.status(400).json({ error: `Montant avoir supérieur au reste dû (${Math.round(reste)} FCFA).` });
    }

    const count = await prisma.avoir.count({ where: { organizationId: orgId } });
    const numero = await genererNumero("AVR", count);

    const avoir = await prisma.avoir.create({
      data: {
        organizationId: orgId,
        factureId: facture.id,
        numero,
        motif: motif?.trim() || `Avoir sur facture ${facture.numero}`,
        montantHT: Math.round(montantHT * 100) / 100,
        montantTVA: Math.round(montantTVA * 100) / 100,
        montantTTC: Math.round(montantTTCFinal * 100) / 100,
        statut: "EMIS",
        lignes: { create: avoirLignes },
      },
      include: { lignes: true, facture: { select: { numero: true } } },
    });

    await syncFacturePaymentStatus(facture.id);

    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "AVOIR_CREE",
      entity: "Avoir",
      entityId: avoir.id,
      details: `${avoir.numero} → ${facture.numero}`,
    });

    const detail = await getFactureDetail(orgId, facture.id);
    res.status(201).json({ message: "Avoir émis.", avoir, facture: detail });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const exportFacturesComptable = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const { from, to } = req.query;
    const where = { organizationId: orgId };
    if (from || to) {
      where.dateEmission = {};
      if (from) where.dateEmission.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.dateEmission.lte = end;
      }
    }

    const [factures, org] = await Promise.all([
      prisma.facture.findMany({
        where,
        include: {
          client: { select: { nom: true } },
          chantier: { select: { nom: true } },
          devis: { select: { numero: true } },
          lignes: true,
        },
        orderBy: { dateEmission: "asc" },
      }),
      prisma.organization.findUnique({ where: { id: orgId } }),
    ]);

    const csv = buildFacturesComptableCsv(factures, org);
    const filename = `export_comptable_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportAvoirPDF = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const avoir = await prisma.avoir.findFirst({
      where: { id: req.params.avoirId, organizationId: orgId },
      include: {
        lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
        facture: { include: { client: true, chantier: true } },
      },
    });
    if (!avoir) return res.status(404).json({ error: "Avoir introuvable" });

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    streamAvoirPdf(res, avoir, organization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getComptaOverviewHandler = async (req, res) => {
  try {
    const data = await getComptaOverview(getOrgId(req.user), {
      year: req.query.year ? Number(req.query.year) : undefined,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportComptaJournal = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    const [org, factures, depenses] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { nom: true } }),
      prisma.facture.findMany({
        where: {
          organizationId: orgId,
          statut: { not: "ANNULEE" },
          dateEmission: { gte: start, lte: end },
        },
        include: { client: { select: { nom: true } } },
        orderBy: { dateEmission: "asc" },
      }),
      prisma.depense.findMany({
        where: { organizationId: orgId, date: { gte: start, lte: end } },
        include: { chantier: { select: { nom: true } } },
        orderBy: { date: "asc" },
      }),
    ]);

    const csv = buildComptaJournalCsv({ orgNom: org?.nom, factures, depenses });
    const filename = `journal_comptable_${year}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const initPlanComptableHandler = async (req, res) => {
  try {
    const data = await initSyscohadaPlan(getOrgId(req.user));
    res.json({ message: "Plan comptable SYSCOHADA initialisé.", ...data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getPlanComptableHandler = async (req, res) => {
  try {
    const comptes = await getPlanComptable(getOrgId(req.user));
    res.json({ norme: "SYSCOHADA révisé — OHADA / UEMOA", comptes, journaux: JOURNAL_LABELS });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const syncComptabiliteHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const year = req.body?.year || req.query?.year || new Date().getFullYear();
    const results = await syncComptabiliteSyscohada(orgId, { year });
    const syncStatus = await getSyncStatus(orgId, { year: Number(year) });
    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "COMPTA_SYNC",
      entity: "EcritureComptable",
      details: JSON.stringify(results),
    });
    res.json({
      message: "Synchronisation comptable terminée.",
      ...results,
      syncStatus,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getJournalComptableHandler = async (req, res) => {
  try {
    const data = await getJournalComptable(getOrgId(req.user), {
      year: req.query.year,
      journal: req.query.journal,
    });
    res.json({ items: data, journaux: JOURNAL_LABELS });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createEcritureHandler = async (req, res) => {
  try {
    const ecriture = await createEcritureManuelle(getOrgId(req.user), req.body);
    res.status(201).json(ecriture);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getBalanceHandler = async (req, res) => {
  try {
    const balance = await getBalanceComptable(getOrgId(req.user), { year: req.query.year });
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportBalanceHandler = async (req, res) => {
  try {
    const balance = await getBalanceComptable(getOrgId(req.user), { year: req.query.year });
    const csv = buildBalanceCsv(balance);
    const year = balance.exercice;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="balance_syscohada_${year}.csv"`);
    res.send("\uFEFF" + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getGrandLivreHandler = async (req, res) => {
  try {
    const data = await getGrandLivre(getOrgId(req.user), {
      compteId: req.query.compteId,
      compteNumero: req.query.compteNumero,
      year: req.query.year,
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const exportGrandLivreHandler = async (req, res) => {
  try {
    const data = await getGrandLivre(getOrgId(req.user), {
      compteId: req.query.compteId,
      compteNumero: req.query.compteNumero,
      year: req.query.year,
    });
    const csv = buildGrandLivreCsv(data);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="grand_livre_${data.compte.numero}_${data.exercice}.csv"`
    );
    res.send("\uFEFF" + csv);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const exportFacturePDF = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const facture = await prisma.facture.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: FACTURE_PDF_INCLUDE,
    });
    if (!facture) return res.status(404).json({ error: "Facture introuvable" });

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    streamFacturePdf(res, facture, organization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── ÉQUIPE ──────────────────────────────────────────────

export const getEquipeOverviewHandler = async (req, res) => {
  try {
    const data = await getEquipeOverview(getOrgId(req.user));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createMembre = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const data = parseMembreInput(req.body);

    if (!data.nom || !data.role) {
      return res.status(400).json({ error: "Nom et rôle requis" });
    }
    if (data.chantierId) {
      const chantier = await prisma.chantier.findFirst({
        where: { id: data.chantierId, organizationId: orgId },
      });
      if (!chantier) return res.status(403).json({ error: "Chantier non autorisé" });
    }

    const membre = await prisma.equipeMember.create({
      data: { organizationId: orgId, ...data },
      include: { chantier: { select: { id: true, nom: true, statut: true, ville: true } } },
    });

    if (membre.chantierId) {
      await syncSalaireDepense(orgId, membre.chantierId, membre.nom, membre.role, membre.salaireTotal);
    }

    res.status(201).json({ message: "Membre ajouté", membre: formatEquipe(membre) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllMembres = async (req, res) => {
  try {
    const data = await getEquipeOverview(getOrgId(req.user));
    res.json(data.items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMembreById = async (req, res) => {
  try {
    const membre = await prisma.equipeMember.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
      include: { chantier: { select: { id: true, nom: true, statut: true, ville: true } } },
    });
    if (!membre) return res.status(404).json({ error: "Membre introuvable" });
    res.json(formatEquipe(membre));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateMembre = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const existing = await prisma.equipeMember.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!existing) return res.status(404).json({ error: "Membre introuvable" });

    const data = parseMembreInput({ ...existing, ...req.body });

    const updated = await prisma.equipeMember.update({
      where: { id: req.params.id },
      data,
      include: { chantier: { select: { id: true, nom: true, statut: true, ville: true } } },
    });

    if (updated.chantierId) {
      await syncSalaireDepense(orgId, updated.chantierId, updated.nom, updated.role, updated.salaireTotal);
    }

    res.json(formatEquipe(updated));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteMembre = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const membre = await prisma.equipeMember.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!membre) return res.status(404).json({ error: "Membre introuvable" });

    await prisma.equipeMember.delete({ where: { id: req.params.id } });

    if (membre.chantierId) {
      await prisma.depense.deleteMany({
        where: {
          organizationId: orgId,
          chantierId: membre.chantierId,
          libelle: `Salaire ${membre.nom} (${membre.role})`,
        },
      });
      await syncChantierDepenses(membre.chantierId);
    }

    res.json({ message: "Membre supprimé" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const calculerSalairesMois = async (req, res) => {
  return recalculerSalairesAuto(req, res);
};

export const recalculerSalairesAuto = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const membres = await prisma.equipeMember.findMany({
      where: { organizationId: orgId, statut: "ACTIF" },
    });

    for (const m of membres) {
      const salaireTotal = computeSalaireTotal(m);
      await prisma.equipeMember.update({
        where: { id: m.id },
        data: { salaireTotal },
      });
      if (m.chantierId) {
        await syncSalaireDepense(orgId, m.chantierId, m.nom, m.role, salaireTotal);
      }
    }

    res.json({ message: `${membres.length} salaire(s) recalculé(s)` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const analyseMasseSalariale = async (req, res) => {
  try {
    const data = await buildAnalyseMasseSalariale(getOrgId(req.user), req.params.chantierId);
    if (!data) return res.status(404).json({ error: "Chantier introuvable" });
    if (data.empty) {
      return res.status(404).json({ error: "Aucun membre actif sur ce chantier" });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportMasseSalarialePDF = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const [organization, exportData] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      getMembresForExport(orgId, req.params.chantierId),
    ]);
    if (!exportData) return res.status(404).json({ error: "Chantier introuvable" });
    if (!exportData.membres.length) {
      return res.status(404).json({ error: "Aucune donnée à exporter" });
    }
    streamEquipePdf(res, exportData.chantier, exportData.membres, organization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportMasseSalarialeExcel = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { devise: true, nom: true },
    });
    const exportData = await getMembresForExport(orgId, req.params.chantierId);
    if (!exportData) return res.status(404).json({ error: "Chantier introuvable" });
    if (!exportData.membres.length) {
      return res.status(404).json({ error: "Aucune donnée à exporter" });
    }

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Masse salariale");
    sheet.columns = [
      { header: "Nom", key: "nom", width: 24 },
      { header: "Rôle", key: "role", width: 18 },
      { header: "Contrat", key: "typeContrat", width: 14 },
      { header: "Heures/mois", key: "heuresMensuelles", width: 12 },
      { header: "Taux horaire", key: "tauxHoraire", width: 14 },
      { header: "Prime", key: "prime", width: 10 },
      { header: "Bonus", key: "bonus", width: 10 },
      { header: "Retenue", key: "retenue", width: 10 },
      { header: "Salaire total", key: "salaireTotal", width: 14 },
    ];

    exportData.membres.forEach((m) => sheet.addRow(m));
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const slug = (exportData.chantier.nom || "chantier").replace(/[^\w\-]+/g, "_").slice(0, 40);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=masse_salariale_${slug}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── STOCK ───────────────────────────────────────────────

export const getStockOverviewHandler = async (req, res) => {
  try {
    const data = await getStockOverview(getOrgId(req.user), req.query.chantier || null, req.user);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createArticle = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const data = parseStockInput(req.body);
    if (!data.nom) return res.status(400).json({ error: "Nom requis" });
    if (!data.chantierId) return res.status(400).json({ error: "Chantier requis" });

    const chantier = await prisma.chantier.findFirst({
      where: { id: data.chantierId, organizationId: orgId },
    });
    if (!chantier) return res.status(403).json({ error: "Chantier non autorisé" });

    const item = await prisma.stockArticle.create({
      data: { organizationId: orgId, ...data },
      include: { chantier: { select: { id: true, nom: true, statut: true } }, mouvements: true },
    });

    if (req.body.liaisonBudget && articleValeur(item) > 0) {
      await syncStockDepense(orgId, item.chantierId, item.nom, articleValeur(item));
    }

    res.status(201).json({ message: "Article créé", item: formatStock(item) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const listArticles = async (req, res) => {
  try {
    const data = await getStockOverview(getOrgId(req.user), req.query.chantier || null, req.user);
    let items = data.items;
    if (req.query.etat) {
      const e = req.query.etat;
      items = items.filter((i) => i.etat === e || i.etat?.toUpperCase() === e.toUpperCase());
    }
    if (req.query.q) {
      const q = req.query.q.toLowerCase();
      items = items.filter(
        (i) =>
          i.nom?.toLowerCase().includes(q) ||
          i.reference?.toLowerCase().includes(q) ||
          i.categorie?.toLowerCase().includes(q)
      );
    }
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getArticle = async (req, res) => {
  try {
    const item = await prisma.stockArticle.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
      include: {
        chantier: { select: { id: true, nom: true, statut: true } },
        mouvements: { orderBy: { date: "desc" }, take: 30 },
      },
    });
    if (!item) return res.status(404).json({ error: "Article introuvable" });
    res.json(formatStock(item));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateArticle = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const existing = await prisma.stockArticle.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!existing) return res.status(404).json({ error: "Article introuvable" });

    const data = parseStockInput({ ...existing, ...req.body });
    delete data.chantierId;

    const updated = await prisma.stockArticle.update({
      where: { id: req.params.id },
      data: {
        nom: data.nom,
        categorie: data.categorie,
        reference: data.reference,
        unite: data.unite,
        quantiteActuelle: data.quantiteActuelle,
        seuilAlerte: data.seuilAlerte,
        prixUnitaire: data.prixUnitaire,
        etat: data.etat,
      },
      include: { chantier: { select: { id: true, nom: true, statut: true } }, mouvements: true },
    });

    if (req.body.liaisonBudget && updated.chantierId) {
      await syncStockDepense(orgId, updated.chantierId, updated.nom, articleValeur(updated));
    }

    res.json({ message: "Article mis à jour", item: formatStock(updated) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteArticle = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const item = await prisma.stockArticle.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!item) return res.status(404).json({ error: "Article introuvable" });

    await prisma.stockArticle.delete({ where: { id: req.params.id } });

    if (item.chantierId) {
      await prisma.depense.deleteMany({
        where: { organizationId: orgId, chantierId: item.chantierId, libelle: `Stock — ${item.nom}` },
      });
      await syncChantierDepenses(item.chantierId);
    }

    res.json({ message: "Article supprimé" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const enregistrerMouvement = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const { type, quantite, commentaire } = req.body;
    const qte = Number(quantite);
    if (!qte || qte <= 0) return res.status(400).json({ error: "Quantité invalide" });

    const article = await prisma.stockArticle.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!article) return res.status(404).json({ error: "Article introuvable" });

    const isEntree = type === "Entrée" || type === "ENTREE";
    const delta = isEntree ? qte : -qte;
    const newQty = Math.max(0, article.quantiteActuelle + delta);
    const etat = recalcStockEtat(newQty, article.seuilAlerte);

    await prisma.stockMouvement.create({
      data: {
        articleId: article.id,
        type: isEntree ? "ENTREE" : "SORTIE",
        quantite: qte,
        commentaire: commentaire?.trim() || null,
      },
    });

    const updated = await prisma.stockArticle.update({
      where: { id: article.id },
      data: { quantiteActuelle: newQty, etat },
      include: { chantier: { select: { id: true, nom: true, statut: true } }, mouvements: true },
    });

    res.json({ message: "Mouvement enregistré", item: formatStock(updated) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const analyseStockChantier = async (req, res) => {
  try {
    const data = await buildStockAnalyse(getOrgId(req.user), req.params.chantierId);
    if (!data) return res.status(404).json({ error: "Chantier introuvable" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listeAlertes = async (req, res) => {
  try {
    const data = await getStockOverview(getOrgId(req.user), req.query.chantier || null, req.user);
    res.json(data.alertes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportStockPdf = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    const exportData = await getArticlesForExport(orgId, req.params.chantierId);
    if (!exportData) return res.status(404).json({ error: "Chantier introuvable" });
    if (!exportData.items.length) return res.status(404).json({ error: "Aucun article à exporter" });
    streamStockPdf(res, exportData.chantier, exportData.items, organization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportStockExcel = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const exportData = await getArticlesForExport(orgId, req.params.chantierId);
    if (!exportData) return res.status(404).json({ error: "Chantier introuvable" });
    if (!exportData.items.length) return res.status(404).json({ error: "Aucun article à exporter" });

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Stock");
    sheet.columns = [
      { header: "Nom", key: "nom", width: 28 },
      { header: "Catégorie", key: "categorie", width: 14 },
      { header: "Référence", key: "reference", width: 16 },
      { header: "Unité", key: "unite", width: 10 },
      { header: "Quantité", key: "quantiteActuelle", width: 12 },
      { header: "Seuil alerte", key: "seuilAlerte", width: 12 },
      { header: "Prix unitaire", key: "prixUnitaire", width: 14 },
      { header: "Valeur totale", key: "valeurTotale", width: 14 },
      { header: "État", key: "etat", width: 10 },
    ];
    exportData.items.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const slug = (exportData.chantier.nom || "chantier").replace(/[^\w\-]+/g, "_").slice(0, 40);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=stock_${slug}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── TERRAIN (Chef de chantier) ──────────────────────────

export const getTerrainStorageInfo = async (_req, res) => {
  const { getStorageInfo } = await import("../utils/fileStorage.js");
  res.json(getStorageInfo());
};

export const uploadRapportPhoto = async (req, res) => {
  try {
    const chantierId = req.body.chantierId;
    if (!chantierId) return res.status(400).json({ error: "chantierId requis" });
    if (!req.file) return res.status(400).json({ error: "Fichier requis" });

    const orgId = getOrgId(req.user);
    const chantier = await prisma.chantier.findFirst({
      where: { id: chantierId, organizationId: orgId },
      select: { nom: true, organization: { select: { nom: true } } },
    });
    if (!chantier) return res.status(404).json({ error: "Chantier introuvable" });

    const { storeChantierFile } = await import("../utils/fileStorage.js");
    const { parseWatermarkMeta } = await import("../utils/mediaWatermark.js");
    const alreadyWatermarked = req.body.watermarked === "1" || req.body.watermarked === true;
    const watermark = req.file.mimetype?.startsWith("image/")
      ? {
          ...parseWatermarkMeta(req.body, {
            chantierNom: chantier.nom,
            orgNom: chantier.organization?.nom,
          }),
          skip: alreadyWatermarked,
        }
      : null;

    const stored = await storeChantierFile(req.file, { organizationId: orgId, chantierId, watermark });
    res.json({ url: stored.url, storage: stored.storage });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createRapportJournalier = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const chantierId = req.body.chantierId;
    if (!chantierId) return res.status(400).json({ error: "Chantier requis" });

    const chantier = await prisma.chantier.findFirst({
      where: { id: chantierId, organizationId: orgId },
    });
    if (!chantier) return res.status(404).json({ error: "Chantier introuvable" });

    const rapport = await prisma.rapportJournalier.create({
      data: {
        organizationId: orgId,
        chantierId,
        auteurId: getUserId(req.user),
        ouvriersPresents: Number(req.body.ouvriersPresents) || 0,
        ouvriersAbsents: Number(req.body.ouvriersAbsents) || 0,
        avancement: Number(req.body.avancement) || 0,
        travauxRealises: req.body.travauxRealises?.trim() || null,
        incidents: req.body.incidents?.trim() || null,
        meteo: req.body.meteo?.trim() || null,
        notes: req.body.notes?.trim() || null,
        photos: Array.isArray(req.body.photos) ? req.body.photos : [],
      },
      include: {
        auteur: { select: { nom: true, prenom: true } },
        chantier: { select: { nom: true } },
      },
    });

    const avancement = Number(req.body.avancement);
    if (avancement > 0) {
      await prisma.chantier.update({
        where: { id: chantierId },
        data: { avancementPhysique: Math.min(100, avancement) },
      });
    }

    res.status(201).json(toLegacy(rapport));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getRapports = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const where = { organizationId: orgId };

    if (req.query.chantierId) {
      const { findAccessibleChantier } = await import("../utils/accessControl.js");
      const ok = await findAccessibleChantier(prisma, req.user, req.query.chantierId);
      if (!ok) return res.status(403).json({ error: "Accès refusé à ce chantier." });
      where.chantierId = req.query.chantierId;
    } else {
      const { getAccessibleChantierIds, isManagement } = await import("../utils/accessControl.js");
      if (!isManagement(req.user)) {
        const ids = await getAccessibleChantierIds(prisma, req.user);
        where.chantierId = { in: ids };
      }
    }

    const rapports = await prisma.rapportJournalier.findMany({
      where,
      include: { auteur: { select: { nom: true, prenom: true } }, chantier: { select: { nom: true } } },
      orderBy: { date: "desc" },
      take: 50,
    });
    res.json(rapports.map(toLegacy));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createDemandeMateriel = async (req, res) => {
  try {
    const demande = await prisma.demandeMateriel.create({
      data: {
        organizationId: getOrgId(req.user),
        chantierId: req.body.chantierId,
        demandeurId: getUserId(req.user),
        designation: req.body.designation,
        quantite: req.body.quantite,
        unite: req.body.unite || "unité",
        urgence: req.body.urgence || "MOYENNE",
        commentaire: req.body.commentaire,
      },
      include: { chantier: { select: { nom: true } } },
    });
    res.status(201).json(toLegacy(demande));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getDemandesMateriel = async (req, res) => {
  try {
    const where = { organizationId: getOrgId(req.user) };
    if (req.query.statut) where.statut = req.query.statut;

    const demandes = await prisma.demandeMateriel.findMany({
      where,
      include: {
        chantier: { select: { nom: true } },
        demandeur: { select: { nom: true, prenom: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(demandes.map(toLegacy));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateDemandeMateriel = async (req, res) => {
  try {
    const demande = await prisma.demandeMateriel.updateMany({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
      data: { statut: req.body.statut },
    });
    if (!demande.count) return res.status(404).json({ error: "Demande introuvable" });
    const updated = await prisma.demandeMateriel.findUnique({ where: { id: req.params.id } });
    res.json(toLegacy(updated));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Re-export dashboard — routes pointent vers erpController directement

export const convertDevisToFacture = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const rawType = String(req.body?.type || "integrale").toLowerCase();
    const invoiceType =
      rawType === "acompte" ? "ACOMPTE" : rawType === "solde" ? "SOLDE" : "INTEGRALE";

    const devis = await prisma.devis.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: { lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] }, client: true },
    });
    if (!devis) return res.status(404).json({ error: "Devis introuvable" });

    const existingSameType = await prisma.facture.findFirst({
      where: { devisId: devis.id, organizationId: orgId, typeFacture: invoiceType },
    });
    if (existingSameType) {
      const labels = { ACOMPTE: "acompte", SOLDE: "de solde", INTEGRALE: "intégrale" };
      return res.status(400).json({
        error: `Une facture ${labels[invoiceType] || "intégrale"} existe déjà pour ce devis.`,
        factureId: existingSameType.id,
      });
    }

    if (invoiceType === "SOLDE") {
      const acompteFacture = await prisma.facture.findFirst({
        where: { devisId: devis.id, organizationId: orgId, typeFacture: "ACOMPTE" },
      });
      if (!acompteFacture) {
        return res.status(400).json({ error: "Créez d'abord une facture d'acompte pour ce devis." });
      }
    }

    const count = await prisma.facture.count({ where: { organizationId: orgId } });
    const numero = await genererNumero("FAC", count);
    const echeance = new Date();
    echeance.setDate(echeance.getDate() + 30);

    let lignesCreate;
    let description = devis.description || `Facture issue du devis ${devis.numero}`;
    let amounts;
    let acompteDeduit = 0;

    if (invoiceType === "ACOMPTE") {
      amounts = calcFactureTotals(devis.lignes, devis.tva, devis.remisePercent, devis.retenueGarantie);
      const pct = devis.acomptePercent ?? 30;
      const acompteTTC = (amounts.netAPayer * pct) / 100;
      const tvaRate = devis.tva ?? 18;
      const acompteHT = acompteTTC / (1 + tvaRate / 100);
      description = `Acompte ${pct}% — devis ${devis.numero}${devis.description ? ` — ${devis.description}` : ""}`;
      lignesCreate = [
        {
          section: "Acompte",
          reference: `AC-${devis.numero}`,
          designation: `Acompte à la commande (${pct}%) sur devis ${devis.numero}`,
          detailDescription: devis.description || null,
          quantite: 1,
          unite: "forfait",
          prixUnitaire: Math.round(acompteHT * 100) / 100,
          tva: tvaRate,
          ordre: 0,
        },
      ];
      amounts = calcFactureTotals(lignesCreate, tvaRate, 0, 0);
    } else if (invoiceType === "SOLDE") {
      const acompteFacture = await prisma.facture.findFirst({
        where: { devisId: devis.id, organizationId: orgId, typeFacture: "ACOMPTE" },
        include: { lignes: true },
      });
      const acompteAmounts = calcFactureTotals(
        acompteFacture.lignes,
        acompteFacture.tva,
        acompteFacture.remisePercent,
        acompteFacture.retenueGarantie
      );
      acompteDeduit = acompteAmounts.netAPayer || acompteFacture.montantTTC;

      lignesCreate = devis.lignes
        .filter((l) => !l.isOption)
        .map((l, i) => ({
          section: l.section || "Général",
          reference: l.reference,
          designation: l.designation,
          detailDescription: l.detailDescription,
          quantite: l.quantite,
          unite: l.unite || "u",
          prixUnitaire: l.prixUnitaire,
          tva: l.tva ?? devis.tva ?? 18,
          ordre: l.ordre ?? i,
        }));

      amounts = calcFactureTotals(lignesCreate, devis.tva, devis.remisePercent, devis.retenueGarantie);
      description = `Facture de solde — devis ${devis.numero}${devis.description ? ` — ${devis.description}` : ""}`;
    } else {
      lignesCreate = devis.lignes
        .filter((l) => !l.isOption)
        .map((l, i) => ({
          section: l.section || "Général",
          reference: l.reference,
          designation: l.designation,
          detailDescription: l.detailDescription,
          quantite: l.quantite,
          unite: l.unite || "u",
          prixUnitaire: l.prixUnitaire,
          tva: l.tva ?? devis.tva ?? 18,
          ordre: l.ordre ?? i,
        }));
      amounts = calcFactureTotals(lignesCreate, devis.tva, devis.remisePercent, devis.retenueGarantie);
    }

    const netSolde = Math.max(0, amounts.netAPayer - acompteDeduit);

    const facture = await prisma.facture.create({
      data: {
        organizationId: orgId,
        clientId: devis.clientId,
        chantierId: devis.chantierId,
        devisId: devis.id,
        numero,
        description,
        conditions: devis.conditions,
        referenceDevis: devis.numero,
        referenceInterne: devis.referenceInterne,
        remisePercent: invoiceType === "ACOMPTE" ? 0 : devis.remisePercent ?? 0,
        retenueGarantie: invoiceType === "ACOMPTE" ? 0 : devis.retenueGarantie ?? 0,
        typeFacture: invoiceType,
        acompteDeduit,
        tva: devis.tva,
        montantHT: amounts.montantHT,
        montantTVA: amounts.montantTVA,
        montantTTC: amounts.montantTTC,
        statut: "ENVOYEE",
        verrouillee: true,
        dateEcheance: echeance,
        lignes: { create: lignesCreate },
      },
      include: FACTURE_DETAIL_INCLUDE,
    });

    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "DEVIS_TO_FACTURE",
      entity: "Facture",
      entityId: facture.id,
      details: `${devis.numero} → ${facture.numero} (${invoiceType})`,
    });

    const messages = {
      ACOMPTE: "Facture d'acompte créée.",
      SOLDE: `Facture de solde créée (net ${Math.round(netSolde)} FCFA après déduction acompte).`,
      INTEGRALE: "Facture créée depuis le devis.",
    };

    res.status(201).json({
      message: messages[invoiceType],
      facture: formatFacture(facture),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const relancerFacturesImpayees = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const factures = await prisma.facture.findMany({
      where: { organizationId: orgId, statut: { in: ["ENVOYEE", "IMPAYEE"] } },
      include: { client: true },
    });

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    const results = [];
    for (const f of factures) {
      if (!f.client?.email) {
        results.push({ id: f.id, numero: f.numero, status: "skipped", reason: "Pas d'email client" });
        continue;
      }

      const full = await prisma.facture.findFirst({
        where: { id: f.id },
        include: { client: true, chantier: true, lignes: true },
      });

      const pdfBuffer = await bufferFacturePdf(full, organization);
      const mail = await sendDocumentEmail({
        to: f.client.email,
        subject: `Relance — facture ${f.numero} — ${organization?.nom || "BTP IA"}`,
        docType: "Facture",
        docNumber: f.numero,
        clientName: f.client.nom,
        organizationName: organization?.nom,
        amountLabel: fmtMoney(f.montantTTC, organization?.devise),
        extraLines: [
          "Relance : cette facture reste impayée.",
          f.dateEcheance
            ? `Échéance : ${new Date(f.dateEcheance).toLocaleDateString("fr-FR")}`
            : "",
        ].filter(Boolean),
        attachment: {
          filename: `facture_${f.numero}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      });

      if (!mail.sent) {
        results.push({
          id: f.id,
          numero: f.numero,
          status: "failed",
          reason: mail.error || "Email non envoyé",
        });
        continue;
      }

      await prisma.facture.update({
        where: { id: f.id },
        data: {
          statut: "IMPAYEE",
          dateDerniereRelance: new Date(),
          nombreRelances: { increment: 1 },
        },
      });

      results.push({ id: f.id, numero: f.numero, status: "sent", email: f.client.email });
    }

    await logAudit({
      organizationId: orgId,
      userId: getUserId(req.user),
      action: "RELANCE_FACTURES",
      entity: "Facture",
      details: `${results.filter((r) => r.status === "sent").length} relance(s)`,
    });

    res.json({ message: "Relances traitées.", results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
