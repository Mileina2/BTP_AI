import PDFDocument from "pdfkit";
import { makeMoneyFormatters } from "./currency.js";
import { montantEnLettres } from "./montantEnLettres.js";

const MARGIN = 48;
const INK = "#1a1a1a";
const MUTED = "#4b5563";
const ACCENT = "#1e3a5f";
const SLATE = "#0f172a";
const BORDER = "#d1d5db";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function pageWidth(doc) {
  return doc.page.width - MARGIN * 2;
}

export function streamAvoirPdf(res, avoir, org) {
  const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
  const { fmt, currency } = makeMoneyFormatters(org?.devise || "XOF");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="avoir_${avoir.numero}.pdf"`);
  doc.pipe(res);

  const w = pageWidth(doc);
  let y = MARGIN;

  doc.fillColor(SLATE).fontSize(16).font("Helvetica-Bold").text("AVOIR / NOTE DE CRÉDIT", MARGIN, y);
  y += 22;
  doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(org?.nom || "", MARGIN, y);
  y += 14;
  if (org?.rccm) {
    doc.text(`RCCM : ${org.rccm}`, MARGIN, y);
    y += 12;
  }
  if (org?.compteContribuable) {
    doc.text(`N° CC : ${org.compteContribuable}`, MARGIN, y);
    y += 12;
  }

  doc.fillColor(ACCENT).fontSize(10).font("Helvetica-Bold").text(avoir.numero, MARGIN + w - 120, MARGIN, {
    width: 120,
    align: "right",
  });
  doc.fillColor(MUTED).fontSize(8).font("Helvetica").text(`Date : ${fmtDate(avoir.dateEmission)}`, MARGIN + w - 120, MARGIN + 16, {
    width: 120,
    align: "right",
  });

  y += 10;
  doc.strokeColor(BORDER).moveTo(MARGIN, y).lineTo(MARGIN + w, y).stroke();
  y += 16;

  const client = avoir.facture?.client;
  doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("CLIENT", MARGIN, y);
  doc.fillColor(INK).fontSize(9).font("Helvetica").text(client?.nom || "—", MARGIN + 42, y);
  y += 14;
  doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("FACTURE", MARGIN, y);
  doc.fillColor(INK).fontSize(9).font("Helvetica").text(avoir.facture?.numero || "—", MARGIN + 42, y);
  y += 20;

  if (avoir.motif) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("MOTIF", MARGIN, y);
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(avoir.motif, MARGIN + 42, y, { width: w - 42 });
    y += doc.heightOfString(avoir.motif, { width: w - 42 }) + 14;
  }

  doc.fillColor(SLATE).fontSize(7).font("Helvetica-Bold");
  doc.rect(MARGIN, y, w, 16).fill(SLATE);
  doc.fillColor("#fff").text("Désignation", MARGIN + 6, y + 4);
  doc.text("Montant HT", MARGIN + w - 140, y + 4, { width: 60, align: "right" });
  doc.text("TVA", MARGIN + w - 70, y + 4, { width: 30, align: "right" });
  y += 18;

  for (const l of avoir.lignes || []) {
    const ht = (l.quantite || 1) * (l.prixUnitaire || 0);
    doc.fillColor(INK).fontSize(8).font("Helvetica");
    doc.text(l.designation, MARGIN + 6, y + 4, { width: w - 160 });
    doc.text(fmt(ht), MARGIN + w - 140, y + 4, { width: 60, align: "right" });
    doc.text(`${l.tva ?? 18}%`, MARGIN + w - 70, y + 4, { width: 30, align: "right" });
    y += 18;
    doc.strokeColor(BORDER).moveTo(MARGIN, y).lineTo(MARGIN + w, y).stroke();
  }

  y += 12;
  const boxW = 220;
  const boxX = MARGIN + w - boxW;
  doc.rect(boxX, y, boxW, 56).stroke(BORDER);
  doc.fillColor(MUTED).fontSize(8).font("Helvetica").text("Total HT", boxX + 10, y + 8);
  doc.fillColor(INK).text(fmt(avoir.montantHT), boxX + 10, y + 8, { width: boxW - 20, align: "right" });
  doc.fillColor(MUTED).text("TVA", boxX + 10, y + 24);
  doc.fillColor(INK).text(fmt(avoir.montantTVA), boxX + 10, y + 24, { width: boxW - 20, align: "right" });
  doc.rect(boxX + 4, y + 38, boxW - 8, 16).fill(SLATE);
  doc.fillColor("#fff").font("Helvetica-Bold").text("TOTAL AVOIR TTC", boxX + 10, y + 42);
  doc.text(fmt(avoir.montantTTC), boxX + 10, y + 42, { width: boxW - 20, align: "right" });

  y += 70;
  const letters = montantEnLettres(avoir.montantTTC, currency.code === "XOF" ? "FCFA" : currency.symbol);
  doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(
    `Arrêté le présent avoir à la somme de : ${letters}.`,
    MARGIN,
    y,
    { width: w }
  );

  y += 30;
  doc.fillColor(MUTED).fontSize(6.5).font("Helvetica").text(
    "Document comptable de crédit — à conserver avec la facture d'origine. " +
      "En cas de litige, les tribunaux de Côte d'Ivoire sont seuls compétents.",
    MARGIN,
    y,
    { width: w }
  );

  doc.end();
}
