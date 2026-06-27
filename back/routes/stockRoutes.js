import express from "express";
import {
  createArticle,
  listArticles,
  getStockOverviewHandler,
  getArticle,
  updateArticle,
  deleteArticle,
  enregistrerMouvement,
  analyseStockChantier,
  listeAlertes,
  exportStockExcel,
  exportStockPdf,
} from "../controllers/financeController.js";
import { entrepreneurOnly, fieldTeam } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(fieldTeam);

router.get("/overview", getStockOverviewHandler);
router.get("/analyse/:chantierId", analyseStockChantier);
router.get("/alertes", listeAlertes);
router.get("/", listArticles);
router.post("/", entrepreneurOnly, createArticle);
router.get("/export/excel/:chantierId", entrepreneurOnly, exportStockExcel);
router.get("/export/pdf/:chantierId", entrepreneurOnly, exportStockPdf);
router.get("/:id", getArticle);
router.put("/:id", entrepreneurOnly, updateArticle);
router.delete("/:id", entrepreneurOnly, deleteArticle);
router.post("/:id/mouvements", fieldTeam, enregistrerMouvement);

export default router;
