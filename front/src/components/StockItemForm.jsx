import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import api from "../lib/api";
import { formatMoney } from "../lib/format";
import {
  FormModal,
  FormSection,
  FormGrid,
  FormField,
  FormInput,
  FormSelect,
  FormMoneyInput,
  FormActions,
  FormAlert,
} from "./form/FormUI";

const CATEGORIES = ["Matériaux", "Outils", "Carburant", "Équipement", "Consommable", "Autre"];
const UNITES = ["unité", "m²", "m³", "ml", "kg", "t", "palette", "lot"];

const EMPTY = {
  nom: "",
  categorie: "Matériaux",
  reference: "",
  unite: "unité",
  stockInitial: 0,
  quantiteActuelle: 0,
  seuilAlerte: 10,
  prixUnitaire: "",
  liaisonBudget: false,
};

export default function StockItemForm({ open, onClose, onSaved, chantierId, chantierName, editData }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const editId = editData?._id || editData?.id;
  const valeur = (Number(editId ? form.quantiteActuelle : form.stockInitial) || 0) * (Number(form.prixUnitaire) || 0);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        nom: editData.nom || "",
        categorie: editData.categorie || "Matériaux",
        reference: editData.reference || "",
        unite: editData.unite || "unité",
        stockInitial: editData.stockInitial ?? 0,
        quantiteActuelle: editData.quantiteActuelle ?? 0,
        seuilAlerte: editData.seuilAlerte ?? 10,
        prixUnitaire: editData.prixUnitaire ?? "",
        liaisonBudget: editData.liaisonBudget ?? false,
      });
    } else {
      setForm(EMPTY);
    }
    setError("");
    setFieldErrors({});
  }, [open, editData]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const errs = {};
    if (!chantierId) errs.chantier = "Sélectionnez un chantier";
    if (!form.nom.trim()) errs.nom = "Nom requis";
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
      const qty = editId ? Number(form.quantiteActuelle) : Number(form.stockInitial) || 0;
      const payload = {
        nom: form.nom.trim(),
        categorie: form.categorie,
        reference: form.reference,
        unite: form.unite,
        quantiteActuelle: qty,
        seuilAlerte: Number(form.seuilAlerte),
        prixUnitaire: Number(form.prixUnitaire) || 0,
        liaisonBudget: form.liaisonBudget,
        chantier: chantierId,
      };
      if (editId) await api.put(`/stock/${editId}`, payload);
      else await api.post("/stock", payload);
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
      title={editId ? "Modifier l'article" : "Nouvel article de stock"}
      subtitle={chantierName ? `Chantier : ${chantierName}` : "Gestion des matériaux et équipements"}
      icon={<Package className="w-5 h-5" />}
      size="lg"
      footer={
        <FormActions
          onCancel={handleClose}
          submitLabel={editId ? "Mettre à jour" : "Enregistrer"}
          loading={loading}
          onSubmit={() => handleSubmit({ preventDefault: () => {} })}
        />
      }
    >
      <form id="stock-form" onSubmit={handleSubmit}>
        {error && <FormAlert>{error}</FormAlert>}
        {fieldErrors.chantier && <FormAlert>{fieldErrors.chantier}</FormAlert>}

        <div className="space-y-6">
          <FormSection title="Article">
            <FormGrid>
              <FormField label="Nom de l'article" required error={fieldErrors.nom}>
                <FormInput value={form.nom} onChange={(e) => set("nom", e.target.value)} error={fieldErrors.nom} />
              </FormField>
              <FormField label="Référence / code">
                <FormInput value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="REF-001" />
              </FormField>
              <FormField label="Catégorie">
                <FormSelect value={form.categorie} onChange={(e) => set("categorie", e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="Unité">
                <FormSelect value={form.unite} onChange={(e) => set("unite", e.target.value)}>
                  {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
                </FormSelect>
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Stock & valorisation">
            <FormGrid cols={3}>
              {!editId ? (
                <FormField label="Quantité initiale" hint="Stock au moment de la création">
                  <FormInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.stockInitial}
                    onChange={(e) => setForm((f) => ({ ...f, stockInitial: e.target.value, quantiteActuelle: e.target.value }))}
                  />
                </FormField>
              ) : (
                <FormField label="Quantité actuelle">
                  <FormInput type="number" min="0" step="0.01" value={form.quantiteActuelle} onChange={(e) => set("quantiteActuelle", e.target.value)} />
                </FormField>
              )}
              <FormField label="Seuil d'alerte" hint="Alerte si stock ≤ ce seuil">
                <FormInput type="number" min="0" value={form.seuilAlerte} onChange={(e) => set("seuilAlerte", e.target.value)} />
              </FormField>
              <FormField label="Prix unitaire">
                <FormMoneyInput value={form.prixUnitaire} onChange={(e) => set("prixUnitaire", e.target.value)} />
              </FormField>
            </FormGrid>

            <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex justify-between text-sm">
              <span className="text-gray-500">Valeur totale en stock</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">{formatMoney(valeur)}</span>
            </div>

            <label className="flex items-center gap-2 mt-4 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={form.liaisonBudget}
                onChange={(e) => set("liaisonBudget", e.target.checked)}
                className="rounded border-gray-300"
              />
              Lier automatiquement aux dépenses du chantier
            </label>
          </FormSection>
        </div>
      </form>
    </FormModal>
  );
}
