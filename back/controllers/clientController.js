import prisma from "../config/prisma.js";
import { getOrgId, getUserId } from "../utils/legacyMap.js";
import {
  CLIENT_RELATION_FROM_LABEL,
  CLIENT_RELATION_LABEL,
  CLIENT_TYPE_FROM_LABEL,
  CLIENT_TYPE_LABEL,
  toLegacy,
} from "../utils/legacyMap.js";
import {
  formatClientList,
  getClientsOverview,
  getClientDetail,
} from "../services/clientService.js";
import { pickAllowed } from "../utils/pickFields.js";

function formatClient(c) {
  return formatClientList(c);
}

export const getClientsOverviewHandler = async (req, res) => {
  try {
    const data = await getClientsOverview(getOrgId(req.user));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getClientDetailHandler = async (req, res) => {
  try {
    const detail = await getClientDetail(getOrgId(req.user), req.params.id);
    if (!detail) return res.status(404).json({ error: "Client introuvable" });
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createClient = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const body = req.body;

    const client = await prisma.client.create({
      data: {
        organizationId: orgId,
        ownerId: getUserId(req.user),
        nom: body.nom,
        email: body.email,
        telephone: body.telephone,
        adresse: body.adresse,
        pays: body.pays || "Côte d'Ivoire",
        type: CLIENT_TYPE_FROM_LABEL[body.type] || "PARTICULIER",
        statutRelation: CLIENT_RELATION_FROM_LABEL[body.statutRelation] || "PROSPECT",
        secteurActivite: body.secteurActivite,
        notes: body.notes,
      },
    });
    res.status(201).json(formatClient(client));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllClients = async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      where: { organizationId: getOrgId(req.user) },
      orderBy: { createdAt: "desc" },
    });
    res.json(clients.map(formatClient));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const searchClients = async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.status(400).json({ error: "Paramètre de recherche manquant" });

    const clients = await prisma.client.findMany({
      where: {
        organizationId: getOrgId(req.user),
        OR: [
          { nom: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { telephone: { contains: q } },
          { pays: { contains: q, mode: "insensitive" } },
        ],
      },
    });
    res.json(clients.map(formatClient));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getClientById = async (req, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
    });
    if (!client) return res.status(404).json({ error: "Client introuvable" });
    res.json(formatClient(client));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateClient = async (req, res) => {
  try {
    const data = pickAllowed(req.body, [
      "nom",
      "email",
      "telephone",
      "adresse",
      "pays",
      "type",
      "statutRelation",
      "secteurActivite",
      "notes",
    ]);
    if (data.type) data.type = CLIENT_TYPE_FROM_LABEL[data.type] || data.type;
    if (data.statutRelation) {
      data.statutRelation = CLIENT_RELATION_FROM_LABEL[data.statutRelation] || data.statutRelation;
    }

    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
    });
    if (!existing) return res.status(404).json({ error: "Client introuvable" });

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data,
    });
    res.json(formatClient(client));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, organizationId: getOrgId(req.user) },
    });
    if (!existing) return res.status(404).json({ error: "Client introuvable" });

    await prisma.client.delete({ where: { id: req.params.id } });
    res.json({ message: "Client supprimé" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
