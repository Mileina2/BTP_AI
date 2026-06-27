/**
 * Exécuté au build Render : schéma Prisma + seed optionnel (RUN_SEED=true).
 */
import { execSync } from "child_process";

console.log("📦 Prisma db push…");
execSync("npx prisma db push --skip-generate", { stdio: "inherit" });

if (process.env.RUN_SEED === "true") {
  console.log("🌱 Seed démo (RUN_SEED=true)…");
  execSync("node prisma/seed.js", { stdio: "inherit" });
} else {
  console.log("⏭️  Seed ignoré (RUN_SEED≠true).");
}
