import express from "express";

import {

  getConformiteOverviewHandler,

  createEcheanceHandler,

  updateEcheanceHandler,

  deleteEcheanceHandler,

  markEcheanceDoneHandler,

  exportConformiteCsvHandler,

} from "../controllers/pilotageController.js";

import { entrepreneurOnly } from "../middleware/roleMiddleware.js";



const router = express.Router();

router.use(entrepreneurOnly);



router.get("/overview", getConformiteOverviewHandler);

router.get("/export/csv", exportConformiteCsvHandler);

router.post("/", createEcheanceHandler);

router.put("/:id", updateEcheanceHandler);

router.delete("/:id", deleteEcheanceHandler);

router.post("/:id/done", markEcheanceDoneHandler);



export default router;

