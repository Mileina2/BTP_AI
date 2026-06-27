import express from "express";
import {
  createMembre,
  getAllMembres,
  getEquipeOverviewHandler,
  getMembreById,
  updateMembre,
  deleteMembre,
  calculerSalairesMois,
  recalculerSalairesAuto,
  analyseMasseSalariale,
  exportMasseSalarialePDF,
  exportMasseSalarialeExcel,
} from "../controllers/financeController.js";
import { entrepreneurOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(entrepreneurOnly);

router.get("/overview", getEquipeOverviewHandler);
router.get("/", getAllMembres);
router.post("/", createMembre);
router.put("/calculer-salaires", calculerSalairesMois);
router.put("/recalcul-auto", recalculerSalairesAuto);
router.get("/analyse/:chantierId", analyseMasseSalariale);
router.get("/export/pdf/:chantierId", exportMasseSalarialePDF);
router.get("/export/excel/:chantierId", exportMasseSalarialeExcel);
router.get("/:id", getMembreById);
router.put("/:id", updateMembre);
router.delete("/:id", deleteMembre);

export default router;
