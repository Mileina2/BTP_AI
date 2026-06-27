const FORBIDDEN_KEYS = new Set([
  "id",
  "_id",
  "organizationId",
  "ownerId",
  "createdAt",
  "updatedAt",
  "motDePasse",
  "resetToken",
  "resetTokenExpire",
]);

/** Ne conserve que les champs explicitement autorisés (anti mass-assignment). */
export function pickAllowed(body, allowedKeys) {
  const out = {};
  if (!body || typeof body !== "object") return out;
  for (const key of allowedKeys) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}
