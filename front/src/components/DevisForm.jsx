import { useEffect, useState, useMemo } from "react";
import { FileText, Plus, Trash2, X, Eye, Edit3, Calculator, Upload, Download, Paperclip, CalendarRange } from "lucide-react";
import api, { uploadFile, downloadFile } from "../lib/api";
import { formatFCFA } from "../lib/format";
import { computeDevisTotals, ligneTotal, DEVIS_SECTIONS, TVA_RATES, autoGenerateReferences } from "../lib/devisCalc";
import DevisDocument, { UNITES } from "./DevisDocument";
import DevisGantt from "./DevisGantt";
import SignaturePad from "./SignaturePad";
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  FormAlert,
} from "./form/FormUI";

const EMPTY_LINE = { section: "Général", reference: "", designation: "", detailDescription: "", quantite: 1, unite: "u", prixUnitaire: 0, tva: 18, isOption: false };

const DEFAULT_CONDITIONS = `• Acompte de 30% à la signature du devis
• Solde à réception des travaux
• Délais de réalisation selon planning convenu
• Toute modification des prestations devra être approuvée par écrit`;

const inputCompact =
  "w-full min-w-0 px-2 py-1.5 text-sm text-center rounded-md border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500";

const inputCompactLeft =
  "w-full min-w-0 px-2 py-1.5 text-sm text-left rounded-md border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500";


const DEFAULT_INDEXATION_CLAUSE =
  "Révision des prix matériaux selon variation de l'indice de référence, dans la limite du plafond convenu et conformément au CCAG Travaux.";

function initPlanningTaches(devis) {
  if (!devis?.planningTaches?.length) return [];
  return devis.planningTaches.map((t) => ({
    libelle: t.libelle || "",
    section: t.section || "Général",
    dateDebut: t.dateDebut ? String(t.dateDebut).slice(0, 10) : "",
    dateFin: t.dateFin ? String(t.dateFin).slice(0, 10) : "",
  }));
}

function initLignes(devis) {
  if (devis?.lignes?.length) {
    return devis.lignes.map((l) => ({
      section: l.section || "Général",
      reference: l.reference || "",
      designation: l.designation || "",
      detailDescription: l.detailDescription || "",
      quantite: l.quantite || 1,
      unite: l.unite || "u",
      prixUnitaire: l.prixUnitaire || 0,
      tva: l.tva ?? 18,
      isOption: l.isOption ?? false,
    }));
  }
  return [{ ...EMPTY_LINE }];
}

export default function DevisForm({ open, onClose, devis, onSaved }) {
  const [clients, setClients] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [clientId, setClientId] = useState("");
  const [chantierId, setChantierId] = useState("");
  const [tva, setTva] = useState(18);
  const [validite, setValidite] = useState(30);
  const [description, setDescription] = useState("");
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS);
  const [lignes, setLignes] = useState([{ ...EMPTY_LINE }]);
  const [signataireNom, setSignataireNom] = useState("");
  const [signataireFonction, setSignataireFonction] = useState("Gérant");
  const [signatureData, setSignatureData] = useState("");
  const [remisePercent, setRemisePercent] = useState(0);
  const [acomptePercent, setAcomptePercent] = useState(30);
  const [delaiExecution, setDelaiExecution] = useState("");
  const [retenueGarantie, setRetenueGarantie] = useState(0);
  const [referenceInterne, setReferenceInterne] = useState("");
  const [indexationActive, setIndexationActive] = useState(false);
  const [indexationReference, setIndexationReference] = useState("BT01 — Matériaux");
  const [indexationDateBase, setIndexationDateBase] = useState("");
  const [indexationTauxMax, setIndexationTauxMax] = useState(5);
  const [indexationClause, setIndexationClause] = useState(DEFAULT_INDEXATION_CLAUSE);
  const [planningTaches, setPlanningTaches] = useState([]);
  const [annexes, setAnnexes] = useState([]);
  const [dpgfLoading, setDpgfLoading] = useState(false);
  const [annexeLoading, setAnnexeLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [mobileView, setMobileView] = useState("edit");
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    if (!open) return;
    setMobileView("edit");
    api.get("/client").then((r) => setClients(r.data));
    api.get("/chantier").then((r) => setChantiers(r.data.items || r.data));
    api.get("/devis/prestations").then((r) => setCatalog(r.data || [])).catch(() => setCatalog([]));
    api.get("/auth/profil").then((r) => {
      setOrganization(r.data.organization);
      if (devis) {
        setSignataireNom(devis.signataireNom || r.data.organization?.signataireNom || `${r.data.prenom || ""} ${r.data.nom || ""}`.trim());
        setSignataireFonction(devis.signataireFonction || r.data.organization?.signataireFonction || "Gérant");
      } else {
        setSignataireNom(r.data.organization?.signataireNom || `${r.data.prenom || ""} ${r.data.nom || ""}`.trim());
        setSignataireFonction(r.data.organization?.signataireFonction || "Gérant");
        setSignatureData("");
      }
    });

    if (devis) {
      setClientId(devis.client?._id || devis.client?.id || devis.clientId || "");
      setChantierId(devis.chantier?._id || devis.chantier?.id || devis.chantierId || "");
      setTva(devis.tva ?? 18);
      setValidite(devis.validite ?? 30);
      setDescription(devis.description || "");
      setConditions(devis.conditions || DEFAULT_CONDITIONS);
      setLignes(initLignes(devis));
      setSignatureData(devis.signatureData || "");
      setRemisePercent(devis.remisePercent ?? 0);
      setAcomptePercent(devis.acomptePercent ?? 30);
      setDelaiExecution(devis.delaiExecution || "");
      setRetenueGarantie(devis.retenueGarantie ?? 0);
      setReferenceInterne(devis.referenceInterne || "");
      setIndexationActive(devis.indexationActive ?? false);
      setIndexationReference(devis.indexationReference || "BT01 — Matériaux");
      setIndexationDateBase(devis.indexationDateBase ? String(devis.indexationDateBase).slice(0, 10) : "");
      setIndexationTauxMax(devis.indexationTauxMax ?? 5);
      setIndexationClause(devis.indexationClause || DEFAULT_INDEXATION_CLAUSE);
      setPlanningTaches(initPlanningTaches(devis));
      setAnnexes(devis.annexes || []);
    } else {
      setClientId("");
      setChantierId("");
      setTva(18);
      setValidite(30);
      setDescription("");
      setConditions(DEFAULT_CONDITIONS);
      setLignes([{ ...EMPTY_LINE }]);
      setRemisePercent(0);
      setAcomptePercent(30);
      setDelaiExecution("");
      setRetenueGarantie(0);
      setReferenceInterne("");
      setIndexationActive(false);
      setIndexationReference("BT01 — Matériaux");
      setIndexationDateBase("");
      setIndexationTauxMax(5);
      setIndexationClause(DEFAULT_INDEXATION_CLAUSE);
      setPlanningTaches([]);
      setAnnexes([]);
    }
    setError("");
    setFieldErrors({});
  }, [open, devis]);

  useEffect(() => {
    if (!open) return;
    const devisId = devis?._id || devis?.id;
    if (!devisId) return;
    api.get(`/devis/${devisId}/annexes`).then((r) => setAnnexes(r.data.items || [])).catch(() => setAnnexes([]));
  }, [open, devis?._id, devis?.id]);

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
    : devis?.client && typeof devis.client === "object"
      ? devis.client
      : null;

  const previewChantier = selectedChantier
    ? { nom: selectedChantier.nom, adresse: selectedChantier.adresse, ville: selectedChantier.ville, pays: selectedChantier.pays }
    : devis?.chantier && typeof devis.chantier === "object"
      ? devis.chantier
      : null;

  const totals = useMemo(() => computeDevisTotals(lignes, tva, remisePercent, retenueGarantie), [lignes, tva, remisePercent, retenueGarantie]);
  const { montantHT, montantTVA, montantTTC, netAPayer } = totals;
  const ganttSections = useMemo(() => {
    const fromLines = [...new Set(lignes.map((l) => l.section).filter(Boolean))];
    return fromLines.length ? fromLines : DEVIS_SECTIONS;
  }, [lignes]);

  const updateLigne = (i, key, val) => {
    setLignes((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  };

  const addLigne = () => setLignes((rows) => [...rows, { ...EMPTY_LINE }]);
  const removeLigne = (i) => setLignes((rows) => rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows);

  const addCatalogLigne = (item) => {
    const row = {
      section: item.categorie || "Général",
      reference: "",
      designation: item.designation,
      detailDescription: "",
      quantite: 1,
      unite: item.unite || "u",
      prixUnitaire: Number(item.prixUnitaire) || 0,
      tva: 18,
      isOption: false,
    };
    setLignes((rows) => {
      const emptyIdx = rows.findIndex((r) => !r.designation.trim());
      if (emptyIdx >= 0) {
        return rows.map((r, idx) => (idx === emptyIdx ? { ...r, ...row } : r));
      }
      return [...rows, row];
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

  const handleDpgfImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDpgfLoading(true);
    setError("");
    try {
      const res = await uploadFile("/devis/import-dpgf", file);
      const imported = (res.data.lignes || []).map((l) => ({
        section: l.section || "Général",
        reference: l.reference || "",
        designation: l.designation || "",
        detailDescription: l.detailDescription || "",
        quantite: l.quantite ?? 1,
        unite: l.unite || "u",
        prixUnitaire: l.prixUnitaire ?? 0,
        tva: l.tva ?? 18,
        isOption: l.isOption ?? false,
      }));
      if (imported.length) setLignes(imported);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Import DPGF impossible");
    } finally {
      setDpgfLoading(false);
      e.target.value = "";
    }
  };

  const handleDownloadDpgfTemplate = async () => {
    try {
      await downloadFile("/devis/dpgf-template", "modele_dpgf.xlsx");
    } catch (err) {
      setError(err.message || "Téléchargement impossible");
    }
  };

  const handleAnnexeUpload = async (e) => {
    const file = e.target.files?.[0];
    const devisId = devis?._id || devis?.id;
    if (!file || !devisId) return;
    setAnnexeLoading(true);
    setError("");
    try {
      const res = await uploadFile(`/devis/${devisId}/annexes`, file, {
        nom: file.name,
        type: file.type === "application/pdf" ? "PLAN" : "AUTRE",
      });
      setAnnexes((items) => [...items, res.data.annexe]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Upload annexe impossible");
    } finally {
      setAnnexeLoading(false);
      e.target.value = "";
    }
  };

  const handleDeleteAnnexe = async (annexeId) => {
    const devisId = devis?._id || devis?.id;
    if (!devisId) return;
    try {
      await api.delete(`/devis/${devisId}/annexes/${annexeId}`);
      setAnnexes((items) => items.filter((a) => a.id !== annexeId));
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Suppression impossible");
    }
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
            isOption: Boolean(l.isOption),
          })),
        tva: Number(tva),
        remisePercent: Number(remisePercent) || 0,
        acomptePercent: Number(acomptePercent) || 30,
        delaiExecution: delaiExecution.trim() || undefined,
        retenueGarantie: Number(retenueGarantie) || 0,
        referenceInterne: referenceInterne.trim() || undefined,
        indexationActive,
        indexationReference: indexationActive ? indexationReference.trim() || undefined : undefined,
        indexationDateBase: indexationActive && indexationDateBase ? indexationDateBase : undefined,
        indexationTauxMax: indexationActive ? Number(indexationTauxMax) || 0 : undefined,
        indexationClause: indexationActive ? indexationClause.trim() || undefined : undefined,
        planningTaches: planningTaches.filter((t) => t.libelle?.trim() && t.dateDebut && t.dateFin),
        validite: Number(validite),
        description,
        conditions,
        signataireNom: signataireNom.trim() || undefined,
        signataireFonction: signataireFonction.trim() || undefined,
        signatureData: signatureData || undefined,
      };

      if (devis?._id || devis?.id) {
        await api.put(`/devis/${devis._id || devis.id}`, payload);
      } else {
        await api.post("/devis", payload);
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
    <DevisDocument
      organization={organization}
      client={previewClient}
      chantier={previewChantier}
      numero={devis?.numeroAffiche || devis?.numero}
      version={devis?.version || 1}
      parentDevisNumero={devis?.parentDevisNumero || devis?.parentDevis?.numero}
      dateEmission={devis?.dateEmission || devis?.date}
      validite={validite}
      description={description}
      conditions={conditions}
      lignes={lignes}
      tva={tva}
      remisePercent={remisePercent}
      acomptePercent={acomptePercent}
      delaiExecution={delaiExecution}
      retenueGarantie={retenueGarantie}
      referenceInterne={referenceInterne}
      signataireNom={signataireNom}
      signataireFonction={signataireFonction}
      signatureData={signatureData}
      clientAccepteNom={devis?.clientAccepteNom}
      clientAccepteLe={devis?.clientAccepteLe}
      clientSignatureData={devis?.clientSignatureData}
      indexationActive={indexationActive}
      indexationReference={indexationReference}
      indexationDateBase={indexationDateBase}
      indexationTauxMax={indexationTauxMax}
      indexationClause={indexationClause}
      planningTaches={planningTaches}
      annexes={annexes}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
      {/* Barre supérieure */}
      <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 bg-gray-900 text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-blue-600 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold truncate">
              {devis ? `Modifier le devis ${devis.numero || ""}` : "Nouveau devis"}
            </h2>
            <p className="text-xs text-gray-400 truncate">
              Calculs automatiques · Net à payer {formatFCFA(netAPayer ?? montantTTC)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle mobile */}
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
            form="devis-form"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg transition"
          >
            {loading ? "Enregistrement…" : devis ? "Mettre à jour" : "Créer le devis"}
          </button>
          <button type="button" onClick={handleClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Panneau édition */}
        <div
          className={`w-full lg:w-[44%] bg-gray-100 dark:bg-gray-900 overflow-y-auto ${
            mobileView === "preview" ? "hidden lg:block" : ""
          }`}
        >
          <form id="devis-form" onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
            {error && <FormAlert>{error}</FormAlert>}

            {/* Client & projet */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Destinataire</h3>
              <FormGrid cols={1}>
                <FormField label="Client" required error={fieldErrors.client}>
                  <FormSelect value={clientId} onChange={(e) => setClientId(e.target.value)} error={fieldErrors.client}>
                    <option value="">— Sélectionner un client —</option>
                    {clients.map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>{c.nom}</option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField label="Chantier lié" hint="Optionnel — rattache le devis à un projet">
                  <FormSelect value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
                    <option value="">— Aucun chantier —</option>
                    {chantiers.map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>{c.nom}</option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField label="Objet du devis" hint="Apparaît en tête du document envoyé au client">
                  <FormTextarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex. Rénovation complète villa 4 chambres — gros œuvre et second œuvre"
                    rows={2}
                  />
                </FormField>
              </FormGrid>
            </section>

            {/* Lignes */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex justify-between items-center gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Prestations</h3>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <Calculator className="w-3 h-3" /> Total ligne = Qté × P.U. HT — mis à jour en direct
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={handleDownloadDpgfTemplate}
                    className="text-[11px] px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Modèle DPGF
                  </button>
                  <label className="text-[11px] px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer inline-flex items-center gap-1">
                    <Upload className="w-3 h-3" /> {dpgfLoading ? "Import…" : "Import Excel"}
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleDpgfImport} disabled={dpgfLoading} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setLignes((rows) => autoGenerateReferences(rows))}
                    className="text-[11px] px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Références auto
                  </button>
                  <span className="text-xs text-gray-500">{totals.nbLignes} ligne(s){totals.nbOptions ? ` · ${totals.nbOptions} option(s)` : ""}</span>
                </div>
              </div>

              {fieldErrors.lignes && <p className="text-xs text-red-500">{fieldErrors.lignes}</p>}

              {catalog.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-500">Catalogue — cliquez pour ajouter une ligne</p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {catalog.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addCatalogLigne(item)}
                        className="text-[11px] px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition"
                        title={item.categorie ? `${item.categorie} · ${item.unite}` : item.unite}
                      >
                        + {item.designation}
                        {Number(item.prixUnitaire) > 0 && (
                          <span className="opacity-70"> · {formatFCFA(item.prixUnitaire)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-x-auto">
                <table className="w-full min-w-[780px] text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="p-2 text-left font-medium w-24">Lot</th>
                      <th className="p-2 text-left font-medium">Réf. / Désignation / Détail</th>
                      <th className="p-2 text-center font-medium w-14">Qté</th>
                      <th className="p-2 text-center font-medium w-16">Unité</th>
                      <th className="p-2 text-right font-medium w-20">P.U.</th>
                      <th className="p-2 text-center font-medium w-14">TVA</th>
                      <th className="p-2 text-center font-medium w-12">Opt.</th>
                      <th className="p-2 text-right font-medium w-24">Total</th>
                      <th className="p-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, i) => {
                      const qty = Number(l.quantite) || 0;
                      const pu = Number(l.prixUnitaire) || 0;
                      const total = ligneTotal(l);
                      return (
                        <tr key={i} className={`border-t border-gray-100 dark:border-gray-700 ${l.isOption ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}>
                          <td className="p-1.5 align-top">
                            <select
                              className={`${inputCompactLeft} text-[11px]`}
                              value={l.section || "Général"}
                              onChange={(e) => updateLigne(i, "section", e.target.value)}
                            >
                              {DEVIS_SECTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5 space-y-1">
                            <input
                              className={`${inputCompactLeft} text-[11px] font-mono`}
                              value={l.reference || ""}
                              onChange={(e) => updateLigne(i, "reference", e.target.value)}
                              placeholder="GO-01"
                            />
                            <input
                              className={inputCompactLeft}
                              value={l.designation}
                              onChange={(e) => updateLigne(i, "designation", e.target.value)}
                              placeholder="Désignation"
                            />
                            <input
                              className={`${inputCompactLeft} text-[11px] text-gray-500`}
                              value={l.detailDescription || ""}
                              onChange={(e) => updateLigne(i, "detailDescription", e.target.value)}
                              placeholder="Précisions (matériaux, normes…)"
                            />
                          </td>
                          <td className="p-1.5 align-top">
                            <input type="number" min="0" className={inputCompact} value={l.quantite} onChange={(e) => updateLigne(i, "quantite", e.target.value)} />
                          </td>
                          <td className="p-1.5 align-top">
                            <select className={`${inputCompactLeft} pr-6`} value={l.unite} onChange={(e) => updateLigne(i, "unite", e.target.value)}>
                              {UNITES.map((u) => (<option key={u} value={u}>{u}</option>))}
                            </select>
                          </td>
                          <td className="p-1.5 align-top">
                            <input type="number" min="0" className={inputCompact} value={l.prixUnitaire} onChange={(e) => updateLigne(i, "prixUnitaire", e.target.value)} />
                          </td>
                          <td className="p-1.5 align-top">
                            <select className={inputCompact} value={l.tva ?? 18} onChange={(e) => updateLigne(i, "tva", e.target.value)}>
                              {TVA_RATES.map((r) => (<option key={r} value={r}>{r}%</option>))}
                            </select>
                          </td>
                          <td className="p-1.5 align-top text-center">
                            <input type="checkbox" checked={!!l.isOption} onChange={(e) => updateLigne(i, "isOption", e.target.checked)} title="Ligne optionnelle (hors total)" />
                          </td>
                          <td className="p-1.5 text-right align-top">
                            <p className="font-semibold whitespace-nowrap">{formatFCFA(total)}{l.isOption ? " *" : ""}</p>
                          </td>
                          <td className="p-1.5 align-top">
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
                  className="w-full py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center gap-1 border-t dark:border-gray-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                </button>
              </div>

              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5" />
                    Totaux calculés automatiquement
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">TVA défaut</label>
                    <input type="number" min="0" max="100" value={tva} onChange={(e) => setTva(e.target.value)} className="w-14 px-2 py-1 text-xs text-center rounded-md border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700" />
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
                  <div className="rounded-lg bg-blue-600 p-2.5 text-white">
                    <p className="text-blue-200">Net à payer</p>
                    <p className="font-bold text-sm">{formatFCFA(netAPayer ?? montantTTC)}</p>
                    {totals.optionsHT > 0 && <p className="text-[10px] text-blue-200">+ options {formatFCFA(totals.optionsHT)} HT</p>}
                  </div>
                </div>
              </div>
            </section>

            {/* Planning Gantt — AO */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Planning prévisionnel (Gantt)</h3>
              </div>
              <p className="text-xs text-gray-500">Phases du chantier — visible sur le PDF et l&apos;aperçu client.</p>
              <DevisGantt tasks={planningTaches} onChange={setPlanningTaches} sections={ganttSections} />
            </section>

            {/* Indexation matériaux — AO */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Indexation matériaux</h3>
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={indexationActive} onChange={(e) => setIndexationActive(e.target.checked)} />
                  Activer la clause
                </label>
              </div>
              {indexationActive && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="Indice de référence" hint="Ex. BT01 Ciment, BT02 Acier">
                    <FormInput value={indexationReference} onChange={(e) => setIndexationReference(e.target.value)} />
                  </FormField>
                  <FormField label="Date base des prix">
                    <FormInput type="date" value={indexationDateBase} onChange={(e) => setIndexationDateBase(e.target.value)} />
                  </FormField>
                  <FormField label="Plafond de révision (%)" hint="Variation max appliquée">
                    <FormInput type="number" min="0" max="100" value={indexationTauxMax} onChange={(e) => setIndexationTauxMax(e.target.value)} />
                  </FormField>
                  <div className="md:col-span-2">
                    <FormField label="Clause personnalisée">
                      <FormTextarea value={indexationClause} onChange={(e) => setIndexationClause(e.target.value)} rows={3} />
                    </FormField>
                  </div>
                </div>
              )}
            </section>

            {/* Annexes PDF — AO */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Annexes (plans, DPGF signé…)</h3>
              </div>
              {!(devis?._id || devis?.id) ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">Enregistrez le devis une première fois pour joindre des PDF.</p>
              ) : (
                <>
                  <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <Upload className="w-3.5 h-3.5" />
                    {annexeLoading ? "Envoi…" : "Ajouter un PDF / plan"}
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleAnnexeUpload} disabled={annexeLoading} />
                  </label>
                  {annexes.length > 0 && (
                    <ul className="space-y-1.5">
                      {annexes.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 text-xs rounded-md border border-gray-200 dark:border-gray-600 px-2.5 py-2">
                          <span className="truncate">[{a.type}] {a.nom}</span>
                          <button type="button" onClick={() => handleDeleteAnnexe(a.id)} className="text-red-600 shrink-0 hover:underline">
                            Supprimer
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-gray-500">Les PDF annexes sont listés sur le devis et joints à l&apos;email d&apos;envoi.</p>
                </>
              )}
            </section>

            {/* Signature */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Signataire entreprise</h3>
              <p className="text-xs text-gray-500">Apparaît sur le PDF avec votre signature manuscrite</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Nom du signataire">
                  <FormInput value={signataireNom} onChange={(e) => setSignataireNom(e.target.value)} placeholder="Ex. Jean Kouassi" />
                </FormField>
                <FormField label="Fonction">
                  <FormInput value={signataireFonction} onChange={(e) => setSignataireFonction(e.target.value)} placeholder="Ex. Gérant, Directeur" />
                </FormField>
              </div>
              <FormField label="Signature manuscrite">
                <SignaturePad value={signatureData} onChange={setSignatureData} />
              </FormField>
            </section>

            {/* Conditions & paramètres */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Conditions & paramètres</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Remise globale (%)" hint="Appliquée sur le total HT">
                  <FormInput type="number" min="0" max="100" value={remisePercent} onChange={(e) => setRemisePercent(e.target.value)} />
                </FormField>
                <FormField label="Retenue de garantie (%)" hint="Déduite du TTC">
                  <FormInput type="number" min="0" max="100" value={retenueGarantie} onChange={(e) => setRetenueGarantie(e.target.value)} />
                </FormField>
                <FormField label="Acompte (%)" hint="Affiché sur le PDF">
                  <FormInput type="number" min="0" max="100" value={acomptePercent} onChange={(e) => setAcomptePercent(e.target.value)} />
                </FormField>
                <FormField label="Validité (jours)">
                  <FormInput type="number" min="1" value={validite} onChange={(e) => setValidite(e.target.value)} />
                </FormField>
              </div>
              <FormField label="Référence dossier interne" hint="Visible sur le PDF (ex. CH-2026-VILLA)">
                <FormInput value={referenceInterne} onChange={(e) => setReferenceInterne(e.target.value)} placeholder="CH-2026-042" />
              </FormField>
              <FormField label="Délai d'exécution" hint="Ex. 45 jours ouvrés après acompte">
                <FormInput value={delaiExecution} onChange={(e) => setDelaiExecution(e.target.value)} placeholder="Ex. 60 jours ouvrés" />
              </FormField>
              <FormField label="Conditions de paiement" hint="Visible sur le document client">
                <FormTextarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={4} />
              </FormField>
            </section>
          </form>
        </div>

        {/* Aperçu document */}
        <div
          className={`flex-1 bg-gray-300 dark:bg-gray-950 overflow-y-auto p-4 md:p-8 items-start justify-center ${
            mobileView === "edit" ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="w-full max-w-[210mm] mx-auto">
            <p className="text-xs text-gray-500 dark:text-gray-500 text-center mb-3 uppercase tracking-wider font-medium">
              Aperçu — document envoyé au client
            </p>
            {documentPreview}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormGrid({ cols = 1, children }) {
  const colClass = cols === 2 ? "md:grid-cols-2" : "grid-cols-1";
  return <div className={`grid grid-cols-1 ${colClass} gap-4`}>{children}</div>;
}
