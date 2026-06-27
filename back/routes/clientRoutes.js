import express from "express";
import {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  searchClients,
  getClientsOverviewHandler,
  getClientDetailHandler,
} from "../controllers/clientController.js";
import { entrepreneurOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(entrepreneurOnly);

router.get("/search", searchClients);
router.get("/overview", getClientsOverviewHandler);
router.post("/", createClient);
router.get("/", getAllClients);
router.get("/:id/detail", getClientDetailHandler);
router.get("/:id", getClientById);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);

export default router;
