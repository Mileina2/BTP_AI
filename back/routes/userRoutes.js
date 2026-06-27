import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { entrepreneurOnly } from "../middleware/roleMiddleware.js";
import { getMonProfil } from "../controllers/authController.js";
import {
  listTeamUsers,
  inviteChefChantier,
  linkClientPortal,
  assignChefToChantier,
  listAuditLogs,
} from "../controllers/userManagementController.js";

const router = express.Router();

router.use(protect);
router.get("/me", getMonProfil);
router.get("/profil", getMonProfil);

router.get("/team", entrepreneurOnly, listTeamUsers);
router.post("/invite-chef", entrepreneurOnly, inviteChefChantier);
router.post("/link-client", entrepreneurOnly, linkClientPortal);
router.post("/assign-chef", entrepreneurOnly, assignChefToChantier);
router.get("/audit", entrepreneurOnly, listAuditLogs);

export default router;
