import express from "express";
import { getOrganization, updateOrganization } from "../controllers/organizationController.js";
import { entrepreneurOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(entrepreneurOnly);

router.get("/", getOrganization);
router.put("/", updateOrganization);

export default router;
