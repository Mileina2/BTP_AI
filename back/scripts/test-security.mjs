/**
 * Vérifications sécurité (sans secrets en dur).
 * Usage: node scripts/test-security.mjs
 */
import { pickAllowed } from "../utils/pickFields.js";
import { signMediaAccess, verifyMediaAccess, buildLocalMediaUrl } from "../utils/mediaAccess.js";
import { validatePassword } from "../utils/passwordPolicy.js";

let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label, err) {
  failed++;
  console.error(`  ✗ ${label}`, err?.message || err);
}

// pickAllowed
const body = pickAllowed(
  { nom: "Test", organizationId: "hack", motDePasse: "x", budget: 100 },
  ["nom", "budget", "organizationId"]
);
if (body.nom === "Test" && body.budget === 100 && !body.organizationId && !body.motDePasse) {
  ok("pickAllowed bloque organizationId et motDePasse");
} else {
  fail("pickAllowed", body);
}

// password policy
if (validatePassword("short") && !validatePassword("validpass123")) {
  ok("validatePassword min 8 caractères");
} else {
  fail("validatePassword");
}

// signed media URLs
const org = "org-demo";
const chantier = "chantier-demo";
const file = "photo.jpg";
const token = signMediaAccess({ organizationId: org, chantierId: chantier, publicId: file });
try {
  verifyMediaAccess(token, { organizationId: org, chantierId: chantier, publicId: file });
  ok("signMediaAccess / verifyMediaAccess");
} catch (e) {
  fail("media token", e);
}

const url = buildLocalMediaUrl(org, chantier, file);
if (url.includes("/api/media/chantiers/") && url.includes("access=")) {
  ok("buildLocalMediaUrl utilise /api/media avec jeton");
} else {
  fail("buildLocalMediaUrl", url);
}

try {
  verifyMediaAccess(token, { organizationId: "other", chantierId: chantier, publicId: file });
  fail("verifyMediaAccess devrait rejeter mauvaise org");
} catch {
  ok("verifyMediaAccess rejette mauvaise organisation");
}

console.log(`\n${passed} passés, ${failed} échoués`);
process.exit(failed ? 1 : 0);
