import express from "express";

import {

  getFournisseursOverviewHandler,

  createFournisseurHandler,

  updateFournisseurHandler,

  deleteFournisseurHandler,

  createEngagementHandler,

  updateEngagementHandler,

  compareEngagementsHandler,

  linkDepenseFournisseurHandler,

  markDepensePayeeHandler,

  exportFournisseurCsvHandler,

} from "../controllers/pilotageController.js";

import { entrepreneurOnly } from "../middleware/roleMiddleware.js";



const router = express.Router();

router.use(entrepreneurOnly);



router.get("/overview", getFournisseursOverviewHandler);

router.get("/compare", compareEngagementsHandler);

router.get("/export/csv", exportFournisseurCsvHandler);

router.post("/", createFournisseurHandler);

router.put("/:id", updateFournisseurHandler);

router.delete("/:id", deleteFournisseurHandler);

router.post("/engagements", createEngagementHandler);

router.put("/engagements/:id", updateEngagementHandler);

router.put("/depenses/:id/link", linkDepenseFournisseurHandler);

router.put("/depenses/:id/paye", markDepensePayeeHandler);



export default router;

