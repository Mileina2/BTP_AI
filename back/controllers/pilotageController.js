import { getOrgId } from "../utils/legacyMap.js";
import prisma from "../config/prisma.js";
import { getTresorerieOverview, buildTresorerieCsv } from "../services/tresorerieService.js";
import { streamTresoreriePdf } from "../utils/tresoreriePdf.js";
import {
  getFournisseursOverview,
  createFournisseur,
  updateFournisseur,
  deleteFournisseur,
  createEngagement,
  updateEngagement,
  compareEngagements,
  linkDepenseFournisseur,
  markDepensePayee,
  buildFournisseurCsv,
} from "../services/fournisseurService.js";
import {
  getConformiteOverview,
  createEcheance,
  updateEcheance,
  deleteEcheance,
  markEcheanceDone,
  buildConformiteCsv,
} from "../services/conformiteService.js";

export const getTresorerieOverviewHandler = async (req, res) => {
  try {
    const data = await getTresorerieOverview(getOrgId(req.user));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportTresorerieCsvHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const data = await getTresorerieOverview(orgId);
    const csv = buildTresorerieCsv(data);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=tresorerie_${stamp}.csv`);
    res.send(`\ufeff${csv}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportTresoreriePdfHandler = async (req, res) => {
  try {
    const orgId = getOrgId(req.user);
    const [organization, data] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      getTresorerieOverview(orgId),
    ]);
    streamTresoreriePdf(res, data, organization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFournisseursOverviewHandler = async (req, res) => {
  try {
    const data = await getFournisseursOverview(getOrgId(req.user));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createFournisseurHandler = async (req, res) => {
  try {
    const f = await createFournisseur(getOrgId(req.user), req.body);
    res.status(201).json(f);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateFournisseurHandler = async (req, res) => {
  try {
    const f = await updateFournisseur(getOrgId(req.user), req.params.id, req.body);
    res.json(f);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteFournisseurHandler = async (req, res) => {
  try {
    await deleteFournisseur(getOrgId(req.user), req.params.id);
    res.json({ message: "Fournisseur supprimé." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createEngagementHandler = async (req, res) => {
  try {
    const e = await createEngagement(getOrgId(req.user), req.body);
    res.status(201).json(e);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateEngagementHandler = async (req, res) => {
  try {
    const e = await updateEngagement(getOrgId(req.user), req.params.id, req.body);
    res.json(e);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const compareEngagementsHandler = async (req, res) => {
  try {
    const data = await compareEngagements(getOrgId(req.user), { objet: req.query.objet });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const linkDepenseFournisseurHandler = async (req, res) => {
  try {
    const depense = await linkDepenseFournisseur(getOrgId(req.user), req.params.id, req.body.fournisseurId);
    res.json(depense);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const markDepensePayeeHandler = async (req, res) => {
  try {
    const depense = await markDepensePayee(getOrgId(req.user), req.params.id);
    res.json(depense);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const exportFournisseurCsvHandler = async (req, res) => {
  try {
    const data = await getFournisseursOverview(getOrgId(req.user));
    const csv = buildFournisseurCsv(data);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=fournisseurs_${stamp}.csv`);
    res.send(`\ufeff${csv}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getConformiteOverviewHandler = async (req, res) => {
  try {
    const data = await getConformiteOverview(getOrgId(req.user));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createEcheanceHandler = async (req, res) => {
  try {
    const e = await createEcheance(getOrgId(req.user), req.body);
    res.status(201).json(e);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateEcheanceHandler = async (req, res) => {
  try {
    const e = await updateEcheance(getOrgId(req.user), req.params.id, req.body);
    res.json(e);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteEcheanceHandler = async (req, res) => {
  try {
    await deleteEcheance(getOrgId(req.user), req.params.id);
    res.json({ message: "Échéance supprimée." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const markEcheanceDoneHandler = async (req, res) => {
  try {
    const e = await markEcheanceDone(getOrgId(req.user), req.params.id);
    res.json(e);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const exportConformiteCsvHandler = async (req, res) => {
  try {
    const data = await getConformiteOverview(getOrgId(req.user));
    const csv = buildConformiteCsv(data);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=conformite_${stamp}.csv`);
    res.send(`\ufeff${csv}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
