import express from "express";
import { clientPortal } from "../middleware/roleMiddleware.js";
import {
  getPortalDevis,
  getPortalFactures,
  acceptPortalDevis,
  refusePortalDevis,
  downloadPortalDevisPdf,
  downloadPortalFacturePdf,
  getPortalStats,
} from "../controllers/portalController.js";

const router = express.Router();

router.use(clientPortal);

router.get("/stats", getPortalStats);
router.get("/devis", getPortalDevis);
router.get("/devis/:id/pdf", downloadPortalDevisPdf);
router.post("/devis/:id/accepter", acceptPortalDevis);
router.post("/devis/:id/refuser", refusePortalDevis);
router.get("/factures", getPortalFactures);
router.get("/factures/:id/pdf", downloadPortalFacturePdf);

export default router;
