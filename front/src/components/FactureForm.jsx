import { useEffect, useState, useMemo } from "react";
import { Receipt, Plus, Trash2, X, Eye, Edit3, Calculator } from "lucide-react";
import api from "../lib/api";
import { formatFCFA } from "../lib/format";
import { computeDevisTotals, ligneTotal, DEVIS_SECTIONS, TVA_RATES } from "../lib/devisCalc";
import FactureDocument, { UNITES } from "./FactureDocument";
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  FormAlert,
  FormSection,
  FormGrid,
} from "./form/FormUI";

const EMPTY_LINE = { section: "Général", reference: "", designation: "", detailDescription: "", quantite: 1, unite: "u", prixUnitaire: 0, tva: 18 };

const DEFAULT_CONDITIONS = `Paiement par virement bancaire sous 30 jours à compter de la date d'émission de la facture.
En cas de retard de paiement, application des pénalités et indemnités prévues par la réglementation en vigueur.
TVA acquittée sur les débits conformément au taux applicable.
Aucun escompte pour paiement anticipé sauf accord écrit préalable.`;

const MODES_PAIEMENT = ["Espèces", "Virement bancaire", "Chèque", "Mobile Money"];
const STATUTS = ["Brouillon", "Envoyée", "Partiellement payée", "Payée", "Impayée", "Annulée"];

const inputCompact =
  "w-full min-w-0 px-2 py-1.5 text-sm text-center rounded-md border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500";

const inputCompactLeft =
  "w-full min-w-0 px-2 py-1.5 text-sm text-left rounded-md border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500";

const PRESTATION_HINTS = [
  "Maçonnerie — murs porteurs",
  "Coffrage et ferraillage",
  "Enduit intérieur / extérieur",
  "Carrelage sol et mur",
  "Plomberie — installation sanitaire",
  "Électricité — câblage complet",
  "Peinture intérieure",
  "Menuiserie bois / aluminium",
];

function defaultEcheance() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function toDateInput(d) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function initLignes(facture) {
  if (facture?.lignes?.length) {
    return facture.lignes.map((l) => ({
      section: l.section || "Général",
      reference: l.reference || "",
      designation: l.designation || "",
      detailDescription: l.detailDescription || "",
      quantite: l.quantite || 1,
      unite: l.unite || "u",
      prixUnitaire: l.prixUnitaire || 0,
      tva: l.tva ?? 18,
    }));
  }
  return [{ ...EMPTY_LINE }];
}

async function loadOrganization() {
  try {
    const r = await api.get("/auth/profil");
    if (r.data?.organization) return r.data.organization;
  } catch {
    /* fallback */
  }
  try {
    const r = await api.get("/organization");
    return r.data;
  } catch {
    return null;
  }
}

export default function FactureForm({ open, onClose, facture, onSaved }) {
  const [clients, setClients] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [clientId, setClientId] = useState("");
  const [chantierId, setChantierId] = useState("");
  const [tva, setTva] = useState(18);
  const [description, setDescription] = useState("");
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS);
  const [referenceDevis, setReferenceDevis] = useState("");
  const [referenceInterne, setReferenceInterne] = useState("");
  const [remisePercent, setRemisePercent] = useState(0);
  const [retenueGarantie, setRetenueGarantie] = useState(0);
  const [dateEcheance, setDateEcheance] = useState("");
  const [modePaiement, setModePaiement] = useState("Virement bancaire");
  const [statut, setStatut] = useState("Brouillon");
  const [lignes, setLignes] = useState([{ ...EMPTY_LINE }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [mobileView, setMobileView] = useState("edit");
  const [refDevisAuto, setRefDevisAuto] = useState(true);
  const [refInterneAuto, setRefInterneAuto] = useState(true);
  const [suggestFromDevis, setSuggestFromDevis] = useState(false);

  const applySuggestions = (data, { onlyRefs = false } = {}) => {
    if (refDevisAuto) setReferenceDevis(data.referenceDevis || "");
    if (refInterneAuto) setReferenceInterne(data.referenceInterne || "");
    setSuggestFromDevis(Boolean(data.fromDevis));
    if (!onlyRefs && !description.trim() && data.description) {
      setDescription(data.description);
    }
    if (!onlyRefs && data.tva != null && !facture) setTva(data.tva);
    if (!onlyRefs && data.remisePercent != null && remisePercent === 0) setRemisePercent(data.remisePercent);
    if (!onlyRefs && data.retenueGarantie != null && retenueGarantie === 0) setRetenueGarantie(data.retenueGarantie);
  };

  const loadSuggestions = async (client, chantier, { onlyRefs = false } = {}) => {
    try {
      const params = new URLSearchParams();
      if (client) params.set("clientId", client);
      if (chantier) params.set("chantierId", chantier);
      const q = params.toString();
      const res = await api.get(`/facture/suggestions${q ? `?${q}` : ""}`);
      applySuggestions(res.data, { onlyRefs });
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!open) return;
    setMobileView("edit");
    api.get("/client").then((r) => setClients(r.data));
    api.get("/chantier").then((r) => setChantiers(r.data.items || r.data));
    loadOrganization().then(setOrganization);

    if (facture) {
      setClientId(facture.client?._id || facture.client?.id || facture.clientId || "");
      setChantierId(facture.chantier?._id || facture.chantier?.id || facture.chantierId || "");
      setTva(facture.tva ?? facture.finances?.tva ?? 18);
      setDescription(facture.description || "");
      setConditions(facture.conditions || DEFAULT_CONDITIONS);
      setReferenceDevis(facture.referenceDevis || facture.devis?.numero || "");
      setReferenceInterne(facture.referenceInterne || "");
      setRemisePercent(facture.remisePercent ?? facture.finances?.remisePercent ?? 0);
      setRetenueGarantie(facture.retenueGarantie ?? facture.finances?.retenueGarantie ?? 0);
      setDateEcheance(toDateInput(facture.dateEcheance || facture.echeance?.dateEcheance));
      setModePaiement(facture.modePaiement || "Virement bancaire");
      setStatut(facture.statut || "Brouillon");
      setLignes(initLignes(facture));
    } else {
      setClientId("");
      setChantierId("");
      setTva(18);
      setDescription("");
      setConditions(DEFAULT_CONDITIONS);
      setReferenceDevis("");
      setReferenceInterne("");
      setRemisePercent(0);
      setRetenueGarantie(0);
      setDateEcheance(defaultEcheance());
      setModePaiement("Virement bancaire");
      setStatut("Brouillon");
      setLignes([{ ...EMPTY_LINE }]);
      setRefDevisAuto(true);
      setRefInterneAuto(true);
      setSuggestFromDevis(false);
      loadSuggestions("", "");
    }
    setError("");
    setFieldErrors({});
  }, [open, facture]);

  useEffect(() => {
    if (!open || facture) return;
    loadSuggestions(clientId, chantierId, { onlyRefs: true });
  }, [clientId, chantierId, open, facture]);

  const selectedClient = useMemo(
    () => clients.find((c) => (c._id || c.id) === clientId),
    [clients, clientId]
  );

  const selectedChantier = useMemo(
    () => chantiers.find((c) => (c._id || c.id) === chantierId),
    [chantiers, chantierId]
  );

  const previewClient = selectedClient
    ? {
        nom: selectedClient.nom,
        adresse: selectedClient.adresse,
        telephone: selectedClient.telephone,
        email: selectedClient.email,
      }
    : facture?.client && typeof facture.client === "object"
      ? facture.client
      : null;

  const previewChantier = selectedChantier
    ? { nom: selectedChantier.nom, ville: selectedChantier.ville }
    : facture?.chantier && typeof facture.chantier === "object"
      ? facture.chantier
      : null;

  const totals = useMemo(() => computeDevisTotals(lignes, tva, remisePercent, retenueGarantie), [lignes, tva, remisePercent, retenueGarantie]);
  const locked = Boolean(facture?.verrouillee);
  const { montantHT, montantTVA, montantTTC, netAPayer } = totals;

  const updateLigne = (i, key, val) => {
    setLignes((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  };

  const addLigne = () => setLignes((rows) => [...rows, { ...EMPTY_LINE }]);
  const removeLigne = (i) =>
    setLignes((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));

  const addHintLigne = (hint) => {
    setLignes((rows) => {
      const emptyIdx = rows.findIndex((r) => !r.designation.trim());
      if (emptyIdx >= 0) {
        return rows.map((r, idx) => (idx === emptyIdx ? { ...r, designation: hint } : r));
      }
      return [...rows, { designation: hint, quantite: 1, unite: "u", prixUnitaire: 0 }];
    });
  };

  const validate = () => {
    const errs = {};
    if (!clientId) errs.client = "Sélectionnez un client";
    if (lignes.every((l) => !l.designation.trim())) errs.lignes = "Ajoutez au moins une ligne";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleClose = () => {
    if (!loading) onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setLoading(true);
    try {
      const payload = {
        client: clientId,
        chantier: chantierId || undefined,
        lignes: lignes
          .filter((l) => l.designation.trim())
          .map((l) => ({
            section: l.section || "Général",
            reference: l.reference?.trim() || undefined,
            designation: l.designation.trim(),
            detailDescription: l.detailDescription?.trim() || undefined,
            quantite: Number(l.quantite) || 1,
            unite: l.unite || "u",
            prixUnitaire: Number(l.prixUnitaire) || 0,
            tva: Number(l.tva ?? tva) || 18,
          })),
        tva: Number(tva),
        remisePercent: Number(remisePercent) || 0,
        retenueGarantie: Number(retenueGarantie) || 0,
        referenceInterne: referenceInterne.trim() || undefined,
        description,
        conditions,
        referenceDevis: referenceDevis.trim() || undefined,
        dateEcheance: dateEcheance || undefined,
        modePaiement,
        statut,
      };

      const id = facture?._id || facture?.id;
      if (id) {
        await api.put(`/facture/${id}`, payload);
      } else {
        await api.post("/facture", payload);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const documentPreview = (
    <FactureDocument
      organization={organization}
      client={previewClient}
      chantier={previewChantier}
      numero={facture?.numero}
      dateEmission={facture?.dateEmission || facture?.date}
      dateEcheance={dateEcheance}
      referenceDevis={referenceDevis}
      referenceInterne={referenceInterne}
      typeFacture={facture?.typeFacture || facture?.typeFactureRaw}
      description={description}
      conditions={conditions}
      lignes={lignes}
      tva={tva}
      remisePercent={remisePercent}
      retenueGarantie={retenueGarantie}
      modePaiement={modePaiement}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 bg-slate-900 text-white shrink-0 border-b border-slate-700">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-slate-700 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold truncate">
              {facture ? `Facture ${facture.numero || ""}` : "Nouvelle facture"}
            </h2>
            <p className="text-xs text-slate-400 truncate">
              Document client · Net à payer {formatFCFA(netAPayer ?? montantTTC)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex lg:hidden rounded-lg bg-gray-800 p-0.5">
            <button
              type="button"
              onClick={() => setMobileView("edit")}
              className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1 ${mobileView === "edit" ? "bg-gray-700 text-white" : "text-gray-400"}`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Édition
            </button>
            <button
              type="button"
              onClick={() => setMobileView("preview")}
              className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1 ${mobileView === "preview" ? "bg-gray-700 text-white" : "text-gray-400"}`}
            >
              <Eye className="w-3.5 h-3.5" /> Aperçu
            </button>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition hidden sm:block"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="facture-form"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-slate-600 hover:bg-slate-500 disabled:opacity-60 text-white rounded-lg transition"
          >
            {loading ? "Enregistrement…" : facture ? "Mettre à jour" : "Créer la facture"}
          </button>
          <button type="button" onClick={handleClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className={`w-full lg:w-[44%] bg-gray-100 dark:bg-gray-900 overflow-y-auto ${
            mobileView === "preview" ? "hidden lg:block" : ""
          }`}
        >
          <form id="facture-form" onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
            {error && <FormAlert>{error}</FormAlert>}
            {locked && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                Facture verrouillée — les lignes et montants ne sont plus modifiables. Encaissements et avoirs via la fiche détail.
              </div>
            )}

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <FormSection title="Destinataire & références" description="Informations visibles sur le document envoyé au client">
                <FormGrid cols={1}>
                <FormField label="Client" required error={fieldErrors.client}>
                  <FormSelect value={clientId} onChange={(e) => setClientId(e.target.value)} error={fieldErrors.client}>
                    <option value="">— Sélectionner un client —</option>
                    {clients.map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>{c.nom}</option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField label="Chantier lié" hint="Optionnel — rattache la facture à un projet">
                  <FormSelect value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
                    <option value="">— Aucun chantier —</option>
                    {chantiers.map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>{c.nom}</option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField label="Objet de la facture" hint="Apparaît en tête du document envoyé au client">
                  <FormTextarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex. Travaux de gros œuvre — phase 2"
                    rows={2}
                  />
                </FormField>
                <FormField
                  label="Référence devis"
                  hint={
                    suggestFromDevis
                      ? "Remplie automatiquement depuis le devis accepté lié"
                      : "Sera proposée dès qu'un devis accepté existe pour ce client/chantier"
                  }
                >
                  <FormInput
                    value={referenceDevis}
                    onChange={(e) => {
                      setRefDevisAuto(false);
                      setReferenceDevis(e.target.value);
                    }}
                    placeholder="Ex. DEV-2026-0042"
                  />
                </FormField>
                <FormField
                  label="Référence dossier interne"
                  hint={
                    refInterneAuto
                      ? suggestFromDevis
                        ? "Reprise du dossier devis — modifiable"
                        : "Prochain numéro FAC-AAAA-NNNN généré automatiquement"
                      : "Visible sur le PDF client"
                  }
                >
                  <FormInput
                    value={referenceInterne}
                    onChange={(e) => {
                      setRefInterneAuto(false);
                      setReferenceInterne(e.target.value);
                    }}
                    placeholder="FAC-2026-0042"
                  />
                </FormField>
                </FormGrid>
              </FormSection>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex justify-between items-center gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Prestations</h3>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <Calculator className="w-3 h-3" /> Total ligne = Qté × P.U. HT — mis à jour en direct
                  </p>
                </div>
                <span className="text-xs text-gray-500 shrink-0">{totals.nbLignes} ligne(s)</span>
              </div>

              {fieldErrors.lignes && <p className="text-xs text-red-500">{fieldErrors.lignes}</p>}

              <div className="flex flex-wrap gap-1.5">
                {PRESTATION_HINTS.slice(0, 4).map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => addHintLigne(hint)}
                    className="text-[11px] px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition"
                  >
                    + {hint}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-x-auto">
                <table className="w-full min-w-[760px] text-xs table-fixed">
                  <thead className="bg-gray-50 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="p-2 text-left font-medium w-24">Lot</th>
                      <th className="p-2 text-left font-medium w-16">Réf</th>
                      <th className="p-2 text-left font-medium">Désignation</th>
                      <th className="p-2 text-center font-medium w-14">Qté</th>
                      <th className="p-2 text-center font-medium w-16">Unité</th>
                      <th className="p-2 text-right font-medium w-24">P.U. HT</th>
                      <th className="p-2 text-center font-medium w-12">TVA</th>
                      <th className="p-2 text-right font-medium w-24">Total</th>
                      <th className="p-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, i) => {
                      const total = ligneTotal(l);
                      return (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="p-1.5">
                            <select className={inputCompactLeft} value={l.section} onChange={(e) => updateLigne(i, "section", e.target.value)}>
                              {DEVIS_SECTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input className={inputCompact} value={l.reference} onChange={(e) => updateLigne(i, "reference", e.target.value)} placeholder="Réf" />
                          </td>
                          <td className="p-1.5">
                            <input className={inputCompactLeft} value={l.designation} onChange={(e) => updateLigne(i, "designation", e.target.value)} placeholder="Prestation" />
                          </td>
                          <td className="p-1.5">
                            <input type="number" min="0" className={inputCompact} value={l.quantite} onChange={(e) => updateLigne(i, "quantite", e.target.value)} />
                          </td>
                          <td className="p-1.5">
                            <select className={inputCompactLeft} value={l.unite} onChange={(e) => updateLigne(i, "unite", e.target.value)}>
                              {UNITES.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input type="number" min="0" className={inputCompact} value={l.prixUnitaire} onChange={(e) => updateLigne(i, "prixUnitaire", e.target.value)} />
                          </td>
                          <td className="p-1.5">
                            <select className={inputCompact} value={l.tva ?? tva} onChange={(e) => updateLigne(i, "tva", e.target.value)}>
                              {TVA_RATES.map((r) => (
                                <option key={r} value={r}>{r}%</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5 text-right font-semibold whitespace-nowrap">{formatFCFA(total)}</td>
                          <td className="p-1.5">
                            <button type="button" onClick={() => removeLigne(i)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={addLigne}
                  className="w-full py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-center gap-1 border-t dark:border-gray-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5" />
                    Totaux calculés automatiquement
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">TVA</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tva}
                      onChange={(e) => setTva(e.target.value)}
                      className="w-14 px-2 py-1 text-xs text-center rounded-md border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-white dark:bg-gray-800 border p-2.5">
                    <p className="text-gray-500">Total HT net</p>
                    <p className="font-semibold text-sm">{formatFCFA(montantHT)}</p>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-gray-800 border p-2.5">
                    <p className="text-gray-500">TVA totale</p>
                    <p className="font-semibold text-sm">{formatFCFA(montantTVA)}</p>
                    {(totals.tvaBreakdown || []).map((row) => (
                      <p key={row.rate} className="text-[10px] text-gray-400">{row.rate}% → {formatFCFA(row.montantTVA)}</p>
                    ))}
                  </div>
                  <div className="rounded-lg bg-white dark:bg-gray-800 border p-2.5">
                    <p className="text-gray-500">Total TTC</p>
                    <p className="font-semibold text-sm">{formatFCFA(montantTTC)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800 p-2.5 text-white">
                    <p className="text-slate-300 text-[10px] uppercase">Net à payer</p>
                    <p className="font-bold text-sm">{formatFCFA(netAPayer ?? montantTTC)}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <FormSection title="Modalités de règlement" description="Affichées sur la facture client">
                <FormGrid cols={2}>
                  <FormField label="Date d'échéance" required>
                    <FormInput type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} required />
                  </FormField>
                  <FormField label="Mode de paiement">
                    <FormSelect value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
                      {MODES_PAIEMENT.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </FormSelect>
                  </FormField>
                  <FormField label="Remise globale (%)">
                    <FormInput type="number" min="0" max="100" value={remisePercent} onChange={(e) => setRemisePercent(e.target.value)} />
                  </FormField>
                  <FormField label="Retenue de garantie (%)">
                    <FormInput type="number" min="0" max="100" value={retenueGarantie} onChange={(e) => setRetenueGarantie(e.target.value)} />
                  </FormField>
                </FormGrid>
                <FormField label="Conditions de paiement">
                  <FormTextarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={5} />
                </FormField>
              </FormSection>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
              <FormSection
                title="Suivi interne"
                description="Non visible sur le PDF envoyé au client"
              >
                <FormField label="Statut de la facture">
                  <FormSelect value={statut} onChange={(e) => setStatut(e.target.value)}>
                    {STATUTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </FormSelect>
                </FormField>
              </FormSection>
            </section>
          </form>
        </div>

        <div
          className={`flex-1 bg-gray-300 dark:bg-gray-950 overflow-y-auto p-4 md:p-8 items-start justify-center ${
            mobileView === "edit" ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="w-full max-w-[210mm] mx-auto">
            <p className="text-xs text-slate-500 dark:text-slate-500 text-center mb-3 uppercase tracking-wider font-medium">
              Aperçu document client — format facture
            </p>
            {documentPreview}
          </div>
        </div>
      </div>
    </div>
  );
}
