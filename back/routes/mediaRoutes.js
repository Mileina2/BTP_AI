import express from "express";
import path from "path";
import { verifyMediaAccess, verifyDevisMediaAccess, serveLocalMediaFile, serveDevisMediaFile } from "../utils/mediaAccess.js";

const router = express.Router();

router.get("/chantiers/:organizationId/:chantierId/:fileId", async (req, res) => {
  try {
    const token = req.query.access;
    if (!token) return res.status(401).json({ error: "Accès média non autorisé." });

    const { organizationId, chantierId, fileId } = req.params;
    verifyMediaAccess(token, { organizationId, chantierId, publicId: fileId });

    const buffer = await serveLocalMediaFile(organizationId, chantierId, fileId);
    const ext = path.extname(fileId).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".webm"
            ? "video/webm"
            : ext === ".mp4"
              ? "video/mp4"
              : ext === ".pdf"
                ? "application/pdf"
                : "image/jpeg";

    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  } catch (err) {
    const status = err.name === "TokenExpiredError" ? 401 : 403;
    res.status(status).json({ error: "Accès au fichier refusé ou lien expiré." });
  }
});

router.get("/devis/:organizationId/:devisId/:fileId", async (req, res) => {
  try {
    const token = req.query.access;
    if (!token) return res.status(401).json({ error: "Accès média non autorisé." });

    const { organizationId, devisId, fileId } = req.params;
    verifyDevisMediaAccess(token, { organizationId, devisId, publicId: fileId });

    const buffer = await serveDevisMediaFile(organizationId, devisId, fileId);
    const ext = path.extname(fileId).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".pdf"
            ? "application/pdf"
            : "application/octet-stream";

    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  } catch (err) {
    const status = err.name === "TokenExpiredError" ? 401 : 403;
    res.status(status).json({ error: "Accès au fichier refusé ou lien expiré." });
  }
});

export default router;
