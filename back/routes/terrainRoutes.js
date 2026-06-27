import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { chefOrEntrepreneur, entrepreneurOnly } from "../middleware/roleMiddleware.js";
import { chantierUpload } from "../middleware/uploadMiddleware.js";
import {
  createRapportJournalier,
  getRapports,
  uploadRapportPhoto,
  getTerrainStorageInfo,
  createDemandeMateriel,
  getDemandesMateriel,
  updateDemandeMateriel,
} from "../controllers/financeController.js";

const router = express.Router();
router.use(protect);

router.get("/storage", chefOrEntrepreneur, getTerrainStorageInfo);
router.post("/rapports/photo", chefOrEntrepreneur, chantierUpload.single("file"), uploadRapportPhoto);
router.post("/rapports", chefOrEntrepreneur, createRapportJournalier);
router.get("/rapports", chefOrEntrepreneur, getRapports);
router.post("/demandes", chefOrEntrepreneur, createDemandeMateriel);
router.get("/demandes", chefOrEntrepreneur, getDemandesMateriel);
router.patch("/demandes/:id", entrepreneurOnly, updateDemandeMateriel);

export default router;
