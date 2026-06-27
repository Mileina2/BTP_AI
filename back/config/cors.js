/** Origines CORS autorisées (FRONTEND_URL + CORS_ORIGINS séparées par des virgules). */
export function getAllowedOrigins() {
  const list = new Set([process.env.FRONTEND_URL || "http://localhost:5173"]);
  if (process.env.NODE_ENV !== "production") {
    list.add("http://localhost:5173");
    list.add("http://localhost:4173");
  }
  const extra = process.env.CORS_ORIGINS || "";
  extra
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => list.add(o));
  return [...list];
}
