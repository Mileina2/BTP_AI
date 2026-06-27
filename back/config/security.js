const WEAK_SECRETS = new Set([
  "super_secret_chantier",
  "super_secret_chantier_dev_only",
  "change_me_in_production",
  "change_me",
  "change_me_use_strong_random_secret_min_24_chars",
  "change_me_refresh",
  "secret",
  "ma_cle_refresh_ultra_secrete",
]);

function isWeakSecret(secret) {
  return !secret || secret.length < 32 || WEAK_SECRETS.has(secret);
}

export function assertSecurityConfig() {
  const secret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isWeakSecret(secret)) {
    const msg =
      "JWT_SECRET invalide ou trop faible. Utilisez une clé aléatoire d'au moins 32 caractères (openssl rand -base64 32).";
    if (isProd) {
      console.error("❌ Sécurité:", msg);
      process.exit(1);
    }
    console.warn("⚠️  Sécurité:", msg, "(mode développement — serveur continue)");
  }

  if (isProd && isWeakSecret(refreshSecret)) {
    console.error("❌ Sécurité: JWT_REFRESH_SECRET invalide en production.");
    process.exit(1);
  }

  if (isProd && !process.env.FRONTEND_URL) {
    console.error("❌ FRONTEND_URL obligatoire en production (CORS).");
    process.exit(1);
  }

  if (isProd && process.env.FRONTEND_URL?.startsWith("http://")) {
    console.warn("⚠️  FRONTEND_URL en HTTP — passez en HTTPS en production.");
  }

  if (isProd && process.env.API_PUBLIC_URL?.startsWith("http://")) {
    console.warn("⚠️  API_PUBLIC_URL en HTTP — passez en HTTPS en production.");
  }

  if (isProd && process.env.FORCE_HTTPS !== "true") {
    console.warn("⚠️  Recommandé en production : FORCE_HTTPS=true derrière un reverse proxy TLS.");
  }
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32 && !WEAK_SECRETS.has(secret)) return secret;
  return process.env.JWT_SECRET || "super_secret_chantier_dev_only";
}
