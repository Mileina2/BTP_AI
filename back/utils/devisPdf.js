import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { makeMoneyFormatters } from "./currency.js";
import { groupLignesBySection, shouldShowSections, computeDevisAmounts } from "./devisTotals.js";
import { montantEnLettres } from "./montantEnLettres.js";

const MARGIN = 48;
const FOOTER_H = 42;
const INK = "#1a1a1a";
const MUTED = "#4b5563";
const ACCENT = "#1e3a5f";
const BORDER = "#d1d5db";
const LINE = "#9ca3af";

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
      `Devis ${state.devis.numero} · Page ${i - range.start + 1}/${range.count}`,
      MARGIN,
      footerY + 8,
      { width: w, align: "center", lineBreak: false }
    );
    doc.restore();
  }
}

function drawCompanyLogo(doc, org, x, y) {
  if (org.logoUrl && tryEmbedImage(doc, org.logoUrl, x, y, { fit: [56, 56] })) return 60;
  doc.rect(x, y, 48, 48).stroke(ACCENT);
  const initials = (org.nom || "E")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  doc.fillColor(ACCENT).fontSize(14).font("Helvetica-Bold").text(initials, x, y + 16, { width: 48, align: "center", lineBreak: false });
  return 58;
}

function drawHeader(doc, state) {
  const org = state.org;
  const devis = state.devis;
  const w = pageWidth(doc);
  const dateEmission = devis.dateEmission || devis.createdAt || new Date();
  const expireLe = new Date(dateEmission);
  expireLe.setDate(expireLe.getDate() + (devis.validite || 30));

  let y = MARGIN;
  const logoEnd = drawCompanyLogo(doc, org, MARGIN, y);
  const companyX = MARGIN + logoEnd + 8;

  doc.fillColor(INK).fontSize(13).font("Helvetica-Bold").text(org.nom || "Mon entreprise", companyX, y, { width: w / 2, lineBreak: false });
  doc.fontSize(7.5).font("Helvetica").fillColor(MUTED);
  let cy = y + 16;
  if (org.adresse) {
    doc.text(org.adresse, companyX, cy, { width: w / 2, lineBreak: false });
    cy += 10;
  }
  const city = [org.ville, org.pays].filter(Boolean).join(", ");
  if (city) {
    doc.text(city, companyX, cy, { lineBreak: false });
    cy += 10;
  }
  if (org.telephone) {
    doc.text(`Tél. ${org.telephone}`, companyX, cy, { lineBreak: false });
    cy += 10;
  }
  if (org.email) {
    doc.text(org.email, companyX, cy, { lineBreak: false });
    cy += 10;
  }
  if (org.rccm) {
    doc.text(`RCCM : ${org.rccm}`, companyX, cy, { lineBreak: false });
    cy += 10;
  }
  if (org.compteContribuable) {
    doc.text(`N° Compte contribuable : ${org.compteContribuable}`, companyX, cy, { lineBreak: false });
  }

  const boxW = 185;
  const boxX = MARGIN + w - boxW;
  const boxH = devis.parentDevis?.numero ? 102 : devis.version > 1 ? 90 : 78;
  doc.rect(boxX, y, boxW, boxH).stroke(BORDER);
  doc.fillColor(ACCENT).fontSize(16).font("Helvetica-Bold").text("DEVIS", boxX + 12, y + 10, { lineBreak: false });
  doc.fillColor(INK).fontSize(8).font("Helvetica");
  doc.text(`N° ${devis.numero}`, boxX + 12, y + 32, { lineBreak: false });
  let metaY = y + 44;
  if (devis.version > 1) {
    doc.text(`Version ${devis.version}`, boxX + 12, metaY, { lineBreak: false });
    metaY += 12;
  }
  if (devis.parentDevis?.numero) {
    doc.text(`Réf. initiale : ${devis.parentDevis.numero}`, boxX + 12, metaY, { lineBreak: false });
    metaY += 12;
  }
  doc.text(`Date d'émission : ${fmtDate(dateEmission)}`, boxX + 12, metaY, { lineBreak: false });
  metaY += 12;
  doc.text(`Durée de validité : ${devis.validite || 30} jours`, boxX + 12, metaY, { lineBreak: false });
  metaY += 12;
  doc.text(`Date d'expiration : ${fmtDate(expireLe)}`, boxX + 12, metaY, { lineBreak: false });

  state.y = Math.max(y + 88, cy + 12, metaY + 10);
  hr(doc, state.y, w);
  state.y += 14;
}

function drawParties(doc, state) {
  const org = state.org;
  const client = state.devis.client || {};
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
  let cy = bodyY + 22;
  if (client.adresse) {
    doc.text(client.adresse, cx + 10, cy, { width: colW - 20 });
    cy += 10;
  }
  const clientContact = [client.telephone, client.email].filter(Boolean).join(" · ");
  if (clientContact) doc.text(clientContact, cx + 10, cy, { width: colW - 20, lineBreak: false });

  state.y = bodyY + 84;
}

function cityLine(org) {
  return [org.ville, org.pays].filter(Boolean).join(", ");
}

function drawReferences(doc, state) {
  const devis = state.devis;
  const chantier = devis.chantier;
  const w = pageWidth(doc);
  ensureSpace(doc, state, 40);
  let y = state.y;

  if (devis.description) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("OBJET", MARGIN, y, { lineBreak: false });
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(devis.description, MARGIN + 42, y, { width: w - 42 });
    y += doc.heightOfString(devis.description, { width: w - 42 }) + 8;
  }
  if (chantier?.nom) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("CHANTIER", MARGIN, y, { lineBreak: false });
    const chantierLine = [chantier.nom, chantier.adresse, [chantier.ville, chantier.pays].filter(Boolean).join(", ")]
      .filter(Boolean)
      .join(" — ");
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(chantierLine, MARGIN + 42, y, { width: w - 42 });
    y += doc.heightOfString(chantierLine, { width: w - 42 }) + 8;
  }
  if (devis.delaiExecution) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("DÉLAI", MARGIN, y, { lineBreak: false });
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(devis.delaiExecution, MARGIN + 42, y, { width: w - 42, lineBreak: false });
    y += 14;
  }
  if (devis.referenceInterne) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("RÉF. DOSSIER", MARGIN, y, { lineBreak: false });
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(devis.referenceInterne, MARGIN + 42, y, { lineBreak: false });
    y += 14;
  }
  if (devis.retenueGarantie) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("RETENUE", MARGIN, y, { lineBreak: false });
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(`${devis.retenueGarantie}% retenue de garantie`, MARGIN + 42, y, { lineBreak: false });
    y += 14;
  }
  if (devis.acomptePercent) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("ACOMPTE", MARGIN, y, { lineBreak: false });
    doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(`${devis.acomptePercent}% à la signature`, MARGIN + 42, y, { lineBreak: false });
    y += 14;
  }
  doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("DEVISE", MARGIN, y, { lineBreak: false });
  doc.fillColor(INK).fontSize(8.5).font("Helvetica").text(state.currency.label, MARGIN + 42, y, { lineBreak: false });

  state.y = y + 18;
}

function drawTable(doc, state) {
  const lignes = state.devis.lignes || [];
  const mainGroups = groupLignesBySection(lignes);
  const optionGroups = groupLignesBySection(lignes, { optionsOnly: true });
  const showSections = shouldShowSections(mainGroups);
  const w = pageWidth(doc);
  const cols = { num: 24, qty: 30, unit: 32, pu: 88, total: 88 };
  cols.desc = w - cols.num - cols.qty - cols.unit - cols.pu - cols.total;
  const colX = {
    num: MARGIN,
    desc: MARGIN + cols.num,
    qty: MARGIN + cols.num + cols.desc,
    unit: MARGIN + cols.num + cols.desc + cols.qty,
    pu: MARGIN + cols.num + cols.desc + cols.qty + cols.unit,
    total: MARGIN + cols.num + cols.desc + cols.qty + cols.unit + cols.pu,
  };
  const padY = 6;
  const headerH = 18;
  let lineIndex = 0;

  const drawHeaderRow = () => {
    ensureSpace(doc, state, headerH);
    const y = state.y;
    doc.rect(MARGIN, y, w, headerH).fill("#f8fafc").stroke(BORDER);
    doc.fillColor(ACCENT).fontSize(7).font("Helvetica-Bold");
    textAt(doc, "N°", colX.num + 4, y + padY);
    textAt(doc, "Désignation des prestations", colX.desc + 4, y + padY);
    textCenter(doc, "Qté", colX.qty, y + padY, cols.qty);
    textCenter(doc, "Unité", colX.unit, y + padY, cols.unit);
    textRight(doc, "P.U. HT", colX.pu, y + padY, cols.pu - 6);
    textRight(doc, "Total HT", colX.total, y + padY, cols.total - 6);
    state.y = y + headerH;
    resetCursor(doc, state.y);
    doc.font("Helvetica").fontSize(7.5).fillColor(INK);
  };

  const drawDataRow = (cells, rowH, boldTotal = false) => {
    if (state.y + rowH > contentBottom(doc)) {
      doc.addPage();
      state.y = MARGIN;
      drawHeaderRow();
    }
    const y = state.y;
    doc.rect(MARGIN, y, w, rowH).stroke(BORDER);
    textAt(doc, cells.num, colX.num + 4, y + padY);
    doc.fillColor(cells.muted ? MUTED : INK);
    if (cells.descWidth) {
      doc.text(cells.desc, colX.desc + 4, y + padY, { width: cells.descWidth, lineBreak: false });
      resetCursor(doc, y + padY);
    } else {
      textAt(doc, cells.desc, colX.desc + 4, y + padY);
    }
    textCenter(doc, cells.qty, colX.qty, y + padY, cols.qty);
    textCenter(doc, cells.unit, colX.unit, y + padY, cols.unit);
    textRight(doc, cells.pu, colX.pu, y + padY, cols.pu - 6);
    doc.fillColor(boldTotal ? INK : MUTED).font(boldTotal ? "Helvetica-Bold" : "Helvetica");
    textRight(doc, cells.total, colX.total, y + padY, cols.total - 6);
    doc.font("Helvetica").fontSize(7.5);
    state.y = y + rowH;
    resetCursor(doc, state.y);
  };

  const renderGroups = (groups, { startIndex = 0, optionBlock = false } = {}) => {
    let idx = startIndex;
    groups.forEach((group) => {
      if (showSections || optionBlock) {
        const sectionH = 16;
        ensureSpace(doc, state, sectionH);
        const y = state.y;
        doc.rect(MARGIN, y, w, sectionH).fill(optionBlock ? "#fff7ed" : "#eef2ff").stroke(BORDER);
        doc.fillColor(ACCENT).fontSize(7.5).font("Helvetica-Bold").text(group.section.toUpperCase(), MARGIN + 6, y + 4, { lineBreak: false });
        state.y = y + sectionH;
      }

      group.lignes.forEach((l) => {
        idx += 1;
        const lineTotalVal = (l.quantite || 0) * (l.prixUnitaire || 0);
        let designation = l.reference ? `[${l.reference}] ${l.designation || ""}` : l.designation || "";
        if (l.detailDescription) designation += `\n${l.detailDescription}`;
        const puStr = state.fmtCell(l.prixUnitaire);
        const totalStr = optionBlock ? `${state.fmtCell(lineTotalVal)} *` : state.fmtCell(lineTotalVal);
        const descH = doc.heightOfString(designation, { width: cols.desc - 8 });
        const rowH = Math.max(20, descH + 10);
        drawDataRow(
          {
            num: String(idx),
            desc: designation,
            descWidth: cols.desc - 8,
            qty: String(l.quantite ?? ""),
            unit: l.unite || "u",
            pu: puStr,
            total: totalStr,
          },
          rowH,
          !optionBlock
        );
      });

      if (showSections && !optionBlock) {
        drawDataRow(
          {
            num: "",
            desc: `Sous-total ${group.section}`,
            qty: "",
            unit: "",
            pu: "",
            total: state.fmtCell(group.subtotal),
            muted: true,
          },
          16,
          true
        );
      }
    });
    return idx;
  };

  drawHeaderRow();
  lineIndex = renderGroups(mainGroups);
  if (optionGroups.length) {
    renderGroups(optionGroups, { startIndex: lineIndex, optionBlock: true });
  }

  state.y += 10;
}

function drawTotals(doc, state) {
  const devis = state.devis;
  const w = pageWidth(doc);
  const boxW = 250;
  const boxX = MARGIN + w - boxW;
  const amounts = computeDevisAmounts(devis.lignes || [], devis.tva, devis.remisePercent, devis.retenueGarantie);
  const hasRemise = amounts.montantRemise > 0;
  const tvaRows = amounts.tvaBreakdown?.length || 1;
  const hasRetenue = amounts.montantRetenue > 0;
  const boxH = 52 + (hasRemise ? 32 : 0) + tvaRows * 16 + (hasRetenue ? 32 : 0) + 24;

  ensureSpace(doc, state, boxH + 40);
  let y = state.y;

  doc.rect(boxX, y, boxW, boxH).stroke(BORDER);
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
  textRight(doc, state.fmt(devis.montantHT), boxX + 10, rowY, boxW - 20);
  rowY += 16;
  for (const row of amounts.tvaBreakdown || [{ rate: devis.tva, montantTVA: devis.montantTVA }]) {
    textAt(doc, `TVA ${row.rate}%`, boxX + 10, rowY);
    textRight(doc, state.fmt(row.montantTVA), boxX + 10, rowY, boxW - 20);
    rowY += 16;
  }
  doc.rect(boxX + 6, rowY, boxW - 12, 22).fill(ACCENT);
  doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
  textAt(doc, "TOTAL TTC", boxX + 14, rowY + 7);
  textRight(doc, state.fmt(devis.montantTTC), boxX + 10, rowY + 7, boxW - 20);
  rowY += 28;
  if (hasRetenue) {
    doc.fillColor(MUTED).fontSize(8).font("Helvetica");
    textAt(doc, `Retenue de garantie (${amounts.retenueGarantie}%)`, boxX + 10, rowY);
    textRight(doc, `- ${state.fmt(amounts.montantRetenue)}`, boxX + 10, rowY, boxW - 20);
    rowY += 16;
    doc.fillColor(INK).font("Helvetica-Bold");
    textAt(doc, "Net à payer", boxX + 10, rowY);
    textRight(doc, state.fmt(amounts.netAPayer), boxX + 10, rowY, boxW - 20);
  }

  const letters = montantEnLettres(hasRetenue ? amounts.netAPayer : devis.montantTTC, state.currency.label);
  doc.fillColor(MUTED).fontSize(6.5).font("Helvetica");
  doc.text(`Arrêté le présent devis à la somme de : ${letters}.`, MARGIN, y + boxH + 8, { width: w });

  let noteY = y + boxH + 22;
  if (devis.acomptePercent) {
    const base = hasRetenue ? amounts.netAPayer : devis.montantTTC;
    const acompte = (base * devis.acomptePercent) / 100;
    doc.font("Helvetica").fontSize(7).text(
      `Acompte à la signature (${devis.acomptePercent}%) : ${state.fmt(acompte)}`,
      MARGIN,
      noteY,
      { width: w, lineBreak: false }
    );
    noteY += 14;
  }
  if (amounts.optionsHT > 0) {
    doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(
      `* Options et variantes (hors total) : ${state.fmt(amounts.optionsHT)} HT`,
      MARGIN,
      noteY,
      { width: w, lineBreak: false }
    );
  }

  state.y = noteY + 20;
}

function drawPaymentBlock(doc, state) {
  const devis = state.devis;
  const org = state.org;
  const w = pageWidth(doc);
  ensureSpace(doc, state, 50);
  let y = state.y;

  doc.fillColor(ACCENT).fontSize(7.5).font("Helvetica-Bold").text("CONDITIONS ET MODALITÉS", MARGIN, y, { lineBreak: false });
  y += 12;
  doc.fillColor(INK).fontSize(7.5).font("Helvetica");

  const conditions = devis.conditions || "Paiement selon conditions convenues avec le client.";
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
  doc.text(
    "TVA en sus selon taux en vigueur. Ce devis vaut bon de commande après signature et cachet du client.",
    MARGIN,
    y,
    { width: w }
  );
  state.y = y + 20;
}

function drawSignatures(doc, state) {
  const devis = state.devis;
  const org = state.org;
  const client = devis.client || {};
  const w = pageWidth(doc);
  const colW = (w - 16) / 2;
  const boxH = 95;

  ensureSpace(doc, state, boxH + 6);
  const y = state.y;
  const signNom = devis.signataireNom || org.signataireNom || state.signataireNom || "";
  const signFonction = devis.signataireFonction || org.signataireFonction || state.signataireFonction || "Gérant";

  doc.rect(MARGIN, y, colW, boxH).stroke(BORDER);
  doc.fillColor(ACCENT).fontSize(7).font("Helvetica-Bold").text("POUR L'ENTREPRISE", MARGIN + 8, y + 6, { lineBreak: false });
  doc.fillColor(MUTED).fontSize(6.5).font("Helvetica").text("Lu et approuvé", MARGIN + 8, y + 16, { lineBreak: false });

  const sigY = y + 24;
  if (devis.signatureData && tryEmbedImage(doc, devis.signatureData, MARGIN + 8, sigY, { fit: [colW - 16, 34] })) {
    doc.strokeColor(LINE).moveTo(MARGIN + 8, sigY + 38).lineTo(MARGIN + colW - 8, sigY + 38).stroke();
  } else {
    doc.strokeColor(LINE).moveTo(MARGIN + 8, sigY + 28).lineTo(MARGIN + colW - 8, sigY + 28).stroke();
    doc.fillColor(MUTED).fontSize(6).text("Signature", MARGIN + 8, sigY + 31, { lineBreak: false });
  }
  if (signNom) doc.fillColor(INK).fontSize(8).font("Helvetica-Bold").text(signNom, MARGIN + 8, y + boxH - 28, { lineBreak: false });
  doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(signFonction, MARGIN + 8, y + boxH - 16, { lineBreak: false });

  const cx = MARGIN + colW + 16;
  doc.rect(cx, y, colW, boxH).stroke(BORDER);
  doc.fillColor(ACCENT).fontSize(7).font("Helvetica-Bold").text("BON POUR ACCORD — LE CLIENT", cx + 8, y + 6, { width: colW - 16, lineBreak: false });
  doc.fillColor(MUTED).fontSize(6.5).font("Helvetica").text("Lu et approuvé, bon pour accord du montant et des conditions ci-dessus.", cx + 8, y + 16, { width: colW - 16 });
  if (devis.clientAccepteNom) {
    const clientSigY = y + 28;
    if (devis.clientSignatureData && tryEmbedImage(doc, devis.clientSignatureData, cx + 8, clientSigY, { fit: [colW - 16, 28] })) {
      doc.strokeColor(LINE).moveTo(cx + 8, clientSigY + 32).lineTo(cx + colW - 8, clientSigY + 32).stroke();
    }
    doc.fillColor(INK).fontSize(8).font("Helvetica-Bold").text(devis.clientAccepteNom, cx + 8, y + 62, { lineBreak: false });
    doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(
      `Accepté le ${fmtDate(devis.clientAccepteLe)}`,
      cx + 8,
      y + 74,
      { lineBreak: false }
    );
    doc.fillColor(ACCENT).fontSize(7).font("Helvetica-Bold").text("Bon pour accord", cx + 8, y + 86, { lineBreak: false });
  } else {
    doc.strokeColor(LINE).moveTo(cx + 8, y + 52).lineTo(cx + colW - 8, y + 52).stroke();
    doc.fillColor(MUTED).fontSize(6).text("Signature précédée de la mention « Bon pour accord »", cx + 8, y + 56, { width: colW - 16 });
    doc.fillColor(INK).fontSize(8).font("Helvetica-Bold").text(client.nom || "—", cx + 8, y + boxH - 28, { lineBreak: false });
    doc.fillColor(MUTED).fontSize(7).text("Date : ___ / ___ / ______", cx + 8, y + boxH - 16, { lineBreak: false });
  }

  state.y = y + boxH + 8;
}

function drawIndexationBlock(doc, state) {
  const devis = state.devis;
  if (!devis.indexationActive) return;

  const w = pageWidth(doc);
  ensureSpace(doc, state, 70);
  let y = state.y;

  doc.fillColor(ACCENT).fontSize(7.5).font("Helvetica-Bold").text("INDEXATION DES MATÉRIAUX", MARGIN, y, { lineBreak: false });
  y += 12;
  doc.fillColor(INK).fontSize(7.5).font("Helvetica");

  const ref = devis.indexationReference || "Indices BT / matériaux";
  const dateBase = devis.indexationDateBase ? fmtDate(devis.indexationDateBase) : "date de signature";
  const tauxMax = devis.indexationTauxMax ?? 5;
  const defaultClause =
    `Les prix unitaires des matériaux sont établis sur la base des indices en vigueur au ${dateBase}. ` +
    `Toute variation supérieure à l'indice ${ref} pourra donner lieu à révision, dans la limite de ${tauxMax}% du montant HT concerné, ` +
    "conformément aux dispositions du CCAG Travaux.";
  const clause = devis.indexationClause?.trim() || defaultClause;

  doc.text(clause, MARGIN, y, { width: w });
  state.y = y + doc.heightOfString(clause, { width: w }) + 14;
}

function drawPlanningBlock(doc, state) {
  const tasks = state.devis.planningTaches || [];
  if (!tasks.length) return;

  const w = pageWidth(doc);
  const labelW = 150;
  const barX = MARGIN + labelW + 8;
  const barW = w - labelW - 8;
  const rowH = 16;
  const headerH = 28;
  const needed = headerH + tasks.length * rowH + 16;
  ensureSpace(doc, state, needed);

  let y = state.y;
  doc.fillColor(ACCENT).fontSize(7.5).font("Helvetica-Bold").text("PLANNING PRÉVISIONNEL", MARGIN, y, { lineBreak: false });
  y += 12;

  const startMs = Math.min(...tasks.map((t) => new Date(t.dateDebut).getTime()));
  const endMs = Math.max(...tasks.map((t) => new Date(t.dateFin).getTime()));
  const span = Math.max(endMs - startMs, 24 * 3600 * 1000);

  doc.fillColor(MUTED).fontSize(6.5).font("Helvetica");
  textAt(doc, fmtDate(startMs), barX, y);
  textRight(doc, fmtDate(endMs), barX, y, barW);
  y += 10;
  hr(doc, y, w);
  y += 6;

  tasks.forEach((task) => {
    ensureSpace(doc, state, rowH + 4);
    doc.fillColor(INK).fontSize(6.5).font("Helvetica");
    const label = `${task.section ? `[${task.section}] ` : ""}${task.libelle}`.slice(0, 42);
    textAt(doc, label, MARGIN, y + 3);

    const tStart = new Date(task.dateDebut).getTime();
    const tEnd = new Date(task.dateFin).getTime();
    const left = barX + ((tStart - startMs) / span) * barW;
    const width = Math.max(((tEnd - tStart) / span) * barW, 6);

    doc.save();
    doc.rect(left, y + 1, width, 10).fill("#3b82f6");
    doc.restore();

    y += rowH;
  });

  state.y = y + 8;
}

function drawAnnexesList(doc, state) {
  const annexes = state.devis.annexes || [];
  if (!annexes.length) return;

  const w = pageWidth(doc);
  const needed = 24 + annexes.length * 12;
  ensureSpace(doc, state, needed);

  let y = state.y;
  doc.fillColor(ACCENT).fontSize(7.5).font("Helvetica-Bold").text("ANNEXES JOINTES", MARGIN, y, { lineBreak: false });
  y += 12;
  doc.fillColor(INK).fontSize(7).font("Helvetica");

  annexes.forEach((annexe, idx) => {
    const typeLabel = annexe.type === "PLAN" ? "Plan" : annexe.type === "DPGF" ? "DPGF" : "Document";
    textAt(doc, `${idx + 1}. [${typeLabel}] ${annexe.nom}`, MARGIN + 4, y);
    y += 11;
  });

  state.y = y + 6;
}

function drawLegalNote(doc, state) {
  const w = pageWidth(doc);
  ensureSpace(doc, state, 20);
  doc.fillColor(MUTED).fontSize(6.5).font("Helvetica");
  doc.text(
    "En cas de retard de paiement, des pénalités pourront être appliquées conformément à la réglementation en vigueur. " +
      "Toute modification des prestations devra être approuvée par écrit avant exécution.",
    MARGIN,
    state.y,
    { width: w, align: "center" }
  );
}

export function buildDevisPdf(devis, organization, signatory = {}) {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const money = makeMoneyFormatters(organization?.devise);
  const state = {
    devis,
    org: organization || {},
    signataireNom: signatory.nom,
    signataireFonction: signatory.fonction,
    y: MARGIN,
    ...money,
  };

  drawHeader(doc, state);
  drawParties(doc, state);
  drawReferences(doc, state);
  drawTable(doc, state);
  drawTotals(doc, state);
  drawPaymentBlock(doc, state);
  drawIndexationBlock(doc, state);
  drawPlanningBlock(doc, state);
  drawAnnexesList(doc, state);
  drawSignatures(doc, state);
  drawLegalNote(doc, state);
  stampFooters(doc, state);

  return doc;
}

export function streamDevisPdf(res, devis, organization, signatory = {}) {
  const doc = buildDevisPdf(devis, organization, signatory);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=devis_${devis.numero}.pdf`);
  doc.pipe(res);
  doc.end();
}

export function bufferDevisPdf(devis, organization, signatory = {}) {
  return new Promise((resolve, reject) => {
    const doc = buildDevisPdf(devis, organization, signatory);
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
