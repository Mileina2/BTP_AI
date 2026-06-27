import prisma from "../config/prisma.js";
import ExcelJS from "exceljs";
import {
  CHANTIER_STATUT_FROM_LABEL,
  CHANTIER_STATUT_LABEL,
  TYPE_TRAVAUX_FROM_LABEL,
  getOrgId,
  getUserId,
} from "../utils/legacyMap.js";
import {
  formatChantierList,
  getChantiersOverview,
  getChantierDetail,
} from "../services/chantierService.js";
import { pickAllowed } from "../utils/pickFields.js";
import { chantierScopeWhere } from "../utils/accessControl.js";
import {
  assertChantierAccess,
  listTimeline,
  addTimelineComment,
  deleteTimelineEntry,
  listDocuments,
  createDocument,
  removeDocument,
} from "../services/chantierTimelineService.js";

function formatChantier(c) {
  return formatChantierList(c);
}

function parseStatut(statut) {
  if (!statut) return undefined;
  return CHANTIER_STATUT_FROM_LABEL[statut] || statut;
}

export const createChantier = async (req, res) => {
  try {
    const body = req.body;
    const orgId = getOrgId(req.user);

    let clientId = body.clientId;
    if (!clientId && body.client) {
      const found = await prisma.client.findFirst({
        where: { organizationId: orgId, nom: body.client },
      });
      clientId = found?.id;
    }
    if (!clientId) {
      return res.status(400).json({ error: "Sélectionnez un client existant" });
    }

    const chantier = await prisma.chantier.create({
      data: {
        organizationId: orgId,
        ownerId: getUserId(req.user),
        clientId,
        nom: body.nom,
        description: body.description,
        adresse: body.adresse,
        ville: body.ville,
        pays: body.pays || "Côte d'Ivoire",
        zone: body.zone,
        typeTravaux: TYPE_TRAVAUX_FROM_LABEL[body.typeTravaux] || "CONSTRUCTION",
        budget: Number(body.budget) || 0,
        depenses: Number(body.depenses) || 0,
        chefDeChantierId: body.chefDeChantierId,
        statut: parseStatut(body.statut) || "EN_PREPARATION",
        dateDebut: body.dateDebut ? new Date(body.dateDebut) : undefined,
        dateFin: body.dateFin ? new Date(body.dateFin) : undefined,
      },
      include: { client: { select: { nom: true } } },
    });

    res.status(201).json(formatChantier(chantier));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getChantiersOverviewHandler = async (req, res) => {
  try {
    const data = await getChantiersOverview(req.user);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getChantierDetailHandler = async (req, res) => {
  try {
    const detail = await getChantierDetail(req.user, req.params.id);
    if (!detail) return res.status(404).json({ error: "Chantier introuvable" });
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllChantiers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const statut = parseStatut(req.query.statut);

    const where = { ...chantierScopeWhere(req.user) };
    if (statut) where.statut = statut;

    const [items, total] = await Promise.all([
      prisma.chantier.findMany({
        where,
        include: {
          client: { select: { nom: true, id: true } },
          _count: {
            select: { devis: true, factures: true, depenseItems: true, equipes: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chantier.count({ where }),
    ]);

    res.json({
      items: items.map(formatChantier),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getChantierById = async (req, res) => {
  try {
    const chantier = await prisma.chantier.findFirst({
      where: { id: req.params.id, ...chantierScopeWhere(req.user) },
      include: { client: true },
    });
    if (!chantier) return res.status(404).json({ error: "Chantier introuvable" });
    res.json(formatChantier(chantier));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateChantier = async (req, res) => {
  try {
    const existing = await prisma.chantier.findFirst({
      where: { id: req.params.id, ...chantierScopeWhere(req.user) },
    });
    if (!existing) return res.status(404).json({ error: "Chantier introuvable" });

    const body = pickAllowed(req.body, [
      "nom",
      "description",
      "adresse",
      "ville",
      "pays",
      "zone",
      "typeTravaux",
      "budget",
      "depenses",
      "chefDeChantierId",
      "clientId",
      "statut",
      "dateDebut",
      "dateFin",
      "avancementPhysique",
      "avancementFinancier",
    ]);
    if (body.statut) body.statut = parseStatut(body.statut);
    if (body.typeTravaux) body.typeTravaux = TYPE_TRAVAUX_FROM_LABEL[body.typeTravaux] || body.typeTravaux;
    if (body.budget !== undefined) body.budget = Number(body.budget);
    if (body.depenses !== undefined) body.depenses = Number(body.depenses);
    if (body.dateDebut) body.dateDebut = new Date(body.dateDebut);
    if (body.dateFin) body.dateFin = new Date(body.dateFin);

    const chantier = await prisma.chantier.update({
      where: { id: req.params.id },
      data: body,
      include: { client: { select: { nom: true } } },
    });
    res.json(formatChantier(chantier));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateIndicateurs = async (req, res) => {
  try {
    const { avancementPhysique, avancementFinancier } = req.body;
    const chantier = await prisma.chantier.updateMany({
      where: { id: req.params.id, ...chantierScopeWhere(req.user) },
      data: { avancementPhysique, avancementFinancier },
    });
    if (!chantier.count) return res.status(404).json({ error: "Chantier introuvable" });

    const updated = await prisma.chantier.findUnique({
      where: { id: req.params.id },
      include: { client: { select: { nom: true } } },
    });
    res.json(formatChantier(updated));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteChantier = async (req, res) => {
  try {
    const existing = await prisma.chantier.findFirst({
      where: { id: req.params.id, ...chantierScopeWhere(req.user) },
    });
    if (!existing) return res.status(404).json({ error: "Chantier introuvable" });

    await prisma.chantier.delete({ where: { id: req.params.id } });
    res.json({ message: "Chantier supprimé" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const searchChantiers = async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.status(400).json({ error: "Paramètre de recherche manquant" });

    const chantiers = await prisma.chantier.findMany({
      where: {
        ...chantierScopeWhere(req.user),
        OR: [
          { nom: { contains: q, mode: "insensitive" } },
          { ville: { contains: q, mode: "insensitive" } },
          { adresse: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { client: { select: { nom: true } } },
    });
    res.json({ items: chantiers.map(formatChantier) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTimeline = async (req, res) => {
  try {
    const chantier = await assertChantierAccess(req.user, req.params.id);
    if (!chantier) return res.status(404).json({ error: "Chantier introuvable" });
    const items = await listTimeline(req.user, req.params.id);
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addCommentaire = async (req, res) => {
  try {
    const chantier = await assertChantierAccess(req.user, req.params.id);
    if (!chantier) return res.status(404).json({ error: "Chantier introuvable" });

    const texte = req.body.texte || req.body.description || req.body.commentaire;
    if (!texte?.trim()) return res.status(400).json({ error: "Texte du commentaire requis" });

    const entry = await addTimelineComment(req.user, req.params.id, getUserId(req.user), {
      texte,
      titre: req.body.titre,
      visibleClient: req.body.visibleClient,
    });
    res.status(201).json({ message: "Commentaire ajouté", entry });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteCommentaire = async (req, res) => {
  try {
    const ok = await deleteTimelineEntry(req.user, req.params.id, req.params.entryId);
    if (!ok) return res.status(404).json({ error: "Entrée introuvable" });
    res.json({ message: "Commentaire supprimé" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const chantier = await assertChantierAccess(req.user, req.params.id);
    if (!chantier) return res.status(404).json({ error: "Chantier introuvable" });
    const items = await listDocuments(req.user, req.params.id);
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addDocument = async (req, res) => {
  try {
    const chantier = await assertChantierAccess(req.user, req.params.id);
    if (!chantier) return res.status(404).json({ error: "Chantier introuvable" });
    if (!req.file) return res.status(400).json({ error: "Fichier requis (champ « file »)" });

    const doc = await createDocument(req.user, req.params.id, getUserId(req.user), req.file, req.body.nom, req.body);
    res.status(201).json({ message: "Document enregistré", document: doc });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const ok = await removeDocument(req.user, req.params.id, req.params.docId);
    if (!ok) return res.status(404).json({ error: "Document introuvable" });
    res.json({ message: "Document supprimé" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportChantiersExcel = async (req, res) => {
  try {
    const chantiers = await prisma.chantier.findMany({
      where: chantierScopeWhere(req.user),
      include: { client: { select: { nom: true } } },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Chantiers");
    sheet.columns = [
      { header: "Nom", key: "nom", width: 30 },
      { header: "Client", key: "client", width: 25 },
      { header: "Budget", key: "budget", width: 15 },
      { header: "Dépenses", key: "depenses", width: 15 },
      { header: "Statut", key: "statut", width: 15 },
    ];

    chantiers.forEach((c) => {
      sheet.addRow({
        nom: c.nom,
        client: c.client?.nom,
        budget: c.budget,
        depenses: c.depenses,
        statut: CHANTIER_STATUT_LABEL[c.statut],
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=chantiers.xlsx");
    await workbook.xlsx.write(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
