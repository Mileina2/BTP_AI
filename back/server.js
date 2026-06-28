import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import { connectDatabase } from "./config/prisma.js";
import { getAllowedOrigins, corsOriginCallback } from "./config/cors.js";
import { assertSecurityConfig } from "./config/security.js";
import { requireHttps } from "./middleware/httpsMiddleware.js";
import { apiRateLimiter } from "./middleware/rateLimitMiddleware.js";
import { protect } from "./middleware/authMiddleware.js";
import { getStorageInfo } from "./utils/fileStorage.js";
import { isSmtpConfigured } from "./utils/emailService.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chantierRoutes from "./routes/chantierRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import devisRoutes from "./routes/devisRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import equipeRoutes from "./routes/equipeRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import factureRoutes from "./routes/factureRoutes.js";
import comptaRoutes from "./routes/comptaRoutes.js";
import tresorerieRoutes from "./routes/tresorerieRoutes.js";
import fournisseurRoutes from "./routes/fournisseurRoutes.js";
import conformiteRoutes from "./routes/conformiteRoutes.js";
import erpRoutes from "./routes/erpRoutes.js";
import terrainRoutes from "./routes/terrainRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import portalRoutes from "./routes/portalRoutes.js";

assertSecurityConfig();

if (!isSmtpConfigured()) {
  console.warn(
    "⚠️  Emails désactivés : remplissez SMTP_USER, SMTP_PASS et SMTP_FROM dans back/.env (Brevo)"
  );
}

const app = express();
const PORT = process.env.PORT || 4000;
const FRONT_URL = process.env.FRONTEND_URL || "http://localhost:5173";

if (process.env.TRUST_PROXY) {
  const hops = process.env.TRUST_PROXY === "true" ? 1 : process.env.TRUST_PROXY;
  app.set("trust proxy", hops);
}
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// Healthcheck public (avant rate limit + HTTPS strict)
app.get("/api/health", (_req, res) => {
  const storage = getStorageInfo();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
    storage: { mode: storage.mode, label: storage.label },
  });
});

app.use(requireHttps);

app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    hsts:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    contentSecurityPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);
app.use(compression());
app.use("/api", apiRateLimiter);

// Médias locaux protégés par jeton signé (pas de listing public)
app.use("/api/media", mediaRoutes);

app.get("/", (_req, res) => {
  res.send("🚀 BTP IA — ERP API opérationnelle (PostgreSQL)");
});

// Routes publiques
app.use("/api/auth", authRoutes);
app.use("/api/assistant", assistantRoutes);

// Routes protégées
app.use(protect);

app.use("/api/erp", erpRoutes);
app.use("/api/terrain", terrainRoutes);
app.use("/api/chantier", chantierRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/devis", devisRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/equipe", equipeRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/facture", factureRoutes);
app.use("/api/compta", comptaRoutes);
app.use("/api/tresorerie", tresorerieRoutes);
app.use("/api/fournisseur", fournisseurRoutes);
app.use("/api/conformite", conformiteRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/user", userRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route non trouvée : ${req.originalUrl}` });
});

app.use((err, req, res, _next) => {
  if (err.message?.includes("Type de fichier non autorisé")) {
    return res.status(400).json({ error: err.message });
  }
  console.error("🔥 Erreur serveur :", err.stack);
  const isProd = process.env.NODE_ENV === "production";
  res.status(err.status || 500).json({
    success: false,
    error: isProd ? "Erreur interne du serveur" : err.message || "Erreur interne du serveur",
  });
});

async function start() {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`✅ Serveur en ligne (${process.env.NODE_ENV || "development"}) : http://localhost:${PORT}`);
      console.log(`🔗 Front autorisé : ${FRONT_URL}`);
      console.log(`🗄️  Base de données : PostgreSQL (Prisma)`);
      const storage = getStorageInfo();
      console.log(`📁 Médias chantier : ${storage.label}${storage.cloudName ? ` (${storage.cloudName})` : ""}`);
    });
  } catch (err) {
    console.error("❌ Impossible de démarrer le serveur :", err.message);
    process.exit(1);
  }
}

start();
