import { Fragment } from "react";
import { formatFCFA, formatMoneyCell } from "../lib/format";
import { getCurrency } from "../lib/currency";
import { computeDevisTotals, ligneTotal, lignesActives, groupLignesBySection, shouldShowSections } from "../lib/devisCalc";
import { montantEnLettres } from "../lib/montantEnLettres";

const UNITES = ["u", "m²", "m³", "ml", "kg", "h", "forfait", "lot"];

function formatDate(d) {
  if (!d) return new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function chantierLine(chantier) {
  if (!chantier?.nom) return null;
  return [chantier.nom, chantier.adresse, [chantier.ville, chantier.pays].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" — ");
}

export default function DevisDocument({
  organization,
  client,
  chantier,
  numero,
  version = 1,
  parentDevisNumero,
  dateEmission,
  validite = 30,
  description,
  conditions,
  lignes = [],
  tva = 18,
  remisePercent = 0,
  acomptePercent = 30,
  delaiExecution,
  retenueGarantie = 0,
  referenceInterne,
  signataireNom,
  signataireFonction,
  signatureData,
  clientAccepteNom,
  clientAccepteLe,
  clientSignatureData,
  indexationActive = false,
  indexationReference,
  indexationDateBase,
  indexationTauxMax = 5,
  indexationClause,
  planningTaches = [],
  annexes = [],
  className = "",
}) {
  const totals = computeDevisTotals(lignes, tva, remisePercent, retenueGarantie);
  const mainGroups = groupLignesBySection(lignes);
  const optionGroups = groupLignesBySection(lignes, { optionsOnly: true });
  const showSections = shouldShowSections(mainGroups);
  const emission = dateEmission || new Date();
  const expireLe = new Date(emission);
  expireLe.setDate(expireLe.getDate() + Number(validite || 30));

  const org = organization || {};
  const currencyLabel = getCurrency(org.devise).label;
  const cl = client || {};
  const initials = (org.nom || "E")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  let lineNum = 0;

  return (
    <div className={`bg-white text-gray-900 shadow-xl border border-gray-300 ${className}`} style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div className="p-10 md:p-12 text-[13px] leading-relaxed space-y-5">
        <div className="flex justify-between gap-8 items-start border-b border-gray-300 pb-5">
          <div className="flex gap-4 min-w-0">
            <div className="w-12 h-12 shrink-0 flex items-center justify-center">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt="Logo" className="max-w-full max-h-12 object-contain" />
              ) : (
                <div className="w-12 h-12 border-2 border-slate-800 flex items-center justify-center font-bold text-slate-800 text-sm">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-gray-900 tracking-tight">{org.nom || "Mon entreprise"}</p>
              {org.adresse && <p className="text-xs text-gray-600 mt-1">{org.adresse}</p>}
              {(org.ville || org.pays) && (
                <p className="text-xs text-gray-600">{[org.ville, org.pays].filter(Boolean).join(", ")}</p>
              )}
              <div className="text-xs text-gray-600 mt-2 space-y-0.5">
                {org.telephone && <p>Tél. {org.telephone}</p>}
                {org.email && <p>{org.email}</p>}
                {org.rccm && <p>RCCM : {org.rccm}</p>}
                {org.compteContribuable && <p>N° Compte contribuable : {org.compteContribuable}</p>}
                {org.assuranceRc && <p>Assurance RC : {org.assuranceRc}</p>}
                {org.assuranceDecennale && <p>Assurance décennale : {org.assuranceDecennale}</p>}
              </div>
            </div>
          </div>

          <div className="border border-gray-300 p-4 shrink-0 w-52">
            <p className="text-xl font-bold text-slate-800 tracking-wide">DEVIS</p>
            <div className="mt-3 text-xs text-gray-700 space-y-1">
              <p><span className="text-gray-500">N°</span> <span className="font-mono font-semibold">{numero || "—"}</span></p>
              {version > 1 && <p><span className="text-gray-500">Version</span> {version}</p>}
              {parentDevisNumero && (
                <p><span className="text-gray-500">Réf. initiale</span> {parentDevisNumero}</p>
              )}
              <p><span className="text-gray-500">Émis le</span> {formatDate(emission)}</p>
              <p><span className="text-gray-500">Validité</span> {validite} jours</p>
              <p><span className="text-gray-500">Expire le</span> {formatDate(expireLe)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-300 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-2">Émetteur</p>
            <p className="font-semibold text-gray-900">{org.nom || "—"}</p>
            <p className="text-xs text-gray-600 mt-1">{[org.adresse, [org.ville, org.pays].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
            <p className="text-xs text-gray-600">{[org.telephone, org.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="border border-gray-300 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-2">Destinataire</p>
            <p className="font-semibold text-gray-900">{cl.nom || "— Sélectionnez un client —"}</p>
            {cl.adresse && <p className="text-xs text-gray-600 mt-1">{cl.adresse}</p>}
            <p className="text-xs text-gray-600">{[cl.telephone, cl.email].filter(Boolean).join(" · ") || "—"}</p>
          </div>
        </div>

        <div className="text-xs text-gray-700 space-y-1 border-b border-gray-200 pb-4">
          {description && (
            <p><span className="font-bold text-gray-500 uppercase text-[10px] tracking-wide mr-2">Objet</span>{description}</p>
          )}
          {chantierLine(chantier) && (
            <p><span className="font-bold text-gray-500 uppercase text-[10px] tracking-wide mr-2">Chantier</span>{chantierLine(chantier)}</p>
          )}
          {delaiExecution && (
            <p><span className="font-bold text-gray-500 uppercase text-[10px] tracking-wide mr-2">Délai</span>{delaiExecution}</p>
          )}
          {referenceInterne && (
            <p><span className="font-bold text-gray-500 uppercase text-[10px] tracking-wide mr-2">Réf. dossier</span>{referenceInterne}</p>
          )}
          {retenueGarantie > 0 && (
            <p><span className="font-bold text-gray-500 uppercase text-[10px] tracking-wide mr-2">Retenue</span>{retenueGarantie}% retenue de garantie</p>
          )}
          {acomptePercent > 0 && (
            <p><span className="font-bold text-gray-500 uppercase text-[10px] tracking-wide mr-2">Acompte</span>{acomptePercent}% à la signature</p>
          )}
          <p><span className="font-bold text-gray-500 uppercase text-[10px] tracking-wide mr-2">Devise</span>{currencyLabel}</p>
        </div>

        <table className="w-full text-xs border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50 text-slate-800">
              <th className="border border-gray-300 px-2 py-2 w-8 text-left font-semibold">N°</th>
              <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Désignation des prestations</th>
              <th className="border border-gray-300 px-2 py-2 w-12 text-center font-semibold">Qté</th>
              <th className="border border-gray-300 px-2 py-2 w-12 text-center font-semibold">Unité</th>
              <th className="border border-gray-300 px-2 py-2 w-28 text-right font-semibold">P.U. HT</th>
              <th className="border border-gray-300 px-2 py-2 w-28 text-right font-semibold">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {lignesActives(lignes).length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-gray-300 px-3 py-6 text-center text-gray-400 italic">
                  Ajoutez des lignes de prestation…
                </td>
              </tr>
            ) : (
              <>
                {[...mainGroups, ...optionGroups].map((group) => (
                  <Fragment key={`${group.section}-${group.isOptions ? "opt" : "main"}`}>
                    {(showSections || group.isOptions) && (
                      <tr className={group.isOptions ? "bg-amber-50 text-amber-900" : "bg-indigo-50 text-indigo-900"}>
                        <td colSpan={6} className="border border-gray-300 px-2 py-1.5 font-bold uppercase text-[10px] tracking-wide">
                          {group.section}
                        </td>
                      </tr>
                    )}
                    {group.lignes.map((l) => {
                      lineNum += 1;
                      const current = lineNum;
                      const label = l.reference ? `[${l.reference}] ${l.designation}` : l.designation;
                      return (
                        <tr key={`${group.section}-${current}`}>
                          <td className="border border-gray-300 px-2 py-2 text-gray-500">{current}</td>
                          <td className="border border-gray-300 px-2 py-2 text-gray-900">
                            <p>{label}</p>
                            {l.detailDescription && <p className="text-[10px] text-gray-500 mt-0.5 whitespace-pre-line">{l.detailDescription}</p>}
                          </td>
                          <td className="border border-gray-300 px-2 py-2 text-center text-gray-700">{l.quantite}</td>
                          <td className="border border-gray-300 px-2 py-2 text-center text-gray-600">{l.unite || "u"}</td>
                          <td className="border border-gray-300 px-2 py-2 text-right text-gray-700 tabular-nums whitespace-nowrap">{formatMoneyCell(l.prixUnitaire)}</td>
                          <td className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                            {formatMoneyCell(ligneTotal(l))}{group.isOptions ? " *" : ""}
                          </td>
                        </tr>
                      );
                    })}
                    {showSections && !group.isOptions && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right text-gray-600 italic">
                          Sous-total {group.section}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold tabular-nums">{formatMoneyCell(group.subtotal)}</td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </>
            )}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-72 border border-gray-300 text-sm">
            {totals.montantRemise > 0 && (
              <>
                <div className="flex justify-between px-3 py-2 border-b border-gray-200 text-gray-600">
                  <span>Total HT brut</span>
                  <span className="tabular-nums whitespace-nowrap text-gray-900">{formatFCFA(totals.montantHTBrut)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 border-b border-gray-200 text-gray-600">
                  <span>Remise ({totals.remisePercent}%)</span>
                  <span className="tabular-nums whitespace-nowrap text-red-600">- {formatFCFA(totals.montantRemise)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between px-3 py-2 border-b border-gray-200 text-gray-600">
              <span>Total HT</span>
              <span className="tabular-nums whitespace-nowrap text-gray-900">{formatFCFA(totals.montantHT)}</span>
            </div>
            {(totals.tvaBreakdown || []).map((row) => (
              <div key={row.rate} className="flex justify-between px-3 py-2 border-b border-gray-200 text-gray-600">
                <span>TVA {row.rate}%</span>
                <span className="tabular-nums whitespace-nowrap text-gray-900">{formatFCFA(row.montantTVA)}</span>
              </div>
            ))}
            <div className="flex justify-between px-3 py-2.5 bg-slate-800 text-white font-bold">
              <span>TOTAL TTC</span>
              <span className="tabular-nums whitespace-nowrap">{formatFCFA(totals.montantTTC)}</span>
            </div>
            {totals.montantRetenue > 0 && (
              <>
                <div className="flex justify-between px-3 py-2 border-t border-gray-200 text-gray-600">
                  <span>Retenue ({totals.retenueGarantie}%)</span>
                  <span className="tabular-nums text-red-600">- {formatFCFA(totals.montantRetenue)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 bg-blue-50 font-bold text-blue-900">
                  <span>Net à payer</span>
                  <span className="tabular-nums">{formatFCFA(totals.netAPayer)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-600 italic text-center">
          Arrêté le présent devis à la somme de : {montantEnLettres(totals.netAPayer || totals.montantTTC, currencyLabel)}.
        </p>
        {acomptePercent > 0 && (
          <p className="text-xs text-gray-700 text-center">
            Acompte à la signature ({acomptePercent}%) : {formatFCFA(((totals.netAPayer || totals.montantTTC) * acomptePercent) / 100)}
          </p>
        )}
        {totals.optionsHT > 0 && (
          <p className="text-xs text-amber-700 text-center">* Options et variantes (hors total) : {formatFCFA(totals.optionsHT)} HT</p>
        )}

        {indexationActive && (
          <div className="text-xs text-gray-700 space-y-1 border-t border-gray-300 pt-4">
            <p className="font-bold uppercase tracking-widest text-slate-700 text-[10px]">Indexation des matériaux</p>
            <p className="leading-relaxed">
              {indexationClause ||
                `Révision selon l'indice ${indexationReference || "BT"} à compter du ${indexationDateBase ? formatDate(indexationDateBase) : "date de signature"}, plafonnée à ${indexationTauxMax}%.`}
            </p>
          </div>
        )}

        {planningTaches.filter((t) => t.libelle?.trim() && t.dateDebut && t.dateFin).length > 0 && (
          <div className="text-xs text-gray-700 space-y-2 border-t border-gray-300 pt-4">
            <p className="font-bold uppercase tracking-widest text-slate-700 text-[10px]">Planning prévisionnel</p>
            <div className="space-y-1">
              {planningTaches
                .filter((t) => t.libelle?.trim() && t.dateDebut && t.dateFin)
                .map((task, idx) => (
                  <p key={idx}>
                    <span className="font-medium">{task.libelle}</span>
                    {task.section ? ` (${task.section})` : ""} — du {formatDate(task.dateDebut)} au {formatDate(task.dateFin)}
                  </p>
                ))}
            </div>
          </div>
        )}

        {annexes.length > 0 && (
          <div className="text-xs text-gray-700 space-y-1 border-t border-gray-300 pt-4">
            <p className="font-bold uppercase tracking-widest text-slate-700 text-[10px]">Annexes jointes</p>
            <ul className="list-decimal list-inside space-y-0.5">
              {annexes.map((a) => (
                <li key={a.id || a.nom}>
                  [{a.type === "PLAN" ? "Plan" : a.type === "DPGF" ? "DPGF" : "Doc"}] {a.nom}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-gray-700 space-y-2 border-t border-gray-300 pt-4">
          <p className="font-bold uppercase tracking-widest text-slate-700 text-[10px]">Conditions et modalités</p>
          <p className="whitespace-pre-line leading-relaxed">{conditions || "Paiement selon conditions convenues avec le client."}</p>
          {(org.banque || org.rib) && (
            <div className="mt-2">
              <p className="font-bold uppercase tracking-widest text-slate-700 text-[10px] mb-1">Coordonnées bancaires</p>
              {org.banque && <p>Banque : {org.banque}</p>}
              {org.rib && <p>RIB / N° de compte : {org.rib}</p>}
            </div>
          )}
          <p className="text-gray-500 text-[11px]">
            TVA en sus selon taux en vigueur. Ce devis vaut bon de commande après signature et cachet du client.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="border border-gray-300 p-4 min-h-[120px]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Pour l&apos;entreprise</p>
            <p className="text-[10px] text-gray-500 mt-1">Lu et approuvé</p>
            {signatureData ? (
              <img src={signatureData} alt="Signature" className="h-9 object-contain my-3" />
            ) : (
              <div className="h-9 border-b border-gray-400 my-3 flex items-end text-[10px] text-gray-400">Signature</div>
            )}
            <p className="font-semibold text-gray-900">{signataireNom || org.signataireNom || "—"}</p>
            <p className="text-xs text-gray-600">{signataireFonction || org.signataireFonction || "Gérant"}</p>
          </div>
          <div className="border border-gray-300 p-4 min-h-[120px]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Bon pour accord — le client</p>
            <p className="text-[10px] text-gray-500 mt-1">Lu et approuvé, bon pour accord du montant et des conditions ci-dessus.</p>
            {clientAccepteNom ? (
              <>
                {clientSignatureData && <img src={clientSignatureData} alt="Signature client" className="h-9 object-contain my-2" />}
                <p className="font-semibold text-gray-900 mt-2">{clientAccepteNom}</p>
                <p className="text-xs text-gray-600">Accepté le {formatDate(clientAccepteLe)}</p>
                <p className="text-xs font-semibold text-emerald-700 mt-1">Bon pour accord</p>
              </>
            ) : (
              <>
                <div className="h-9 border-b border-gray-400 my-3 flex items-end text-[10px] text-gray-400">Signature « Bon pour accord »</div>
                <p className="font-semibold text-gray-900">{cl.nom || "—"}</p>
                <p className="text-xs text-gray-500 mt-1">Date : ___ / ___ / ______</p>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-gray-300 pt-4 text-center text-[10px] text-gray-500 leading-relaxed">
          <p>
            En cas de retard de paiement, des pénalités pourront être appliquées conformément à la réglementation en vigueur.
          </p>
          <p className="mt-2 font-medium text-gray-600">
            {[org.nom, org.rccm ? `RCCM ${org.rccm}` : null, org.compteContribuable ? `N° CC ${org.compteContribuable}` : null, org.assuranceRc ? `RC ${org.assuranceRc}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}

export { UNITES };
