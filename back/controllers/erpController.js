import prisma from "../config/prisma.js";
import { syncAlerts, getActiveAlerts, markAlertRead, resolveAlert } from "../services/alertService.js";
import { getControlCenter, getAllChantierScores } from "../services/controlCenterService.js";
import { getFullDashboard } from "../services/dashboardService.js";
import {
  computeHealthScoreEntreprise,
  computeHealthScoreChantier,
  getChantiersRentabilite,
  getPrevisionTresorerie,
} from "../services/healthScoreService.js";
import { getOrgId, getUserId } from "../utils/legacyMap.js";

export const getControlCenterData = async (req, res) => {
  try {
    const data = await getControlCenter(getOrgId(req.user), getUserId(req.user));
    res.json(data);
  } catch (err) {
    console.error("Erreur centre de contrôle:", err);
    res.status(500).json({ error: "Erreur centre de contrôle" });
  }
};

export const getHealthScoreEntreprise = async (req, res) => {
  try {
    const score = await computeHealthScoreEntreprise(getOrgId(req.user));
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getHealthScoreChantier = async (req, res) => {
  try {
    const score = await computeHealthScoreChantier(req.params.chantierId, getOrgId(req.user));
    if (!score) return res.status(404).json({ error: "Chantier introuvable" });
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllScores = async (req, res) => {
  try {
    const scores = await getAllChantierScores(getOrgId(req.user));
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRentabilite = async (req, res) => {
  try {
    const data = await getChantiersRentabilite(getOrgId(req.user));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTresorerie = async (req, res) => {
  try {
    const data = await getPrevisionTresorerie(getOrgId(req.user));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listAlerts = async (req, res) => {
  try {
    await syncAlerts(getOrgId(req.user), getUserId(req.user));
    const alerts = await getActiveAlerts(getOrgId(req.user));
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const readAlert = async (req, res) => {
  try {
    await markAlertRead(req.params.id, getOrgId(req.user));
    res.json({ message: "Alerte marquée comme lue" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const resolveAlertAction = async (req, res) => {
  try {
    await resolveAlert(req.params.id, getOrgId(req.user));
    res.json({ message: "Alerte résolue" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getDashboardSummary = async (req, res) => {
  try {
    const data = await getFullDashboard(getOrgId(req.user), getUserId(req.user));
    res.json(data);
  } catch (err) {
    console.error("Erreur Dashboard:", err);
    res.status(500).json({ error: "Erreur lors du chargement du tableau de bord" });
  }
};

export const getDashboardHistory = async (req, res) => {
  try {
    const history = await prisma.dashboardSnapshot.findMany({
      where: { organizationId: getOrgId(req.user) },
      orderBy: [{ annee: "desc" }, { mois: "desc" }],
      take: 12,
    });

    const formatted = history.map((d) => ({
      mois: `${String(d.mois).padStart(2, "0")}/${d.annee}`,
      budgetGlobal: d.stats?.budgetGlobal || 0,
      totalDepenses: d.graphData?.reduce((a, b) => a + (b.total || 0), 0) || 0,
      masseSalariale: d.stats?.masseSalariale || 0,
    }));

    res.json({ history: formatted });
  } catch (err) {
    res.status(500).json({ error: "Erreur historique dashboard" });
  }
};
