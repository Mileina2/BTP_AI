import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
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

function contentBottom(doc) {
  return doc.page.height - MARGIN - FOOTER_H;
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
  textAt(doc, s, x + w - doc.widthOfString(s), y);
}

function tryEmbedImage(doc, dataOrPath, x, y, options) {
  try {
    if (!dataOrPath) return false;
    if (dataOrPath.startsWith("data:image")) {
      const base64 = dataOrPath.replace(/^data:image\/\w+;base64,/, "");
      doc.image(Buffer.from(base64, "base64"), x, y, options);
      return true;
    }
    if (dataOrPath.startsWith("http")) return false;
    const p = path.isAbsolute(dataOrPath) ? dataOrPath : path.join(process.cwd(), dataOrPath);
    if (fs.existsSync(p)) {
      doc.image(p, x, y, options);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function ensureSpace(doc, state, needed) {
  if (state.y + needed > contentBottom(doc)) {
    doc.addPage();
    state.y = MARGIN;
  }
}

function stampFooters(doc, state) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const w = pageWidth(doc);
    const footerY = doc.page.height - MARGIN - 6;
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(MARGIN, footerY - 12).lineTo(MARGIN + w, footerY - 12).stroke();
    doc.fillColor(MUTED).fontSize(6.5).font("Helvetica");
    doc.text(
      `Rapport de contrôle · ${state.chantier?.nom || "Projet"} · Page ${i - range.start + 1}/${range.count}`,
      MARGIN,
      footerY - 2,
      { width: w, align: "center", lineBreak: false }
    );
  }
}

function drawHeader(doc, state) {
  const org = state.org;
  const chantier = state.chantier;
  const w = pageWidth(doc);
  const bandH = 48;

  doc.rect(MARGIN, state.y, w, bandH).fill(SLATE);
  if (org.logoUrl) tryEmbedImage(doc, org.logoUrl, MARGIN + 10, state.y + 8, { fit: [32, 32] });

  doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text(
    org.nom || "Mon entreprise",
    MARGIN + 50,
    state.y + 14,
    { lineBreak: false }
  );
  doc.fillColor("#94a3b8").fontSize(7).font("Helvetica").text("RAPPORT DE CONTRÔLE", MARGIN + w - 10, state.y + 12, {
    width: 120,
    align: "right",
    lineBreak: false,
  });
  doc.fillColor("#ffffff").fontSize(14).font("Helvetica-Bold").text(chantier.nom || "Chantier", MARGIN + w - 10, state.y + 24, {
    width: 180,
    align: "right",
    lineBreak: false,
  });

  state.y += bandH + 16;

  const resume = state.resume;
  const boxW = (w - 12) / 4;
  const labels = [
    ["Budget prévisionnel", state.fmt(resume.budget)],
    ["Total dépensé", state.fmt(resume.depenses)],
    ["Reste disponible", state.fmt(resume.restant)],
    ["Consommation", `${resume.pourcentage}%`],
  ];

  labels.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxW + 4);
    doc.rect(x, state.y, boxW, 42).stroke(BORDER);
    doc.fillColor(MUTED).fontSize(6.5).font("Helvetica-Bold").text(label.toUpperCase(), x + 8, state.y + 8, {
      width: boxW - 16,
      lineBreak: false,
    });
    doc.fillColor(resume.depasse && i === 2 ? "#dc2626" : INK).fontSize(9).font("Helvetica-Bold").text(value, x + 8, state.y + 22, {
      width: boxW - 16,
      lineBreak: false,
    });
  });

  state.y += 54;
  doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(`Généré le ${fmtDate(new Date())}`, MARGIN, state.y, {
    lineBreak: false,
  });
  state.y += 16;
}

function drawTable(doc, state) {
  const depenses = state.depenses || [];
  const w = pageWidth(doc);
  const cols = { date: 58, cat: 62, qty: 28, unit: 28, pu: 58, total: 62 };
  cols.lib = w - cols.date - cols.cat - cols.qty - cols.unit - cols.pu - cols.total;
  const colX = {
    date: MARGIN,
    lib: MARGIN + cols.date,
    cat: MARGIN + cols.date + cols.lib,
    qty: MARGIN + cols.date + cols.lib + cols.cat,
    unit: MARGIN + cols.date + cols.lib + cols.cat + cols.qty,
    pu: MARGIN + cols.date + cols.lib + cols.cat + cols.qty + cols.unit,
    total: MARGIN + cols.date + cols.lib + cols.cat + cols.qty + cols.unit + cols.pu,
  };
  const headerH = 18;
  const padY = 5;

  const drawHeaderRow = () => {
    ensureSpace(doc, state, headerH + 4);
    const y = state.y;
    doc.rect(MARGIN, y, w, headerH).fill(SLATE);
    doc.fillColor("#ffffff").fontSize(6.5).font("Helvetica-Bold");
    textAt(doc, "Date", colX.date + 4, y + padY);
    textAt(doc, "Libellé", colX.lib + 4, y + padY);
    textAt(doc, "Catégorie", colX.cat + 4, y + padY);
    textAt(doc, "Qté", colX.qty + 4, y + padY);
    textAt(doc, "U.", colX.unit + 4, y + padY);
    textRight(doc, "P.U.", colX.pu, y + padY, cols.pu - 4);
    textRight(doc, "Montant", colX.total, y + padY, cols.total - 4);
    state.y = y + headerH;
    resetCursor(doc, state.y);
    doc.font("Helvetica").fontSize(7).fillColor(INK);
  };

  drawHeaderRow();

  depenses.forEach((d) => {
    const rowH = 20;
    if (state.y + rowH > contentBottom(doc)) {
      doc.addPage();
      state.y = MARGIN;
      drawHeaderRow();
    }
    const y = state.y;
    doc.rect(MARGIN, y, w, rowH).stroke(BORDER);
    textAt(doc, fmtDate(d.date), colX.date + 4, y + padY);
    doc.text((d.libelle || "").slice(0, 42), colX.lib + 4, y + padY, { width: cols.lib - 8, lineBreak: false });
    resetCursor(doc, y + padY);
    doc.fillColor(MUTED);
    textAt(doc, (d.categorie || "").slice(0, 12), colX.cat + 4, y + padY);
    textAt(doc, String(d.quantite ?? 1), colX.qty + 4, y + padY);
    textAt(doc, d.unite || "u", colX.unit + 4, y + padY);
    textRight(doc, fmtNum(d.prixUnitaire || 0), colX.pu, y + padY, cols.pu - 4);
    doc.fillColor(INK).font("Helvetica-Bold");
    textRight(doc, fmtNum(d.montant || 0), colX.total, y + padY, cols.total - 4);
    doc.font("Helvetica").fontSize(7);
    state.y = y + rowH;
    resetCursor(doc, state.y);
  });

  state.y += 8;
}

function drawFinancialSummary(doc, state) {
  const controle = state.controle;
  if (!controle) return;

  const w = pageWidth(doc);
  ensureSpace(doc, state, 50);
  const y = state.y;

  const rows = [
    ["Encaissements", state.fmt(controle.encaisse || 0)],
    ["Marge opérationnelle", state.fmt(controle.margeOperationnelle || 0)],
    ["Engagements non soldés", state.fmt(controle.engageNonPaye || 0)],
    ["Écart budgétaire", state.fmt(controle.ecart || 0)],
  ];

  if (controle.forecastFinal) {
    rows.push(["Projection fin de projet", state.fmt(controle.forecastFinal)]);
  }

  doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("SYNTHÈSE FINANCIÈRE", MARGIN, y, { lineBreak: false });
  let ry = y + 14;
  doc.font("Helvetica").fontSize(7.5).fillColor(INK);
  rows.forEach(([label, value]) => {
    doc.fillColor(MUTED).text(label, MARGIN, ry, { lineBreak: false });
    doc.fillColor(INK).font("Helvetica-Bold").text(value, MARGIN + w - 120, ry, { width: 120, align: "right", lineBreak: false });
    doc.font("Helvetica");
    ry += 12;
  });

  state.y = ry + 8;
}

export function buildBudgetPdf(chantier, depenses, organization, resume, controle) {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const money = makeMoneyFormatters(organization?.devise);
  const state = {
    chantier,
    depenses,
    org: organization || {},
    resume,
    controle,
    y: MARGIN,
    ...money,
  };

  drawHeader(doc, state);
  drawFinancialSummary(doc, state);
  drawTable(doc, state);
  stampFooters(doc, state);

  return doc;
}

export function streamBudgetPdf(res, chantier, depenses, organization, resume, controle) {
  const doc = buildBudgetPdf(chantier, depenses, organization, resume, controle);
  const slug = (chantier.nom || "chantier").replace(/[^\w\-]+/g, "_").slice(0, 40);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=controle_budget_${slug}.pdf`);
  doc.pipe(res);
  doc.end();
}

function drawConsolidatedHeader(doc, state) {
  const org = state.org;
  const stats = state.stats;
  const w = pageWidth(doc);
  const bandH = 48;

  doc.rect(MARGIN, state.y, w, bandH).fill(SLATE);
  if (org.logoUrl) tryEmbedImage(doc, org.logoUrl, MARGIN + 10, state.y + 8, { fit: [32, 32] });

  doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text(org.nom || "Mon entreprise", MARGIN + 50, state.y + 14, { lineBreak: false });
  doc.fillColor("#94a3b8").fontSize(7).font("Helvetica").text("RAPPORT DE CONTRÔLE CONSOLIDÉ", MARGIN + w - 10, state.y + 12, {
    width: 160,
    align: "right",
    lineBreak: false,
  });
  doc.fillColor("#ffffff").fontSize(13).font("Helvetica-Bold").text("Portefeuille projets", MARGIN + w - 10, state.y + 24, {
    width: 160,
    align: "right",
    lineBreak: false,
  });

  state.y += bandH + 16;

  const boxW = (w - 16) / 5;
  const kpis = [
    ["BP consolidé", state.fmt(stats.budgetTotal)],
    ["Charges réelles", state.fmt(stats.depensesTotal)],
    ["Écart global", state.fmt(stats.ecartGlobal)],
    ["Encaissements", state.fmt(stats.encaisseTotal)],
    ["Marge globale", state.fmt(stats.margeGlobale)],
  ];

  kpis.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxW + 4);
    doc.rect(x, state.y, boxW, 40).stroke(BORDER);
    doc.fillColor(MUTED).fontSize(6).font("Helvetica-Bold").text(label.toUpperCase(), x + 6, state.y + 7, { width: boxW - 12, lineBreak: false });
    doc.fillColor(INK).fontSize(8).font("Helvetica-Bold").text(value, x + 6, state.y + 20, { width: boxW - 12, lineBreak: false });
  });

  state.y += 52;
  doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(`Généré le ${fmtDate(new Date())}`, MARGIN, state.y, { lineBreak: false });
  state.y += 16;
}

function textCenter(doc, str, x, y, w) {
  const s = str ?? "";
  textAt(doc, s, x + (w - doc.widthOfString(s)) / 2, y);
}

function drawPortfolioTable(doc, state) {
  const chantiers = state.chantiers || [];
  const w = pageWidth(doc);
  const cols = { nom: 120, bp: 68, charges: 68, ecart: 68, marge: 68, conso: 42 };
  cols.nom = w - cols.bp - cols.charges - cols.ecart - cols.marge - cols.conso;
  const colX = {
    nom: MARGIN,
    bp: MARGIN + cols.nom,
    charges: MARGIN + cols.nom + cols.bp,
    ecart: MARGIN + cols.nom + cols.bp + cols.charges,
    marge: MARGIN + cols.nom + cols.bp + cols.charges + cols.ecart,
    conso: MARGIN + cols.nom + cols.bp + cols.charges + cols.ecart + cols.marge,
  };
  const headerH = 18;
  const padY = 5;

  const drawHeaderRow = () => {
    ensureSpace(doc, state, headerH + 4);
    const y = state.y;
    doc.rect(MARGIN, y, w, headerH).fill(SLATE);
    doc.fillColor("#ffffff").fontSize(6.5).font("Helvetica-Bold");
    textAt(doc, "Projet", colX.nom + 4, y + padY);
    textRight(doc, "BP", colX.bp, y + padY, cols.bp - 4);
    textRight(doc, "Charges", colX.charges, y + padY, cols.charges - 4);
    textRight(doc, "Écart", colX.ecart, y + padY, cols.ecart - 4);
    textRight(doc, "Marge", colX.marge, y + padY, cols.marge - 4);
    textCenter(doc, "Conso.", colX.conso, y + padY, cols.conso);
    state.y = y + headerH;
    resetCursor(doc, state.y);
    doc.font("Helvetica").fontSize(7).fillColor(INK);
  };

  drawHeaderRow();

  chantiers.forEach((c) => {
    const rowH = 18;
    if (state.y + rowH > contentBottom(doc)) {
      doc.addPage();
      state.y = MARGIN;
      drawHeaderRow();
    }
    const y = state.y;
    doc.rect(MARGIN, y, w, rowH).stroke(BORDER);
    textAt(doc, (c.nom || "").slice(0, 38), colX.nom + 4, y + padY);
    textRight(doc, fmtNum(c.budget || 0), colX.bp, y + padY, cols.bp - 4);
    textRight(doc, fmtNum(c.depenses || 0), colX.charges, y + padY, cols.charges - 4);
    doc.fillColor((c.ecart ?? c.depenses - c.budget) > 0 ? "#dc2626" : INK);
    textRight(doc, fmtNum(c.ecart ?? (c.depenses || 0) - (c.budget || 0)), colX.ecart, y + padY, cols.ecart - 4);
    doc.fillColor(INK);
    textRight(doc, fmtNum(c.margeOperationnelle || 0), colX.marge, y + padY, cols.marge - 4);
    textAt(doc, `${c.pourcentage ?? 0}%`, colX.conso + 8, y + padY);
    state.y = y + rowH;
    resetCursor(doc, state.y);
  });

  state.y += 8;
}

export function streamBudgetConsolidatedPdf(res, overview, organization) {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const money = makeMoneyFormatters(organization?.devise);
  const state = {
    org: organization || {},
    stats: overview.stats,
    chantiers: overview.chantiers,
    y: MARGIN,
    ...money,
  };

  drawConsolidatedHeader(doc, state);
  drawPortfolioTable(doc, state);

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const w = pageWidth(doc);
    const footerY = doc.page.height - MARGIN - 6;
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(MARGIN, footerY - 12).lineTo(MARGIN + w, footerY - 12).stroke();
    doc.fillColor(MUTED).fontSize(6.5).font("Helvetica");
    doc.text(`Rapport de contrôle consolidé · Page ${i - range.start + 1}/${range.count}`, MARGIN, footerY - 2, {
      width: w,
      align: "center",
      lineBreak: false,
    });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=controle_budget_consolide.pdf");
  doc.pipe(res);
  doc.end();
}
