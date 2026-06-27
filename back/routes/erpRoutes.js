import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { entrepreneurOnly } from "../middleware/roleMiddleware.js";
import {
  getControlCenterData,
  getHealthScoreEntreprise,
  getHealthScoreChantier,
  getAllScores,
  getRentabilite,
  getTresorerie,
  listAlerts,
  readAlert,
  resolveAlertAction,
} from "../controllers/erpController.js";

const router = express.Router();
router.use(protect);

router.get("/control-center", entrepreneurOnly, getControlCenterData);
router.get("/health/entreprise", entrepreneurOnly, getHealthScoreEntreprise);
router.get("/health/chantier/:chantierId", entrepreneurOnly, getHealthScoreChantier);
router.get("/health/chantiers", entrepreneurOnly, getAllScores);
router.get("/rentabilite", entrepreneurOnly, getRentabilite);
router.get("/tresorerie", entrepreneurOnly, getTresorerie);
router.get("/alertes", entrepreneurOnly, listAlerts);
router.patch("/alertes/:id/lu", entrepreneurOnly, readAlert);
router.patch("/alertes/:id/resoudre", entrepreneurOnly, resolveAlertAction);

export default router;
