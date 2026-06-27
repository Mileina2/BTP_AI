/**
 * Optionnel au build Render — schéma Prisma + seed.
 * Ignoré si DATABASE_URL absente (schéma déjà créé sur Neon).
 */
import { execSync } from "child_process";

const url = (process.env.DATABASE_URL || "").trim();

if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
  console.log("⏭️  DATABASE_URL absente ou invalide — db push ignoré.");
  console.log("   Collez l’URL Neon dans Render → Environment → DATABASE_URL");
  process.exit(0);
}

console.log("📦 Prisma db push…");
execSync("npx prisma db push --skip-generate", { stdio: "inherit" });

if (process.env.RUN_SEED === "true") {
  console.log("🌱 Seed démo (RUN_SEED=true)…");
  execSync("node prisma/seed.js", { stdio: "inherit" });
}
