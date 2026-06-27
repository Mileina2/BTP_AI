const WEAK_SECRETS = new Set([
  "super_secret_chantier",
  "super_secret_chantier_dev_only",
  "change_me_in_production",
  "change_me",
  "change_me_use_strong_random_secret_min_24_chars",
  "change_me_refresh",
  "change_me_refresh_min_32_chars",
  "secret",
  "ma_cle_refresh_ultra_secrete",
]);

function isWeakSecret(secret) {
  return !secret || secret.length < 32 || WEAK_SECRETS.has(secret);
}

/** Refresh tokens sont en base (hash) ; cette clé sert aux extensions futures. */
export function getJwtRefreshSecret() {
  const refresh = process.env.JWT_REFRESH_SECRET;
  if (refresh && refresh.length >= 32 && !WEAK_SECRETS.has(refresh)) return refresh;
  const main = getJwtSecret();
  if (main && main.length >= 32 && !WEAK_SECRETS.has(main)) {
    return `${main}:refresh`;
  }
  return refresh || "dev_refresh_only";
}

export function assertSecurityConfig() {
  const secret = process.env.JWT_SECRET;
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

  if (isProd && isWeakSecret(process.env.JWT_REFRESH_SECRET)) {
    console.warn(
      "⚠️  JWT_REFRESH_SECRET faible — dérivation automatique depuis JWT_SECRET (définissez une clé dédiée en prod)."
    );
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
