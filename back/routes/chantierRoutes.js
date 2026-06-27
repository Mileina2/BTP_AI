import express from "express";
import {
  getAllChantiers,
  getChantierById,
  createChantier,
  updateChantier,
  deleteChantier,
  searchChantiers,
  exportChantiersExcel,
  updateIndicateurs,
  addDocument,
  deleteDocument,
  getDocuments,
  addCommentaire,
  deleteCommentaire,
  getTimeline,
  getChantiersOverviewHandler,
  getChantierDetailHandler,
} from "../controllers/chantierController.js";
import { chantierUpload } from "../middleware/uploadMiddleware.js";
import { entrepreneurOnly, fieldTeam, allAppRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(allAppRoles);

router.post("/", entrepreneurOnly, createChantier);
router.get("/overview", getChantiersOverviewHandler);
router.get("/", getAllChantiers);
router.get("/search", searchChantiers);
router.get("/export/excel", entrepreneurOnly, exportChantiersExcel);

router.put("/:id/indicateurs", fieldTeam, updateIndicateurs);

router.get("/:id/timeline", getTimeline);
router.post("/:id/commentaire", fieldTeam, addCommentaire);
router.delete("/:id/timeline/:entryId", fieldTeam, deleteCommentaire);

router.get("/:id/documents", getDocuments);
router.post("/:id/document", fieldTeam, chantierUpload.single("file"), addDocument);
router.delete("/:id/document/:docId", fieldTeam, deleteDocument);

router.get("/:id/detail", getChantierDetailHandler);
router.get("/:id", getChantierById);
router.put("/:id", entrepreneurOnly, updateChantier);
router.delete("/:id", entrepreneurOnly, deleteChantier);

export default router;
