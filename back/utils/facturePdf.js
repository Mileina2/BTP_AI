import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { makeMoneyFormatters } from "./currency.js";
import { computeDevisAmounts, groupLignesBySection, shouldShowSections } from "./devisTotals.js";
import { montantEnLettres } from "./montantEnLettres.js";
const MARGIN = 48;
const FOOTER_H = 42;
const INK = "#1a1a1a";
const MUTED = "#4b5563";
const ACCENT = "#1e3a5f";
const SLATE = "#0f172a";
const BORDER = "#d1d5db";
const LINE = "#9ca3af";

const FACTURE_TYPE_LABEL = {
  INTEGRALE: "Facture intégrale",
  ACOMPTE: "Facture d'acompte",
  SOLDE: "Facture de solde",
};

const MODE_PAIEMENT_LABEL = {
  ESPECES: "Espèces",
  VIREMENT: "Virement bancaire",
  CHEQUE: "Chèque",
  MOBILE_MONEY: "Mobile Money",
};

function fmtNum(n) {
  return Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    .replace(/[\u202f\u00a0]/g, " ");
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

function textCenter(doc, str, x, y, w) {
  const s = str ?? "";
  const tw = doc.widthOfString(s);
  textAt(doc, s, x + (w - tw) / 2, y);
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function modePaiementLabel(facture) {
  const raw = facture.modePaiementRaw || facture.modePaiement;
  if (!raw) return null;
  return MODE_PAIEMENT_LABEL[raw] || raw;
}

function pageWidth(doc) {
  return doc.page.width - MARGIN * 2;
}

function contentBottom(doc) {
  return doc.page.height - MARGIN - FOOTER_H;
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

function hr(doc, y, w) {
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(MARGIN, y).lineTo(MARGIN + w, y).stroke();
}

function stampFooters(doc, state) {
  const range = doc.bufferedPageRange();
  const org = state.org;
  const legal = [
    org.nom,
    org.formeJuridique ? org.formeJuridique : null,
    org.capitalSocial ? `Capital ${org.capitalSocial}` : null,
    org.rccm ? `RCCM ${org.rccm}` : null,
    org.compteContribuable ? `N° CC ${org.compteContribuable}` : null,
    org.assuranceRc ? `RC ${org.assuranceRc}` : null,
    org.assuranceDecennale ? `Décennale ${org.assuranceDecennale}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const w = pageWidth(doc);
    const footerY = doc.page.height - MARGIN - 8;
    doc.save();
    hr(doc, footerY - 10, w);
    doc.fillColor(MUTED).fontSize(6.5).font("Helvetica");
    doc.text(legal, MARGIN, footerY - 2, { width: w, align: "center", lineBreak: false });
    doc.text(
      `Facture ${state.facture.numero} · Page ${i - range.start + 1}/${range.count}`,
      MARGIN,
      footerY + 8,
      { width: w, align: "center", lineBreak: false }
    );
    doc.restore();
  }
}

function drawHeader(doc, state) {
  const org = state.org;
  const facture = state.facture;
  const w = pageWidth(doc);
  const dateEmission = facture.dateEmission || facture.createdAt || new Date();
  const modeLabel = modePaiementLabel(facture);
  const bandH = 52;

  let y = MARGIN;
  doc.rect(MARGIN, y, w, bandH).fill(SLATE);
  const logoEnd = drawCompanyLogoBand(doc, org, MARGIN + 10, y + 8);
  const companyX = MARGIN + 10 + logoEnd + 6;

  doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text(org.nom || "Mon entreprise", companyX, y + 12, { width: w / 2, lineBreak: false });
  doc.fontSize(7).font("Helvetica").fillColor("#cbd5e1");
  const city = [org.ville, org.pays].filter(Boolean).join(", ");
  if (city) doc.text(city, companyX, y + 28, { lineBreak: false });

  doc.fillColor("#94a3b8").fontSize(6.5).font("Helvetica").text("DOCUMENT COMMERCIAL", MARGIN + w - 12, y + 10, { width: 120, align: "right", lineBreak: false });
  doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text("FACTURE", MARGIN + w - 12, y + 22, { width: 120, align: "right", lineBreak: false });

  y += bandH + 14;

  const metaW = 168;
  const metaX = MARGIN + w - metaW;
  doc.rect(metaX, y, metaW, modeLabel ? 72 : 64).stroke(BORDER);
  doc.fillColor(MUTED).fontSize(6.5).font("Helvetica-Bold").text("INFORMATIONS", metaX + 10, y + 8, { lineBreak: false });
  doc.fillColor(INK).fontSize(7.5).font("Helvetica");
  let my = y + 20;
  doc.text(`N° ${facture.numero}`, metaX + 10, my, { lineBreak: false });
  my += 11;
  doc.text(`Émission : ${fmtDate(dateEmission)}`, metaX + 10, my, { lineBreak: false });
  my += 11;
  doc.text(`Échéance : ${fmtDate(facture.dateEcheance)}`, metaX + 10, my, { lineBreak: false });
  my += 11;
  if (modeLabel) {
    doc.text(`Paiement : ${modeLabel}`, metaX + 10, my, { lineBreak: false });
    my += 11;
  }
  doc.fillColor(MUTED).text(`Devise : ${state.currency.label}`, metaX + 10, my, { lineBreak: false });

  state.y = Math.max(y + (modeLabel ? 72 : 64) + 10, my + 14);
}

function drawCompanyLogoBand(doc, org, x, y) {
  if (org.logoUrl && tryEmbedImage(doc, org.logoUrl, x, y, { fit: [36, 36] })) return 42;
  doc.rect(x, y, 36, 36).stroke("#94a3b8");
  const initials = (org.nom || "E")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text(initials, x, y + 12, { width: 36, align: "center", lineBreak: false });
  return 42;
}

function drawParties(doc, state) {
  const org = state.org;
  const client = state.facture.client || {};
  const w = pageWidth(doc);
  const colW = (w - 16) / 2;
  ensureSpace(doc, state, 88);
  const y = state.y;

  doc.fillColor(ACCENT).fontSize(7).font("Helvetica-Bold").text("ÉMETTEUR", MARGIN, y, { lineBreak: false });
  doc.text("DESTINATAIRE", MARGIN + colW + 16, y, { lineBreak: false });

  const bodyY = y + 12;
  doc.rect(MARGIN, bodyY, colW, 72).stroke(BORDER);
  doc.rect(MARGIN + colW + 16, bodyY, colW, 72).stroke(BORDER);

  doc.fillColor(INK).fontSize(9).font("Helvetica-Bold").text(org.nom || "—", MARGIN + 10, bodyY + 8, { width: colW - 20, lineBreak: false });
  doc.fontSize(7.5).font("Helvetica").fillColor(MUTED);
  let ey = bodyY + 22;
  if (org.adresse) {
    doc.text(org.adresse, MARGIN + 10, ey, { width: colW - 20 });
    ey += 10;
  }
  if (cityLine(org)) doc.text(cityLine(org), MARGIN + 10, ey, { lineBreak: false });
  ey += 10;
  const emitContact = [org.telephone, org.email].filter(Boolean).join(" · ");
  if (emitContact) doc.text(emitContact, MARGIN + 10, ey, { width: colW - 20, lineBreak: false });

  const cx = MARGIN + colW + 16;
  doc.fillColor(INK).fontSize(9).font("Helvetica-Bold").text(client.nom || "—", cx + 10, bodyY + 8, { width: colW - 20, lineBreak: false });
  doc.fontSize(7.5).font("Helvetica").fillColor(MUTED);
  let clientY = bodyY + 22;
  if (client.adresse) {
    doc.text(client.adresse, cx + 10, clientY, { width: colW - 20 });
    clientY += 10;
  }
  const clientContact = [client.telephone, client.email].filter(Boolean).join(" · ");
  if (clientContact) doc.text(clientContact, cx + 10, clientY, { width: colW - 20, lineBreak: false });

  state.y = bodyY + 84;
}

function cityLine(org) {
  return [org.ville, org.pays].filter(Boolean).join(", ");
}

function drawReferences(doc, state) {
  const facture = state.facture;
  const chantier = facture.chantier;
  const refDevis = facture.referenceDevis || facture.devis?.numero;
  const w = pageWidth(doc);
  ensureSpace(doc, state, 40);
  let y = state.y;

  if (facture.description) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("OBJET", MARGIN, y, { lineBreak: false });
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(facture.description, MARGIN + 42, y, { width: w - 42 });
    y += doc.heightOfString(facture.description, { width: w - 42 }) + 8;
  }
  const chantierNom = typeof chantier === "string" ? chantier : chantier?.nom;
  if (chantierNom) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("CHANTIER", MARGIN, y, { lineBreak: false });
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(chantierNom, MARGIN + 42, y, { width: w - 42, lineBreak: false });
    y += 14;
  }
  if (refDevis) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("REF. DEVIS", MARGIN, y, { lineBreak: false });
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(refDevis, MARGIN + 42, y, { width: w - 42, lineBreak: false });
    y += 14;
  }
  if (facture.referenceInterne) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("REF. DOSSIER", MARGIN, y, { lineBreak: false });
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(facture.referenceInterne, MARGIN + 42, y, { width: w - 42, lineBreak: false });
    y += 14;
  }
  if (facture.typeFacture && facture.typeFacture !== "INTEGRALE") {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("TYPE", MARGIN, y, { lineBreak: false });
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(FACTURE_TYPE_LABEL[facture.typeFacture] || facture.typeFacture, MARGIN + 42, y, { width: w - 42, lineBreak: false });
    y += 14;
  }
  doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("DEVISE", MARGIN, y, { lineBreak: false });
  doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(state.currency.label, MARGIN + 42, y, { lineBreak: false });

  state.y = y + 18;
}

function drawTable(doc, state) {
  const lignes = state.facture.lignes || [];
  const groups = groupLignesBySection(lignes);
  const showSections = shouldShowSections(groups);
  const w = pageWidth(doc);
  const cols = { num: 24, ref: 36, qty: 28, unit: 28, pu: 72, total: 72 };
  cols.desc = w - cols.num - cols.ref - cols.qty - cols.unit - cols.pu - cols.total;
  const colX = {
    num: MARGIN,
    ref: MARGIN + cols.num,
    desc: MARGIN + cols.num + cols.ref,
    qty: MARGIN + cols.num + cols.ref + cols.desc,
    unit: MARGIN + cols.num + cols.ref + cols.desc + cols.qty,
    pu: MARGIN + cols.num + cols.ref + cols.desc + cols.qty + cols.unit,
    total: MARGIN + cols.num + cols.ref + cols.desc + cols.qty + cols.unit + cols.pu,
  };
  const padY = 6;
  const headerH = 18;
  let lineIndex = 0;

  const drawHeaderRow = () => {
    ensureSpace(doc, state, headerH);
    const y = state.y;
    doc.rect(MARGIN, y, w, headerH).fill(SLATE).stroke(SLATE);
    doc.fillColor("#ffffff").fontSize(7).font("Helvetica-Bold");
    textAt(doc, "N°", colX.num + 4, y + padY);
    textAt(doc, "Réf", colX.ref + 2, y + padY);
    textAt(doc, "Désignation", colX.desc + 4, y + padY);
    textCenter(doc, "Qté", colX.qty, y + padY, cols.qty);
    textCenter(doc, "U", colX.unit, y + padY, cols.unit);
    textRight(doc, "P.U. HT", colX.pu, y + padY, cols.pu - 4);
    textRight(doc, "Total HT", colX.total, y + padY, cols.total - 4);
    state.y = y + headerH;
    resetCursor(doc, state.y);
    doc.font("Helvetica").fontSize(7.5).fillColor(INK);
  };

  const renderLine = (l) => {
    lineIndex += 1;
    const lineTotal = (l.quantite || 0) * (l.prixUnitaire || 0);
    const puStr = state.fmtCell(l.prixUnitaire);
    const totalStr = state.fmtCell(lineTotal);
    const descText = [l.designation, l.detailDescription].filter(Boolean).join("\n");
    const descH = doc.heightOfString(descText || "", { width: cols.desc - 8 });
    const rowH = Math.max(20, descH + 10);

    if (state.y + rowH > contentBottom(doc)) {
      doc.addPage();
      state.y = MARGIN;
      drawHeaderRow();
    }

    const y = state.y;
    doc.rect(MARGIN, y, w, rowH).stroke(BORDER);
    textAt(doc, String(lineIndex), colX.num + 4, y + padY);
    textAt(doc, (l.reference || "").slice(0, 8), colX.ref + 2, y + padY);
    doc.fillColor(INK).text(descText, colX.desc + 4, y + padY, { width: cols.desc - 8, lineBreak: false });
    resetCursor(doc, y + padY);
    doc.fillColor(MUTED);
    textCenter(doc, String(l.quantite ?? ""), colX.qty, y + padY, cols.qty);
    textCenter(doc, l.unite || "u", colX.unit, y + padY, cols.unit);
    textRight(doc, puStr, colX.pu, y + padY, cols.pu - 4);
    doc.fillColor(INK).font("Helvetica-Bold");
    textRight(doc, totalStr, colX.total, y + padY, cols.total - 4);
    doc.font("Helvetica").fontSize(7.5);
    state.y = y + rowH;
    resetCursor(doc, state.y);
  };

  drawHeaderRow();

  groups.forEach((group) => {
    if (showSections) {
      ensureSpace(doc, state, 16);
      doc.fillColor(ACCENT).fontSize(7).font("Helvetica-Bold").text(group.section.toUpperCase(), MARGIN + 4, state.y + 2, { lineBreak: false });
      state.y += 14;
    }
    group.lignes.forEach(renderLine);
  });

  state.y += 10;
}

function drawTotals(doc, state) {
  const facture = state.facture;
  const w = pageWidth(doc);
  const boxW = 250;
  const boxX = MARGIN + w - boxW;
  const amounts = computeDevisAmounts(
    facture.lignes || [],
    facture.tva,
    facture.remisePercent,
    facture.retenueGarantie
  );
  const hasRemise = amounts.montantRemise > 0;
  const tvaRows = amounts.tvaBreakdown?.length || 1;
  const hasRetenue = amounts.montantRetenue > 0;
  const acompteDeduit = Number(facture.acompteDeduit) || 0;
  const montantAvoir = Number(facture.montantAvoir) || 0;
  const montantVerse = Number(facture.montantVerse) || 0;
  const hasAcompte = acompteDeduit > 0;
  const hasAvoir = montantAvoir > 0;
  const hasVerse = montantVerse > 0;
  const netFinal = Math.max(0, (hasRetenue ? amounts.netAPayer : facture.montantTTC) - acompteDeduit - montantAvoir);
  const resteDu = Math.max(0, netFinal - montantVerse);
  const boxH =
    52 +
    (hasRemise ? 32 : 0) +
    tvaRows * 16 +
    (hasRetenue ? 32 : 0) +
    (hasAcompte ? 16 : 0) +
    (hasAvoir ? 16 : 0) +
    24 +
    (hasVerse ? 32 : 0) +
    (resteDu > 0 && hasVerse ? 16 : 0) +
    (facture.dateEcheance ? 12 : 0);

  ensureSpace(doc, state, boxH + 20);
  let y = state.y;

  doc.rect(boxX, y, boxW, boxH - (facture.dateEcheance ? 0 : 12)).stroke(BORDER);
  doc.fontSize(8).fillColor(MUTED).font("Helvetica");
  let rowY = y + 10;
  if (hasRemise) {
    textAt(doc, "Total HT brut", boxX + 10, rowY);
    textRight(doc, state.fmt(amounts.montantHTBrut), boxX + 10, rowY, boxW - 20);
    rowY += 16;
    textAt(doc, `Remise (${amounts.remisePercent}%)`, boxX + 10, rowY);
    textRight(doc, `- ${state.fmt(amounts.montantRemise)}`, boxX + 10, rowY, boxW - 20);
    rowY += 16;
  }
  textAt(doc, "Total HT", boxX + 10, rowY);
  textRight(doc, state.fmt(facture.montantHT), boxX + 10, rowY, boxW - 20);
  rowY += 16;
  for (const row of amounts.tvaBreakdown || [{ rate: facture.tva, montantTVA: facture.montantTVA }]) {
    textAt(doc, `TVA ${row.rate}%`, boxX + 10, rowY);
    textRight(doc, state.fmt(row.montantTVA), boxX + 10, rowY, boxW - 20);
    rowY += 16;
  }
  doc.rect(boxX + 6, rowY, boxW - 12, 22).fill(SLATE);
  doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
  textAt(doc, "TOTAL TTC", boxX + 14, rowY + 7);
  textRight(doc, state.fmt(facture.montantTTC), boxX + 10, rowY + 7, boxW - 20);
  rowY += 28;
  if (hasRetenue) {
    doc.fillColor(MUTED).fontSize(8).font("Helvetica");
    textAt(doc, `Retenue (${amounts.retenueGarantie}%)`, boxX + 10, rowY);
    textRight(doc, `- ${state.fmt(amounts.montantRetenue)}`, boxX + 10, rowY, boxW - 20);
    rowY += 16;
    doc.fillColor(INK).font("Helvetica-Bold");
    textAt(doc, "NET À PAYER", boxX + 10, rowY);
    textRight(doc, state.fmt(amounts.netAPayer), boxX + 10, rowY, boxW - 20);
    rowY += 16;
  }
  if (hasAcompte) {
    doc.fillColor(MUTED).fontSize(8).font("Helvetica");
    textAt(doc, "Acompte déjà facturé", boxX + 10, rowY);
    textRight(doc, `- ${state.fmt(acompteDeduit)}`, boxX + 10, rowY, boxW - 20);
    rowY += 16;
  }
  if (hasAvoir) {
    doc.fillColor(MUTED).fontSize(8).font("Helvetica");
    textAt(doc, "Avoir appliqué", boxX + 10, rowY);
    textRight(doc, `- ${state.fmt(montantAvoir)}`, boxX + 10, rowY, boxW - 20);
    rowY += 16;
  }
  if (hasAcompte || hasAvoir || hasRetenue) {
    doc.fillColor(INK).font("Helvetica-Bold");
    textAt(doc, "NET FINAL", boxX + 10, rowY);
    textRight(doc, state.fmt(netFinal), boxX + 10, rowY, boxW - 20);
    rowY += 16;
  }
  if (hasVerse) {
    doc.fillColor(MUTED).fontSize(8).font("Helvetica");
    textAt(doc, "Montant encaissé", boxX + 10, rowY);
    textRight(doc, state.fmt(montantVerse), boxX + 10, rowY, boxW - 20);
    rowY += 16;
    if (resteDu > 0.01) {
      doc.fillColor(ACCENT).font("Helvetica-Bold");
      textAt(doc, "RESTE DÛ", boxX + 10, rowY);
      textRight(doc, state.fmt(resteDu), boxX + 10, rowY, boxW - 20);
      rowY += 16;
    }
  }

  const net = netFinal;
  const letters = montantEnLettres(net, state.currency.label);
  doc.fillColor(MUTED).fontSize(6.5).font("Helvetica");
  doc.text(`Arrêté la présente facture à la somme de : ${letters}.`, MARGIN, y + boxH - 38, { width: w - boxW - 12 });

  if (facture.dateEcheance) {
    doc.fillColor(ACCENT).fontSize(7.5).font("Helvetica-Bold").text(
      `Échéance : ${fmtDate(facture.dateEcheance)}`,
      MARGIN,
      y + boxH - 18,
      { lineBreak: false }
    );
  }

  state.y = y + boxH + 8;
}

function drawPaymentBlock(doc, state) {
  const facture = state.facture;
  const org = state.org;
  const w = pageWidth(doc);
  ensureSpace(doc, state, 50);
  let y = state.y;

  doc.fillColor(ACCENT).fontSize(7.5).font("Helvetica-Bold").text("CONDITIONS DE PAIEMENT", MARGIN, y, { lineBreak: false });
  y += 12;
  doc.fillColor(INK).fontSize(7.5).font("Helvetica");

  const conditions = facture.conditions || "Paiement selon conditions convenues avec le client.";
  doc.text(conditions, MARGIN, y, { width: w });
  y += doc.heightOfString(conditions, { width: w }) + 8;

  if (org.banque || org.rib) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("COORDONNÉES BANCAIRES", MARGIN, y, { lineBreak: false });
    y += 10;
    doc.fillColor(INK).fontSize(7.5).font("Helvetica");
    if (org.banque) doc.text(`Banque : ${org.banque}`, MARGIN, y, { lineBreak: false });
    y += 10;
    if (org.rib) doc.text(`RIB / N° de compte : ${org.rib}`, MARGIN, y, { lineBreak: false });
    y += 12;
  }

  doc.fillColor(MUTED).fontSize(6.5).font("Helvetica");
  const penaltyRate = "1,5 % par mois";
  doc.text(
    "En cas de retard de paiement, des pénalités de retard au taux de " +
      penaltyRate +
      " du montant TTC seront appliquées conformément à la réglementation en vigueur en Côte d'Ivoire, " +
      "ainsi qu'une indemnité forfaitaire pour frais de recouvrement. " +
      "TVA acquittée sur les débits. Escompte pour paiement anticipé : néant sauf accord écrit. " +
      "Tribunal compétent : Côte d'Ivoire.",
    MARGIN,
    y,
    { width: w }
  );
  y += doc.heightOfString(
    "En cas de retard de paiement, des pénalités de retard au taux de " +
      penaltyRate +
      " du montant TTC seront appliquées conformément à la réglementation en vigueur en Côte d'Ivoire, " +
      "ainsi qu'une indemnité forfaitaire pour frais de recouvrement. " +
      "TVA acquittée sur les débits. Escompte pour paiement anticipé : néant sauf accord écrit. " +
      "Tribunal compétent : Côte d'Ivoire.",
    { width: w }
  ) + 8;

  if (org.formeJuridique || org.capitalSocial) {
    const ident = [org.formeJuridique, org.capitalSocial ? `Capital social : ${org.capitalSocial}` : null]
      .filter(Boolean)
      .join(" — ");
    doc.text(ident, MARGIN, y, { width: w });
    y += 12;
  }

  doc.text(
    "Document établi conformément aux exigences comptables — conservation obligatoire 10 ans.",
    MARGIN,
    y,
    { width: w }
  );
  state.y = y + 20;
}

export function buildFacturePdf(facture, organization) {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const money = makeMoneyFormatters(organization?.devise);
  const state = {
    facture,
    org: organization || {},
    y: MARGIN,
    ...money,
  };

  drawHeader(doc, state);
  drawParties(doc, state);
  drawReferences(doc, state);
  drawTable(doc, state);
  drawTotals(doc, state);
  drawPaymentBlock(doc, state);
  stampFooters(doc, state);

  return doc;
}

export function streamFacturePdf(res, facture, organization) {
  const doc = buildFacturePdf(facture, organization);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=facture_${facture.numero}.pdf`);
  doc.pipe(res);
  doc.end();
}

export function bufferFacturePdf(facture, organization) {
  return new Promise((resolve, reject) => {
    const doc = buildFacturePdf(facture, organization);
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
