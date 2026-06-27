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
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function pageWidth(doc) {
  return doc.page.width - MARGIN * 2;
}

function resetCursor(doc, y) {
  doc.x = MARGIN;
  doc.y = y;
}

function textAt(doc, str, x, y, opts = {}) {
  doc.text(str ?? "", x, y, { lineBreak: false, ...opts });
  resetCursor(doc, y);
}

function textRight(doc, str, x, y, w) {
  const s = str ?? "";
  const tw = doc.widthOfString(s);
  textAt(doc, s, x + w - tw, y);
}

export function streamStockPdf(res, chantier, items, organization) {
  const money = makeMoneyFormatters(organization?.devise);
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const w = pageWidth(doc);
  let y = MARGIN;

  doc.rect(MARGIN, y, w, 48).fill(SLATE);
  doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text(
    organization?.nom || "Mon entreprise",
    MARGIN + 12,
    y + 12,
    { lineBreak: false }
  );
  doc.fillColor("#94a3b8").fontSize(7).font("Helvetica").text("INVENTAIRE STOCK", MARGIN + w - 12, y + 12, {
    width: 120,
    align: "right",
    lineBreak: false,
  });
  doc.fillColor("#ffffff").fontSize(14).font("Helvetica-Bold").text(chantier.nom || "Chantier", MARGIN + w - 12, y + 24, {
    width: 180,
    align: "right",
    lineBreak: false,
  });
  y += 60;

  const totalValeur = items.reduce((s, i) => s + (i.valeurTotale || 0), 0);
  const alertes = items.filter((i) => i.etat === "Alerte" || i.etat === "ALERTE").length;
  const ruptures = items.filter((i) => i.etat === "Rupture" || i.etat === "RUPTURE").length;

  doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(`Généré le ${fmtDate(new Date())}`, MARGIN, y, { lineBreak: false });
  y += 16;

  const kpis = [
    ["Articles", String(items.length)],
    ["Valeur totale", money.fmt(totalValeur)],
    ["Alertes", String(alertes)],
    ["Ruptures", String(ruptures)],
  ];
  const boxW = (w - 12) / 4;
  kpis.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxW + 4);
    doc.rect(x, y, boxW, 40).stroke(BORDER);
    doc.fillColor(MUTED).fontSize(6.5).font("Helvetica-Bold").text(label.toUpperCase(), x + 8, y + 8, { lineBreak: false });
    doc.fillColor(INK).fontSize(9).font("Helvetica-Bold").text(value, x + 8, y + 22, { lineBreak: false });
  });
  y += 52;

  const cols = { nom: 100, cat: 72, qte: 48, pu: 68, val: 72, etat: 52 };
  cols.rest = w - cols.nom - cols.cat - cols.qte - cols.pu - cols.val - cols.etat;
  const headerH = 18;

  doc.rect(MARGIN, y, w, headerH).fill(SLATE);
  doc.fillColor("#ffffff").fontSize(6.5).font("Helvetica-Bold");
  textAt(doc, "Article", MARGIN + 6, y + 5);
  textAt(doc, "Catégorie", MARGIN + cols.nom + 6, y + 5);
  textRight(doc, "Qté", MARGIN + cols.nom + cols.cat, y + 5, cols.qte);
  textRight(doc, "P.U.", MARGIN + cols.nom + cols.cat + cols.qte, y + 5, cols.pu);
  textRight(doc, "Valeur", MARGIN + cols.nom + cols.cat + cols.qte + cols.pu, y + 5, cols.val);
  textRight(doc, "État", MARGIN + w - 6, y + 5, cols.etat);
  y += headerH;

  doc.font("Helvetica").fontSize(7).fillColor(INK);
  items.forEach((item) => {
    const rowH = 18;
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = MARGIN;
    }
    doc.rect(MARGIN, y, w, rowH).stroke(BORDER);
    textAt(doc, (item.nom || "").slice(0, 24), MARGIN + 6, y + 5);
    textAt(doc, (item.categorie || "").slice(0, 18), MARGIN + cols.nom + 6, y + 5);
    textRight(doc, `${fmtNum(item.quantiteActuelle || 0)} ${item.unite || ""}`.trim(), MARGIN + cols.nom + cols.cat, y + 5, cols.qte);
    textRight(doc, money.fmtCell(item.prixUnitaire || 0), MARGIN + cols.nom + cols.cat + cols.qte, y + 5, cols.pu);
    doc.font("Helvetica-Bold");
    textRight(doc, money.fmtCell(item.valeurTotale || 0), MARGIN + cols.nom + cols.cat + cols.qte + cols.pu, y + 5, cols.val);
    doc.font("Helvetica");
    textRight(doc, (item.etat || "OK").slice(0, 10), MARGIN + w - 6, y + 5, cols.etat);
    y += rowH;
  });

  y += 10;
  doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text("VALEUR TOTALE STOCK", MARGIN, y, { lineBreak: false });
  doc.fillColor(INK).fontSize(11).font("Helvetica-Bold").text(money.fmt(totalValeur), MARGIN + w - 120, y, {
    width: 120,
    align: "right",
    lineBreak: false,
  });

  res.setHeader("Content-Type", "application/pdf");
  const slug = (chantier.nom || "chantier").replace(/[^\w\-]+/g, "_").slice(0, 40);
  res.setHeader("Content-Disposition", `attachment; filename=stock_${slug}.pdf`);
  doc.pipe(res);
  doc.end();
}
