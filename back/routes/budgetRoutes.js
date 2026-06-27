import express from "express";
import {
  createDepense,
  getAllDepenses,
  getDepenseById,
  updateDepense,
  deleteDepense,
  getBudgetOverviewHandler,
  getDepenseDetailHandler,
  exportBudgetCsvHandler,
  getBudgetByChantier,
  getBudgetAnalyse,
  predictBudget,
  exportBudgetPDF,
  exportBudgetConsolidatedPDF,
  exportBudgetExcel,
  exportBudgetExcelConsolidated,
} from "../controllers/financeController.js";
import { entrepreneurOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(entrepreneurOnly);

router.get("/overview", getBudgetOverviewHandler);
router.get("/export/csv", exportBudgetCsvHandler);
router.post("/", createDepense);
router.get("/", getAllDepenses);
router.get("/chantier/:chantierId", getBudgetByChantier);
router.get("/analyse/:chantierId", getBudgetAnalyse);
router.get("/predict/:chantierId", predictBudget);
router.get("/export/pdf/consolidated", exportBudgetConsolidatedPDF);
router.get("/export/excel/consolidated", exportBudgetExcelConsolidated);
router.get("/export/pdf/:chantierId", exportBudgetPDF);
router.get("/export/excel/:chantierId", exportBudgetExcel);
router.get("/:id/detail", getDepenseDetailHandler);
router.get("/:id", getDepenseById);
router.put("/:id", updateDepense);
router.delete("/:id", deleteDepense);

export default router;
