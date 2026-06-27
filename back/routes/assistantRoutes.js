import express from "express";
import { askAssistant } from "../controllers/assistantController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Route de discussion IA
router.post("/", protect, askAssistant);

export default router;
