import express from "express";
import {
  getComptaOverviewHandler,
  exportComptaJournal,
  initPlanComptableHandler,
  getPlanComptableHandler,
  syncComptabiliteHandler,
  getJournalComptableHandler,
  createEcritureHandler,
  getBalanceHandler,
  exportBalanceHandler,
  getGrandLivreHandler,
  exportGrandLivreHandler,
} from "../controllers/financeController.js";
import { entrepreneurOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(entrepreneurOnly);

router.get("/overview", getComptaOverviewHandler);
router.get("/export/journal", exportComptaJournal);

router.post("/plan/init", initPlanComptableHandler);
router.get("/plan", getPlanComptableHandler);

router.post("/sync", syncComptabiliteHandler);

router.get("/journal", getJournalComptableHandler);
router.post("/ecritures", createEcritureHandler);

router.get("/balance", getBalanceHandler);
router.get("/export/balance", exportBalanceHandler);

router.get("/grand-livre", getGrandLivreHandler);
router.get("/export/grand-livre", exportGrandLivreHandler);

export default router;
