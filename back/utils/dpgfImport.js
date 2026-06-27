import ExcelJS from "exceljs";

const HEADER_ALIASES = {
  section: [
    "lot",
    "section",
    "ouvrage",
    "corps d etat",
    "corps d'etat",
    "famille",
    "corps de lot",
    "poste principal",
  ],
  reference: [
    "ref",
    "reference",
    "n poste",
    "n de prix",
    "numero",
    "numero de prix",
    "code",
    "code prix",
    "rep",
    "rep.",
    "poste",
    "n°",
    "num",
  ],
  designation: [
    "designation",
    "libelle",
    "description",
    "libelle des prestations",
    "designation des travaux",
    "designation des ouvrages",
    "description des ouvrages",
    "description detaillee",
    "prestation",
    "prestations",
    "intitule",
    "nature des travaux",
    "libelle detaille",
    "libelle ouvrage",
    "libelle de l ouvrage",
  ],
  unite: ["unite", "u", "un", "unit"],
  quantite: ["quantite", "qte", "qty", "quant", "nombre", "qt"],
  prixUnitaire: [
    "prix unitaire",
    "p.u.",
    "p.u",
    "pu",
    "pu ht",
    "prix u",
    "prix u ht",
    "prix ht",
    "prix unitaire ht",
    "montant unitaire",
    "montant u",
    "unitaire ht",
    "prix unit",
  ],
  tva: ["tva", "taux tva", "taux de tva", "% tva"],
  isOption: ["option", "variante", "alternatif"],
};

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cellRawValue(cell) {
  if (!cell || cell.value == null || cell.value === "") return "";
  const raw = cell.value;
  if (typeof raw === "object" && raw.richText) {
    return raw.richText.map((p) => p.text).join("");
  }
  if (typeof raw === "object" && raw.text) return String(raw.text);
  if (typeof raw === "object" && raw.result != null) return String(raw.result);
  return String(raw);
}

function rowTexts(row, maxCol = 30) {
  const texts = [];
  const limit = Math.max(maxCol, row.cellCount || 0, row.actualCellCount || 0);
  for (let c = 1; c <= limit; c++) {
    texts[c] = normalizeHeader(cellRawValue(row.getCell(c)));
  }
  return texts;
}

function scoreHeader(text, aliases) {
  if (!text) return 0;
  let best = 0;
  for (const alias of aliases) {
    if (text === alias) best = Math.max(best, 90 + Math.min(alias.length, 20));
    else if (text.startsWith(alias + " ") || text.endsWith(" " + alias)) best = Math.max(best, 80 + Math.min(alias.length, 15));
    else if (text.includes(alias)) best = Math.max(best, 65 + Math.min(alias.length, 15));
  }
  return best;
}

function detectColumnsInRow(row, maxCol = 30) {
  const texts = rowTexts(row, maxCol);
  const mapping = {};
  const scores = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    let bestCol = null;
    let bestScore = 0;
    for (let c = 1; c < texts.length; c++) {
      const s = scoreHeader(texts[c], aliases);
      if (s > bestScore) {
        bestScore = s;
        bestCol = c;
      }
    }
    if (bestScore >= 65) {
      mapping[field] = bestCol;
      scores[field] = bestScore;
    }
  }

  return { mapping, scores, texts };
}

function findHeaderRow(sheet, maxScan = 40) {
  const maxCol = Math.min(Math.max(sheet.columnCount || 0, sheet.actualColumnCount || 0, 12), 40);
  let best = { rowIndex: null, mapping: {}, score: 0 };

  for (let r = 1; r <= Math.min(maxScan, sheet.rowCount || maxScan); r++) {
    const row = sheet.getRow(r);
    const { mapping, scores } = detectColumnsInRow(row, maxCol);
    const total =
      (scores.designation || 0) +
      (scores.quantite || 0) * 0.5 +
      (scores.prixUnitaire || 0) * 0.5 +
      (scores.unite || 0) * 0.3;

    if (scores.designation >= 65 && total > best.score) {
      best = { rowIndex: r, mapping, score: total };
    }
  }

  return best;
}

function guessDesignationColumn(sheet, headerRowIndex, mapping, maxCol = 30) {
  if (mapping.designation) return mapping.designation;

  const used = new Set(Object.values(mapping).filter(Boolean));
  let bestCol = null;
  let bestLen = 0;

  const sampleEnd = Math.min(headerRowIndex + 25, sheet.rowCount || headerRowIndex + 25);
  for (let c = 1; c <= maxCol; c++) {
    if (used.has(c)) continue;
    let totalLen = 0;
    let count = 0;
    for (let r = headerRowIndex + 1; r <= sampleEnd; r++) {
      const text = cellText(sheet.getRow(r), c);
      if (text && !/^\d+([.,]\d+)?$/.test(text)) {
        totalLen += text.length;
        count++;
      }
    }
    const avg = count ? totalLen / count : 0;
    if (avg > bestLen && count >= 2) {
      bestLen = avg;
      bestCol = c;
    }
  }

  return bestCol;
}

function applyFallbackMapping(row, mapping, maxCol = 30) {
  const next = { ...mapping };
  const texts = rowTexts(row, maxCol);

  if (!next.quantite) {
    for (let c = 1; c < texts.length; c++) {
      if (/^(qte|qty|quantite|quant|qt)$/.test(texts[c])) {
        next.quantite = c;
        break;
      }
    }
  }
  if (!next.prixUnitaire) {
    for (let c = 1; c < texts.length; c++) {
      const t = texts[c];
      if (t && (t.includes("pu") || t.includes("prix") || t.includes("unitaire"))) {
        next.prixUnitaire = c;
        break;
      }
    }
  }
  if (!next.unite) {
    for (let c = 1; c < texts.length; c++) {
      if (/^(u|un|unite|unit)$/.test(texts[c])) {
        next.unite = c;
        break;
      }
    }
  }
  if (!next.reference) {
    for (let c = 1; c < texts.length; c++) {
      const t = texts[c];
      if (/^(ref|n|n°|code|rep)$/.test(t) || t.startsWith("n ")) {
        next.reference = c;
        break;
      }
    }
  }

  return next;
}

function cellNumber(row, col) {
  if (!col) return null;
  const raw = row.getCell(col).value;
  if (raw == null || raw === "") return null;
  if (typeof raw === "object" && raw.result != null) return Number(raw.result) || null;
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function cellText(row, col) {
  if (!col) return "";
  return cellRawValue(row.getCell(col)).trim();
}

function isOptionValue(value) {
  const v = normalizeHeader(value);
  return ["1", "oui", "yes", "true", "x", "option", "o"].includes(v);
}

function isTitleRow(designation, quantite, prixUnitaire, reference) {
  const d = designation.toLowerCase();
  if (/^(total|sous[- ]total|lot |section |poste |t\.?v\.?a|montant|general|generale)/i.test(d)) return true;
  if (!quantite && !prixUnitaire && !reference && designation.length < 80) {
    if (/^(lot|section|poste)\b/i.test(d)) return true;
  }
  return false;
}

function parseSheet(sheet) {
  const maxCol = Math.min(Math.max(sheet.columnCount || 0, 12), 40);
  const header = findHeaderRow(sheet);
  let headerRowIndex = header.rowIndex;
  let columns = { ...header.mapping };

  if (!headerRowIndex) {
    throw new Error(
      "Colonne « Désignation » introuvable. Vérifiez que la 1ère ligne de données contient les en-têtes (Désignation, Qté, P.U., etc.) ou utilisez le modèle DPGF."
    );
  }

  columns = applyFallbackMapping(sheet.getRow(headerRowIndex), columns, maxCol);

  if (!columns.designation) {
    columns.designation = guessDesignationColumn(sheet, headerRowIndex, columns, maxCol);
  }

  if (!columns.designation) {
    throw new Error(
      "Colonne « Désignation » introuvable. En-têtes acceptés : Désignation, Libellé, Prestation, Description des ouvrages… Téléchargez le modèle DPGF pour le format attendu."
    );
  }

  const lignes = [];
  const skipped = [];

  for (let r = headerRowIndex + 1; r <= (sheet.rowCount || 0); r++) {
    const row = sheet.getRow(r);
    const designation = cellText(row, columns.designation);
    if (!designation) continue;

    const quantite = cellNumber(row, columns.quantite) ?? 0;
    const prixUnitaire = cellNumber(row, columns.prixUnitaire) ?? 0;
    const section = cellText(row, columns.section) || "Général";
    const reference = cellText(row, columns.reference) || null;
    const uniteRaw = cellText(row, columns.unite);
    const unite = uniteRaw || "u";
    const tva = cellNumber(row, columns.tva);
    const isOption = columns.isOption ? isOptionValue(cellText(row, columns.isOption)) : false;

    if (isTitleRow(designation, quantite, prixUnitaire, reference)) {
      skipped.push({ row: r, reason: "Ligne titre / sous-total ignorée", designation });
      continue;
    }

    if (quantite <= 0 && prixUnitaire <= 0 && !reference) {
      skipped.push({ row: r, reason: "Ligne sans montant ignorée", designation });
      continue;
    }

    lignes.push({
      section,
      reference,
      designation,
      detailDescription: null,
      quantite: quantite > 0 ? quantite : 1,
      unite,
      prixUnitaire,
      tva: tva ?? 18,
      isOption,
    });
  }

  return { lignes, skipped, headerRowIndex, columns, sheetName: sheet.name };
}

export async function parseDpgfWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (!workbook.worksheets.length) throw new Error("Fichier Excel vide.");

  let best = null;
  const errors = [];

  for (const sheet of workbook.worksheets) {
    if (!sheet || (sheet.rowCount || 0) < 2) continue;
    try {
      const result = parseSheet(sheet);
      if (result.lignes.length && (!best || result.lignes.length > best.lignes.length)) {
        best = result;
      }
    } catch (err) {
      errors.push(`${sheet.name}: ${err.message}`);
    }
  }

  if (!best?.lignes?.length) {
    const hint = errors[0] || "Aucune feuille exploitable.";
    throw new Error(hint);
  }

  return {
    lignes: best.lignes,
    stats: {
      imported: best.lignes.length,
      skipped: best.skipped.length,
      sheetName: best.sheetName,
      headerRow: best.headerRowIndex,
    },
    skipped: best.skipped,
  };
}

export async function buildDpgfTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("DPGF");
  sheet.columns = [
    { header: "Lot", key: "lot", width: 18 },
    { header: "Réf", key: "ref", width: 10 },
    { header: "Désignation", key: "designation", width: 42 },
    { header: "Unité", key: "unite", width: 8 },
    { header: "Quantité", key: "quantite", width: 10 },
    { header: "P.U. HT", key: "pu", width: 12 },
    { header: "TVA %", key: "tva", width: 8 },
    { header: "Option", key: "option", width: 8 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    lot: "Gros œuvre",
    ref: "GO-01",
    designation: "Fouilles en rigoles et tranchées",
    unite: "m³",
    quantite: 120,
    pu: 8500,
    tva: 18,
    option: "",
  });
  sheet.addRow({
    lot: "Second œuvre",
    ref: "SO-02",
    designation: "Carrelage sol 60×60",
    unite: "m²",
    quantite: 85,
    pu: 12500,
    tva: 18,
    option: "oui",
  });
  return workbook;
}
