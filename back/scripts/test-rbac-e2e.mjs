/**
 * Tests RBAC / API smoke (comptes démo seed).
 * Usage: node scripts/test-rbac-e2e.mjs
 */
const BASE = process.env.API_URL || "http://localhost:4000/api";

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, motDePasse: password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${email}: ${data.error || res.status}`);
  return data.token;
}

async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log(`  ✓ ${label}`);
}
function fail(label, detail) {
  failed++;
  console.error(`  ✗ ${label}`, detail || "");
}

try {
  const entrepreneur = await login("demo@btpia.com", "demo1234");
  const chef = await login("chef@btpia.com", "chef1234");
  const proprio = await login("proprietaire@btpia.com", "proprio1234");
  ok("Login 3 profils démo");

  const chefClients = await get("/client", chef);
  if (chefClients.status === 403) ok("Chef bloqué sur /client");
  else fail("Chef /client", chefClients.status);

  const propDevis = await get("/portal/devis", proprio);
  if (propDevis.status === 200) ok("Propriétaire /portal/devis");
  else fail("Propriétaire portal", propDevis.status);

  const chefChantiers = await get("/chantier", chef);
  const items = chefChantiers.data?.items || [];
  if (chefChantiers.status === 200 && items.length >= 1) ok("Chef voit ses chantiers assignés");
  else fail("Chef chantiers", items.length);

  const entTeam = await get("/user/team", entrepreneur);
  if (entTeam.status === 200) ok("Entrepreneur /user/team");
  else fail("Team", entTeam.status);
} catch (e) {
  fail("Suite tests", e.message);
}

console.log(`\n${passed} passés, ${failed} échoués`);
process.exit(failed ? 1 : 0);
