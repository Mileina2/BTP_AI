import PDFDocument from "pdfkit";
import { makeMoneyFormatters } from "./currency.js";

const MARGIN = 48;
const INK = "#0f172a";
const MUTED = "#64748b";
const SLATE = "#0f172a";
const BORDER = "#e2e8f0";

function fmtNum(n) {
  return Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function pageWidth(doc) {
  return doc.page.width - MARGIN * 2;
}

function textAt(doc, str, x, y, opts = {}) {
  doc.text(str ?? "", x, y, { lineBreak: false, ...opts });
  doc.x = MARGIN;
  doc.y = y;
}

function textRight(doc, str, x, y, w) {
  const s = str ?? "";
  const tw = doc.widthOfString(s);
  textAt(doc, s, x + w - tw, y);
}

function drawTable(doc, y, w, title, rows, cols) {
  doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text(title.toUpperCase(), MARGIN, y, { lineBreak: false });
  y += 14;

  const headerH = 16;
  doc.rect(MARGIN, y, w, headerH).fill(SLATE);
  doc.fillColor("#ffffff").fontSize(6.5).font("Helvetica-Bold");
  let x = MARGIN + 4;
  cols.forEach((col) => {
    if (col.align === "right") textRight(doc, col.label, x, y + 4, col.width - 8);
    else textAt(doc, col.label, x + 4, y + 4);
    x += col.width;
  });
  y += headerH;

  doc.font("Helvetica").fontSize(6.5).fillColor(INK);
  for (const row of rows.slice(0, 18)) {
    if (y > doc.page.height - MARGIN - 40) {
      doc.addPage();
      y = MARGIN;
    }
    doc.rect(MARGIN, y, w, 14).stroke(BORDER);
    x = MARGIN + 4;
    cols.forEach((col) => {
      const val = row[col.key] ?? "";
      const str = String(val).slice(0, col.max || 40);
      if (col.align === "right") textRight(doc, str, x, y + 3, col.width - 8);
      else textAt(doc, str, x + 4, y + 3);
      x += col.width;
    });
    y += 14;
  }
  return y + 8;
}

export function streamTresoreriePdf(res, data, organization) {
  const money = makeMoneyFormatters(organization?.devise);
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const w = pageWidth(doc);
  let y = MARGIN;
  const k = data.kpis || {};

  doc.rect(MARGIN, y, w, 48).fill(SLATE);
  doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text(
    organization?.nom || "Mon entreprise",
    MARGIN + 12,
    y + 12,
    { lineBreak: false }
  );
  doc.fillColor("#94a3b8").fontSize(7).font("Helvetica").text("TRÉSORERIE & PRÉVISIONS", MARGIN + w - 12, y + 12, {
    width: 140,
    align: "right",
    lineBreak: false,
  });
  doc.fillColor("#ffffff").fontSize(13).font("Helvetica-Bold").text("Situation de trésorerie", MARGIN + w - 12, y + 24, {
    width: 180,
    align: "right",
    lineBreak: false,
  });
  y += 58;

  doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(
    `Généré le ${fmtDate(new Date())} · ${data.region || "UEMOA"}`,
    MARGIN,
    y,
    { lineBreak: false }
  );
  y += 16;

  const kpis = [
    ["Solde actuel", money.fmt(k.soldeActuel)],
    ["Créances clients", money.fmt(k.creancesClients)],
    ["Dettes fournisseurs", money.fmt(k.dettesFournisseurs)],
    ["Position nette", money.fmt(k.positionNette)],
  ];
  const boxW = (w - 6) / 2;
  kpis.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (boxW + 6);
    const by = y + row * 46;
    doc.rect(x, by, boxW, 40).stroke(BORDER);
    doc.fillColor(MUTED).fontSize(6.5).font("Helvetica-Bold").text(label.toUpperCase(), x + 8, by + 8, { lineBreak: false });
    doc.fillColor(INK).fontSize(9).font("Helvetica-Bold").text(value, x + 8, by + 22, { lineBreak: false });
  });
  y += 96;

  const creanceRows = (data.creancesDetail || []).map((c) => ({
    libelle: c.libelle,
    tiers: c.client,
    date: fmtDate(c.dateEcheance || c.date),
    montant: money.fmtCell(c.montant),
    statut: c.enRetard ? "Retard" : "À venir",
  }));

  const detteRows = (data.dettesDetail || []).map((d) => ({
    libelle: (d.libelle || "").slice(0, 32),
    tiers: d.fournisseur,
    date: fmtDate(d.dateEcheance || d.date),
    montant: money.fmtCell(d.montant),
    statut: d.enRetard ? "Retard" : "À payer",
  }));

  const cols = [
    { key: "libelle", label: "Libellé", width: w * 0.34, max: 28 },
    { key: "tiers", label: "Tiers", width: w * 0.22, max: 18 },
    { key: "date", label: "Échéance", width: w * 0.16 },
    { key: "montant", label: "Montant", width: w * 0.16, align: "right" },
    { key: "statut", label: "Statut", width: w * 0.12, max: 10 },
  ];

  y = drawTable(doc, y, w, "Créances clients", creanceRows, cols);
  y = drawTable(doc, y, w, "Dettes & engagements", detteRows, cols);

  doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(
    `Horizons : 30j ${money.fmt(data.horizons?.j30)} · 60j ${money.fmt(data.horizons?.j60)} · 90j ${money.fmt(data.horizons?.j90)}`,
    MARGIN,
    y,
    { lineBreak: false }
  );

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - MARGIN - 6;
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(MARGIN, footerY - 12).lineTo(MARGIN + w, footerY - 12).stroke();
    doc.fillColor(MUTED).fontSize(6.5).font("Helvetica");
    doc.text(`Trésorerie · Page ${i - range.start + 1}/${range.count}`, MARGIN, footerY - 2, {
      width: w,
      align: "center",
      lineBreak: false,
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=tresorerie_${stamp}.pdf`);
  doc.pipe(res);
  doc.end();
}
