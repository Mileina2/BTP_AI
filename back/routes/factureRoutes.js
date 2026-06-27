import express from "express";
import {
  createFacture,
  getAllFactures,
  getFactureById,
  updateFacture,
  deleteFacture,
  exportFacturePDF,
  getFactureOverviewHandler,
  getFactureDetailHandler,
  relancerFacturesImpayees,
  sendFactureEmail,
  sendFactureWhatsApp,
  getFactureFormSuggestions,
  validerFacture,
  addFacturePaiement,
  deleteFacturePaiement,
  createFactureAvoir,
  exportFacturesComptable,
  exportAvoirPDF,
} from "../controllers/financeController.js";
import { entrepreneurOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(entrepreneurOnly);

router.get("/overview", getFactureOverviewHandler);
router.get("/suggestions", getFactureFormSuggestions);
router.get("/export/comptable", exportFacturesComptable);
router.get("/avoir/:avoirId/pdf", exportAvoirPDF);
router.post("/", createFacture);
router.get("/", getAllFactures);
router.post("/relances", relancerFacturesImpayees);
router.get("/export/pdf/:id", exportFacturePDF);
router.get("/:id/pdf", exportFacturePDF);
router.post("/:id/email", sendFactureEmail);
router.get("/:id/whatsapp", sendFactureWhatsApp);
router.post("/:id/valider", validerFacture);
router.post("/:id/paiements", addFacturePaiement);
router.delete("/:id/paiements/:paiementId", deleteFacturePaiement);
router.post("/:id/avoir", createFactureAvoir);
router.get("/:id/detail", getFactureDetailHandler);
router.get("/:id", getFactureById);
router.put("/:id", updateFacture);
router.delete("/:id", deleteFacture);

export default router;
