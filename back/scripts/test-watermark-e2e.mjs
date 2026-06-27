/**
 * Test E2E filigrane : upload image → vérifie bande sombre + texte en bas.
 */
import sharp from "sharp";

const BASE = "http://localhost:4000/api";

async function avgBrightness(buf, yStart, yEnd) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let sum = 0;
  let n = 0;
  for (let y = yStart; y < yEnd && y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * info.channels;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      n++;
    }
  }
  return sum / n;
}

async function main() {
  console.log("=== Test filigrane E2E ===\n");

  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  if (health.status !== "ok") throw new Error("Backend indisponible");
  console.log("✓ Backend OK — stockage:", health.storage?.label);

  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@btpia.com", password: "demo1234" }),
  }).then((r) => r.json());
  if (!login.token) throw new Error(login.error || "Login échoué");
  console.log("✓ Login démo OK");

  const h = { Authorization: `Bearer ${login.token}` };
  const chantiers = await fetch(`${BASE}/chantier`, { headers: h }).then((r) => r.json());
  const list = Array.isArray(chantiers) ? chantiers : chantiers.items || [];
  const chantier = list[0];
  if (!chantier) throw new Error("Aucun chantier");
  const chantierId = chantier.id || chantier._id;
  console.log("✓ Chantier:", chantier.nom, `(${chantierId})`);

  const plain = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 180, g: 140, b: 90 } },
  })
    .jpeg()
    .toBuffer();

  const form = new FormData();
  form.append("file", new Blob([plain], { type: "image/jpeg" }), "test_filigrane.jpg");
  form.append("nom", "test_filigrane.jpg");
  form.append("latitude", "5.35995");
  form.append("longitude", "-3.98731");
  // Pas de watermarked=1 → le serveur doit appliquer le filigrane

  const uploadRes = await fetch(`${BASE}/chantier/${chantierId}/document`, {
    method: "POST",
    headers: h,
    body: form,
  });
  const uploadBody = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(uploadBody.error || `Upload ${uploadRes.status}`);
  const url = uploadBody.document?.url;
  if (!url) throw new Error("URL document manquante");
  console.log("✓ Upload OK:", url);

  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error("Impossible de lire l'image stockée");
  const stored = Buffer.from(await imgRes.arrayBuffer());

  const topBright = await avgBrightness(plain, 0, 40);
  const bottomBrightPlain = await avgBrightness(plain, 520, 600);
  const topStored = await avgBrightness(stored, 0, 40);
  const bottomStored = await avgBrightness(stored, 520, 600);
  const barAdded = bottomStored < topStored - 25;

  console.log("\n--- Analyse luminosité ---");
  console.log("  Image brute  : haut", Math.round(topBright), " / bas", Math.round(bottomBrightPlain));
  console.log("  Image stockée: haut", Math.round(topStored), " / bas", Math.round(bottomStored));
  console.log("  Bande filigrane détectée:", barAdded ? "OUI ✓" : "NON ✗");

  // Test terrain photo endpoint
  const form2 = new FormData();
  form2.append("file", new Blob([plain], { type: "image/jpeg" }), "rapport_test.jpg");
  form2.append("chantierId", chantierId);
  form2.append("latitude", "5.36");
  form2.append("longitude", "-3.99");
  form2.append("watermarked", "1");

  const terrainRes = await fetch(`${BASE}/terrain/rapports/photo`, {
    method: "POST",
    headers: h,
    body: form2,
  });
  const terrainBody = await terrainRes.json();
  if (!terrainRes.ok) throw new Error(terrainBody.error || "Terrain photo échoué");
  console.log("✓ Upload terrain/rapports/photo OK");

  // Cleanup: delete test document
  const docId = uploadBody.document?.id || uploadBody.document?._id;
  if (docId) {
    await fetch(`${BASE}/chantier/${chantierId}/document/${docId}`, { method: "DELETE", headers: h });
    console.log("✓ Document test supprimé");
  }

  if (!barAdded) {
    console.error("\n❌ ÉCHEC : filigrane serveur non détecté sur l'image.");
    process.exit(1);
  }

  console.log("\n✅ Tous les tests filigrane passés.");
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
