import express from "express";

import {

  getTresorerieOverviewHandler,

  exportTresorerieCsvHandler,

  exportTresoreriePdfHandler,

} from "../controllers/pilotageController.js";

import { entrepreneurOnly } from "../middleware/roleMiddleware.js";



const router = express.Router();

router.use(entrepreneurOnly);

router.get("/overview", getTresorerieOverviewHandler);

router.get("/export/csv", exportTresorerieCsvHandler);

router.get("/export/pdf", exportTresoreriePdfHandler);

export default router;

