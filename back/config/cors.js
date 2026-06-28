/** Origines CORS autorisées (FRONTEND_URL + CORS_ORIGINS séparées par des virgules). */
export function getAllowedOrigins() {
  const list = new Set([process.env.FRONTEND_URL || "http://localhost:5173"]);
  if (process.env.NODE_ENV !== "production") {
    list.add("http://localhost:5173");
    list.add("http://localhost:4173");
  }
  if (process.env.NODE_ENV === "production") {
    list.add("https://btp-ia.vercel.app");
    list.add("https://front-ruddy-pi.vercel.app");
  }
  const extra = process.env.CORS_ORIGINS || "";
  extra
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => list.add(o));
  return [...list];
}

/** Autorise aussi les previews *.vercel.app en production (déploiements Vercel). */
export function corsOriginCallback(origin, callback) {
  if (!origin) return callback(null, true);
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return callback(null, true);
  try {
    const host = new URL(origin).hostname;
    if (process.env.NODE_ENV === "production" && host.endsWith(".vercel.app")) {
      return callback(null, true);
    }
  } catch {
    /* ignore */
  }
  callback(null, false);
}
