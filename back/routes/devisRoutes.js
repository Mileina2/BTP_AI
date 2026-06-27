import express from "express";
import {
  createDevis,
  getAllDevis,
  getDevisById,
  updateDevis,
  deleteDevis,
  searchDevis,
  generateDevisPDF,
  sendDevisWhatsApp,
  sendDevisEmail,
  getDevisHistorique,
  getDevisOverviewHandler,
  getDevisDetailHandler,
  convertDevisToFacture,
  listPrestationsHandler,
  createPrestationHandler,
  deletePrestationHandler,
  duplicateDevis,
  createDevisVersion,
  importDpgfExcel,
  downloadDpgfTemplate,
  getDevisAnnexesHandler,
  addDevisAnnexeHandler,
  deleteDevisAnnexeHandler,
} from "../controllers/financeController.js";
import { entrepreneurOnly } from "../middleware/roleMiddleware.js";
import { chantierUpload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(entrepreneurOnly);

router.get("/search", searchDevis);
router.get("/overview", getDevisOverviewHandler);
router.get("/prestations", listPrestationsHandler);
router.post("/prestations", createPrestationHandler);
router.delete("/prestations/:prestationId", deletePrestationHandler);
router.get("/dpgf-template", downloadDpgfTemplate);
router.post("/import-dpgf", chantierUpload.single("file"), importDpgfExcel);
router.post("/", createDevis);
router.get("/", getAllDevis);
router.get("/:id/detail", getDevisDetailHandler);
router.get("/:id/annexes", getDevisAnnexesHandler);
router.post("/:id/annexes", chantierUpload.single("file"), addDevisAnnexeHandler);
router.delete("/:id/annexes/:annexeId", deleteDevisAnnexeHandler);router.get("/:id/pdf", generateDevisPDF);
router.get("/:id/whatsapp", sendDevisWhatsApp);
router.post("/:id/email", sendDevisEmail);
router.post("/:id/duplicate", duplicateDevis);
router.post("/:id/version", createDevisVersion);
router.get("/:id/historique", getDevisHistorique);
router.get("/:id", getDevisById);
router.post("/:id/facture", convertDevisToFacture);
router.put("/:id", updateDevis);
router.delete("/:id", deleteDevis);

export default router;
