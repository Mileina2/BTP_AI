import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { entrepreneurOnly } from "../middleware/roleMiddleware.js";
import { getDashboardSummary, getDashboardHistory } from "../controllers/erpController.js";

const router = express.Router();
router.use(protect, entrepreneurOnly);

router.get("/summary", getDashboardSummary);
router.get("/history", getDashboardHistory);

export default router;
