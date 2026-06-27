import { formatFCFA, formatMoneyCell } from "../lib/format";
import { getCurrency } from "../lib/currency";
import { computeDevisTotals, ligneTotal, lignesActives, groupLignesBySection, shouldShowSections } from "../lib/devisCalc";
import { montantEnLettres } from "../lib/montantEnLettres";
export { UNITES } from "./DevisDocument";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function MetaRow({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-4 text-[11px] leading-snug">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-slate-900 text-right ${mono ? "font-mono font-semibold tabular-nums" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}

export default function FactureDocument({
  organization,
  client,
  chantier,
  numero,
  dateEmission,
  dateEcheance,
  referenceDevis,
  referenceInterne,
  typeFacture,
  description,
  conditions,
  lignes = [],
  tva = 18,
  remisePercent = 0,
  retenueGarantie = 0,
  modePaiement,
  className = "",
}) {
  const totals = computeDevisTotals(lignes, tva, remisePercent, retenueGarantie);
  const groups = groupLignesBySection(lignes);
  const showSections = shouldShowSections(groups);
  const { montantHT, montantTVA, montantTTC, netAPayer } = totals;
  const emission = dateEmission || new Date();
  const org = organization || {};
  const currencyLabel = getCurrency(org.devise).label;
  const cl = client || {};
  const initials = (org.nom || "E")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const legalLine = [
    org.nom,
    org.rccm ? `RCCM ${org.rccm}` : null,
    org.compteContribuable ? `N° CC ${org.compteContribuable}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`bg-white text-slate-900 shadow-2xl border border-slate-200 ${className}`}
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      {/* Bandeau */}
      <div className="bg-slate-900 text-white px-8 md:px-10 py-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 shrink-0 flex items-center justify-center bg-white/10 rounded-lg border border-white/20">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt="Logo" className="max-w-full max-h-9 object-contain" />
            ) : (
              <span className="text-sm font-bold tracking-wide">{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight truncate">{org.nom || "Mon entreprise"}</p>
            <p className="text-[11px] text-slate-300 truncate">
              {[org.ville, org.pays].filter(Boolean).join(", ") || "—"}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-medium">Document commercial</p>
          <p className="text-2xl font-bold tracking-tight mt-0.5">FACTURE</p>
        </div>
      </div>

      <div className="px-8 md:px-10 py-8 space-y-6 text-[13px] leading-relaxed">
        {/* Méta + parties */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 border border-slate-200 rounded-lg p-4 bg-slate-50/80 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Informations</p>
            <MetaRow label="N° facture" value={numero || "—"} mono />
            <MetaRow label="Date d'émission" value={formatDate(emission)} />
            <MetaRow label="Date d'échéance" value={formatDate(dateEcheance)} />
            {modePaiement && <MetaRow label="Mode de paiement" value={modePaiement} />}
            <MetaRow label="Devise" value={currencyLabel} />
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Émetteur</p>
            <p className="font-semibold text-slate-900">{org.nom || "—"}</p>
            {org.adresse && <p className="text-xs text-slate-600 mt-1">{org.adresse}</p>}
            <p className="text-xs text-slate-600 mt-1">
              {[org.ville, org.pays].filter(Boolean).join(", ")}
            </p>
            <div className="mt-2 text-xs text-slate-600 space-y-0.5">
              {org.telephone && <p>Tél. {org.telephone}</p>}
              {org.email && <p>{org.email}</p>}
              {org.rccm && <p>RCCM : {org.rccm}</p>}
              {org.compteContribuable && <p>N° CC : {org.compteContribuable}</p>}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Facturé à</p>
            <p className="font-semibold text-slate-900">{cl.nom || "— Client —"}</p>
            {cl.adresse && <p className="text-xs text-slate-600 mt-1">{cl.adresse}</p>}
            <p className="text-xs text-slate-600 mt-2">
              {[cl.telephone, cl.email].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </div>

        {(description || chantier?.nom || referenceDevis || referenceInterne || typeFacture) && (
          <div className="border border-slate-200 rounded-lg px-4 py-3 bg-white text-xs text-slate-700 space-y-1">
            {typeFacture && typeFacture !== "INTEGRALE" && typeFacture !== "Facture intégrale" && (
              <p><span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wide mr-2">Type</span>{typeFacture}</p>
            )}
            {description && (
              <p>
                <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wide mr-2">Objet</span>
                {description}
              </p>
            )}
            {chantier?.nom && (
              <p>
                <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wide mr-2">Chantier</span>
                {chantier.nom}
              </p>
            )}
            {referenceDevis && (
              <p>
                <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wide mr-2">Réf. devis</span>
                {referenceDevis}
              </p>
            )}
            {referenceInterne && (
              <p>
                <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wide mr-2">Réf. dossier</span>
                {referenceInterne}
              </p>
            )}
          </div>
        )}

        <table className="w-full text-xs border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="border border-slate-700 px-2 py-2.5 w-9 text-left font-semibold">N°</th>
              <th className="border border-slate-700 px-2 py-2.5 w-14 text-left font-semibold">Réf</th>
              <th className="border border-slate-700 px-3 py-2.5 text-left font-semibold">Désignation</th>
              <th className="border border-slate-700 px-2 py-2.5 w-14 text-center font-semibold">Qté</th>
              <th className="border border-slate-700 px-2 py-2.5 w-14 text-center font-semibold">Unité</th>
              <th className="border border-slate-700 px-3 py-2.5 w-28 text-right font-semibold">P.U. HT</th>
              <th className="border border-slate-700 px-3 py-2.5 w-28 text-right font-semibold">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {lignesActives(lignes).length === 0 ? (
              <tr>
                <td colSpan={7} className="border border-slate-200 px-4 py-8 text-center text-slate-400 italic">
                  Lignes de facturation…
                </td>
              </tr>
            ) : (
              (() => {
                let lineNum = 0;
                return groups.flatMap((group) => {
                  const rows = [];
                  if (showSections) {
                    rows.push(
                      <tr key={`sec-${group.section}`} className="bg-slate-100">
                        <td colSpan={7} className="border border-slate-200 px-3 py-1.5 font-bold text-slate-700 uppercase text-[10px] tracking-wide">
                          {group.section}
                        </td>
                      </tr>
                    );
                  }
                  group.lignes.forEach((l, i) => {
                    lineNum += 1;
                    rows.push(
                      <tr key={`${group.section}-${i}`} className="even:bg-slate-50/60">
                        <td className="border border-slate-200 px-2 py-2.5 text-slate-500 tabular-nums">{lineNum}</td>
                      <td className="border border-slate-200 px-2 py-2.5 text-slate-600">{l.reference || "—"}</td>
                      <td className="border border-slate-200 px-3 py-2.5 text-slate-900">
                        {l.designation}
                        {l.detailDescription && <p className="text-[10px] text-slate-500 mt-0.5">{l.detailDescription}</p>}
                      </td>
                      <td className="border border-slate-200 px-2 py-2.5 text-center tabular-nums">{l.quantite}</td>
                      <td className="border border-slate-200 px-2 py-2.5 text-center text-slate-600">{l.unite || "u"}</td>
                      <td className="border border-slate-200 px-3 py-2.5 text-right tabular-nums text-slate-700 whitespace-nowrap">
                        {formatMoneyCell(l.prixUnitaire)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatMoneyCell(ligneTotal(l))}
                      </td>
                    </tr>
                  );
                });
                return rows;
              });
              })()
            )}
          </tbody>
        </table>

        {/* Totaux + net à payer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="text-xs text-slate-600 space-y-3">
            <p className="font-bold uppercase tracking-widest text-slate-700 text-[10px]">Conditions de paiement</p>
            <p className="whitespace-pre-line leading-relaxed text-slate-700">
              {conditions || "Paiement à réception de facture selon modalités convenues."}
            </p>
            {(org.banque || org.rib) && (
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <p className="font-bold uppercase tracking-widest text-slate-600 text-[10px] mb-2">Coordonnées bancaires</p>
                {org.banque && <p className="text-slate-800">Banque : <span className="font-medium">{org.banque}</span></p>}
                {org.rib && <p className="text-slate-800 mt-1 font-mono text-[11px]">{org.rib}</p>}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
              {totals.montantRemise > 0 && (
                <>
                  <div className="flex justify-between px-4 py-2 border-b border-slate-100 text-slate-600">
                    <span>Total HT brut</span>
                    <span className="tabular-nums">{formatFCFA(totals.montantHTBrut)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-slate-100 text-red-600">
                    <span>Remise ({totals.remisePercent}%)</span>
                    <span className="tabular-nums">- {formatFCFA(totals.montantRemise)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between px-4 py-2.5 border-b border-slate-100 text-slate-600">
                <span>Total HT</span>
                <span className="tabular-nums whitespace-nowrap font-medium text-slate-900">{formatFCFA(montantHT)}</span>
              </div>
              {(totals.tvaBreakdown || [{ rate: tva, montantTVA }]).map((row) => (
                <div key={row.rate} className="flex justify-between px-4 py-2 border-b border-slate-100 text-slate-600">
                  <span>TVA {row.rate}%</span>
                  <span className="tabular-nums whitespace-nowrap font-medium text-slate-900">{formatFCFA(row.montantTVA)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 text-slate-800 font-semibold bg-slate-50">
                <span>Total TTC</span>
                <span className="tabular-nums whitespace-nowrap">{formatFCFA(montantTTC)}</span>
              </div>
              {totals.montantRetenue > 0 && (
                <>
                  <div className="flex justify-between px-4 py-2 border-t border-slate-100 text-red-600">
                    <span>Retenue ({totals.retenueGarantie}%)</span>
                    <span className="tabular-nums">- {formatFCFA(totals.montantRetenue)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="rounded-lg bg-slate-900 text-white px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-medium">Net à payer</p>
              <p className="text-2xl font-bold tabular-nums whitespace-nowrap mt-1">{formatFCFA(netAPayer ?? montantTTC)}</p>
              {dateEcheance && (
                <p className="text-xs text-slate-300 mt-2">
                  À régler avant le <span className="font-medium text-white">{formatDate(dateEcheance)}</span>
                </p>
              )}
            </div>
            <p className="text-[11px] text-slate-600 italic text-center">
              Arrêté la présente facture à la somme de : {montantEnLettres(netAPayer ?? montantTTC, currencyLabel)}.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-500 leading-relaxed space-y-1">
          <p>
            En cas de retard de paiement, des pénalités et indemnités peuvent être appliquées conformément à la réglementation en vigueur.
          </p>
          {legalLine && <p className="font-medium text-slate-600">{legalLine}</p>}
        </div>
      </div>
    </div>
  );
}
