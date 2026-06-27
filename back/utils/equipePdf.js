import PDFDocument from "pdfkit";
import { makeMoneyFormatters } from "./currency.js";

const MARGIN = 48;
const FOOTER_H = 36;
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

export function streamEquipePdf(res, chantier, membres, organization) {
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
  doc.fillColor("#94a3b8").fontSize(7).font("Helvetica").text("MASSE SALARIALE", MARGIN + w - 12, y + 12, {
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

  const total = membres.reduce((s, m) => s + (m.salaireTotal || 0), 0);
  const heures = membres.reduce((s, m) => s + (m.heuresMensuelles || 0), 0);

  doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(`Généré le ${fmtDate(new Date())}`, MARGIN, y, { lineBreak: false });
  y += 16;

  const kpis = [
    ["Membres actifs", String(membres.length)],
    ["Heures mensuelles", `${fmtNum(heures)} h`],
    ["Masse salariale", money.fmt(total)],
  ];
  const boxW = (w - 8) / 3;
  kpis.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxW + 4);
    doc.rect(x, y, boxW, 40).stroke(BORDER);
    doc.fillColor(MUTED).fontSize(6.5).font("Helvetica-Bold").text(label.toUpperCase(), x + 8, y + 8, { lineBreak: false });
    doc.fillColor(INK).fontSize(9).font("Helvetica-Bold").text(value, x + 8, y + 22, { lineBreak: false });
  });
  y += 52;

  const cols = { nom: 120, role: 90, heures: 52, taux: 68, total: 72 };
  cols.rest = w - cols.nom - cols.role - cols.heures - cols.taux - cols.total;
  const headerH = 18;

  doc.rect(MARGIN, y, w, headerH).fill(SLATE);
  doc.fillColor("#ffffff").fontSize(6.5).font("Helvetica-Bold");
  textAt(doc, "Nom", MARGIN + 6, y + 5);
  textAt(doc, "Rôle", MARGIN + cols.nom + 6, y + 5);
  textRight(doc, "Heures", MARGIN + cols.nom + cols.role, y + 5, cols.heures);
  textRight(doc, "Taux/h", MARGIN + cols.nom + cols.role + cols.heures, y + 5, cols.taux);
  textRight(doc, "Salaire", MARGIN + w - 6, y + 5, cols.total);
  y += headerH;

  doc.font("Helvetica").fontSize(7).fillColor(INK);
  membres.forEach((m) => {
    const rowH = 18;
    doc.rect(MARGIN, y, w, rowH).stroke(BORDER);
    textAt(doc, (m.nom || "").slice(0, 28), MARGIN + 6, y + 5);
    textAt(doc, (m.role || "").slice(0, 22), MARGIN + cols.nom + 6, y + 5);
    textRight(doc, `${fmtNum(m.heuresMensuelles || 0)} h`, MARGIN + cols.nom + cols.role, y + 5, cols.heures);
    textRight(doc, money.fmtCell(m.tauxHoraire || 0), MARGIN + cols.nom + cols.role + cols.heures, y + 5, cols.taux);
    doc.font("Helvetica-Bold");
    textRight(doc, money.fmtCell(m.salaireTotal || 0), MARGIN + w - 6, y + 5, cols.total);
    doc.font("Helvetica");
    y += rowH;
  });

  y += 10;
  doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text("TOTAL MASSE SALARIALE", MARGIN, y, { lineBreak: false });
  doc.fillColor(INK).fontSize(11).font("Helvetica-Bold").text(money.fmt(total), MARGIN + w - 120, y, {
    width: 120,
    align: "right",
    lineBreak: false,
  });

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - MARGIN - 6;
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(MARGIN, footerY - 12).lineTo(MARGIN + w, footerY - 12).stroke();
    doc.fillColor(MUTED).fontSize(6.5).font("Helvetica");
    doc.text(`Masse salariale · ${chantier.nom} · Page ${i - range.start + 1}/${range.count}`, MARGIN, footerY - 2, {
      width: w,
      align: "center",
      lineBreak: false,
    });
  }

  const slug = (chantier.nom || "chantier").replace(/[^\w\-]+/g, "_").slice(0, 40);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=masse_salariale_${slug}.pdf`);
  doc.pipe(res);
  doc.end();
}
