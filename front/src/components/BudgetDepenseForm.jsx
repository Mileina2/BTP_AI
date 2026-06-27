import { useEffect, useState } from "react";
import { Wallet, AlertTriangle } from "lucide-react";
import api from "../lib/api";
import { formatFCFA } from "../lib/format";
import {
  FormModal,
  FormSection,
  FormGrid,
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  FormMoneyInput,
  FormActions,
  FormAlert,
} from "./form/FormUI";

const CATEGORIES = ["Matériaux", "Main-d'œuvre", "Transport", "Sous-traitance", "Autre"];
const UNITES = ["u", "m²", "m³", "ml", "kg", "t", "h", "j", "forfait"];

const EMPTY = {
  categorie: "Matériaux",
  libelle: "",
  quantite: 1,
  unite: "u",
  prixUnitaire: "",
  fournisseur: "",
  commentaire: "",
  date: new Date().toISOString().slice(0, 10),
  dateEcheance: "",
  paye: false,
};

export default function BudgetDepenseForm({
  open,
  onClose,
  onSaved,
  chantierId,
  chantierName,
  chantiers = [],
  controle,
  editData,
}) {
  const [form, setForm] = useState(EMPTY);
  const [localChantierId, setLocalChantierId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const editId = editData?._id || editData?.id;
  const effectiveChantierId = chantierId || localChantierId || editData?.chantierId;
  const effectiveChantierName =
    chantierName ||
    chantiers.find((c) => (c.id || c._id) === effectiveChantierId)?.nom ||
    editData?.chantierNom;

  const total = (Number(form.quantite) || 0) * (Number(form.prixUnitaire) || 0);

  const budgetCtx = controle || chantiers.find((c) => (c.id || c._id) === effectiveChantierId);
  const restantApres = budgetCtx ? (budgetCtx.restant ?? budgetCtx.budgetRestant ?? 0) - (editId ? 0 : total) : null;
  const pctApres =
    budgetCtx && budgetCtx.budget > 0
      ? Math.round(((budgetCtx.depenses + (editId ? 0 : total)) / budgetCtx.budget) * 1000) / 10
      : null;

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        categorie: editData.categorie || "Matériaux",
        libelle: editData.libelle || "",
        quantite: editData.quantite ?? 1,
        unite: editData.unite || "u",
        prixUnitaire: editData.prixUnitaire ?? "",
        fournisseur: editData.fournisseur || "",
        commentaire: editData.commentaire || "",
        date: editData.date ? new Date(editData.date).toISOString().slice(0, 10) : EMPTY.date,
        dateEcheance: editData.dateEcheance ? new Date(editData.dateEcheance).toISOString().slice(0, 10) : "",
        paye: editData.paye ?? false,
      });
      setLocalChantierId(editData.chantierId || "");
    } else {
      setForm(EMPTY);
      setLocalChantierId(chantierId || "");
    }
    setError("");
    setFieldErrors({});
  }, [open, editData, chantierId]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const errs = {};
    if (!effectiveChantierId) errs.chantier = "Sélectionnez un chantier";
    if (!form.libelle.trim()) errs.libelle = "Libellé requis";
    if (!form.prixUnitaire || Number(form.prixUnitaire) < 0) errs.prixUnitaire = "Prix invalide";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleClose = () => {
    if (!loading) onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        ...form,
        quantite: Number(form.quantite),
        prixUnitaire: Number(form.prixUnitaire),
        paye: form.paye,
        dateEcheance: form.dateEcheance || null,
      };
      if (editId) await api.put(`/budget/${editId}`, payload);
      else await api.post("/budget", { ...payload, chantier: effectiveChantierId });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title={editId ? "Modifier la charge" : "Imputer une charge"}
      subtitle={
        effectiveChantierName
          ? `Projet : ${effectiveChantierName}`
          : "Sélectionnez le projet et saisissez la ligne de charge"
      }
      icon={<Wallet className="w-5 h-5" />}
      size="lg"
      footer={
        <FormActions
          formId="budget-form"
          onCancel={handleClose}
          submitLabel={editId ? "Mettre à jour" : "Enregistrer la dépense"}
          loading={loading}
        />
      }
    >
      <form id="budget-form" onSubmit={handleSubmit}>
        {error && <FormAlert>{error}</FormAlert>}
        {fieldErrors.chantier && <FormAlert>{fieldErrors.chantier}</FormAlert>}

        <div className="space-y-6">
          {!chantierId && !editId && (
            <FormSection title="Projet" description="Rattachement de la charge au budget d'un chantier">
              <FormField label="Chantier" required error={fieldErrors.chantier}>
                <FormSelect
                  value={localChantierId}
                  onChange={(e) => setLocalChantierId(e.target.value)}
                  error={fieldErrors.chantier}
                >
                  <option value="">— Sélectionner —</option>
                  {chantiers.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.nom}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </FormSection>
          )}

          <FormSection title="Détail de la dépense">
            <FormGrid>
              <FormField label="Libellé" required error={fieldErrors.libelle}>
                <FormInput
                  value={form.libelle}
                  onChange={(e) => set("libelle", e.target.value)}
                  placeholder="Ex. Ciment Portland 50 kg"
                  error={fieldErrors.libelle}
                />
              </FormField>
              <FormField label="Catégorie">
                <FormSelect value={form.categorie} onChange={(e) => set("categorie", e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Fournisseur">
                <FormInput
                  value={form.fournisseur}
                  onChange={(e) => set("fournisseur", e.target.value)}
                  placeholder="Nom du fournisseur"
                />
              </FormField>
              <FormField label="Date d'imputation">
                <FormInput type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </FormField>
              <FormField label="Échéance paiement fournisseur">
                <FormInput type="date" value={form.dateEcheance} onChange={(e) => set("dateEcheance", e.target.value)} />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Quantités & montants">
            <FormGrid cols={3}>
              <FormField label="Quantité">
                <FormInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantite}
                  onChange={(e) => set("quantite", e.target.value)}
                />
              </FormField>
              <FormField label="Unité">
                <FormSelect value={form.unite} onChange={(e) => set("unite", e.target.value)}>
                  {UNITES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Prix unitaire HT" required error={fieldErrors.prixUnitaire}>
                <FormMoneyInput
                  value={form.prixUnitaire}
                  onChange={(e) => set("prixUnitaire", e.target.value)}
                  error={fieldErrors.prixUnitaire}
                />
              </FormField>
            </FormGrid>

            <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Montant de la charge</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">{formatFCFA(total)}</span>
              </div>
              {budgetCtx && !editId && (
                <>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Budget restant après imputation</span>
                    <span className={`tabular-nums font-medium ${restantApres < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatFCFA(restantApres)}
                    </span>
                  </div>
                  {pctApres != null && (
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${pctApres >= 100 ? "bg-red-600" : pctApres >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(pctApres, 100)}%` }}
                      />
                    </div>
                  )}
                  {restantApres < 0 && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Cette charge entraîne un dépassement budgétaire
                    </p>
                  )}
                </>
              )}
            </div>
          </FormSection>

          <FormField label="Commentaire">
            <FormTextarea value={form.commentaire} onChange={(e) => set("commentaire", e.target.value)} rows={2} />
          </FormField>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.paye}
              onChange={(e) => set("paye", e.target.checked)}
              className="rounded border-gray-300"
            />
            Dépense soldée (paiement effectué)
          </label>
        </div>
      </form>
    </FormModal>
  );
}
