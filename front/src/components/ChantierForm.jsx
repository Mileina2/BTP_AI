import { useState } from "react";
import { Building2 } from "lucide-react";
import api from "../lib/api";
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

const TYPES_TRAVAUX = ["Construction", "Rénovation", "Aménagement", "Infrastructure", "Autre"];
const STATUTS = ["En préparation", "En cours", "Terminé", "Suspendu"];
const PAYS = [
  "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Cameroun", "Bénin", "Togo", "Gabon", "France",
];

const EMPTY = {
  nom: "",
  description: "",
  clientId: "",
  adresse: "",
  ville: "",
  pays: "Côte d'Ivoire",
  budget: "",
  typeTravaux: "Construction",
  dateDebut: "",
  dateFin: "",
  statut: "En préparation",
};

export default function ChantierForm({ open, onClose, onSaved, clients = [] }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const errs = {};
    if (!form.nom.trim()) errs.nom = "Le nom du chantier est requis";
    if (!form.clientId) errs.clientId = "Sélectionnez un client";
    if (!form.budget || Number(form.budget) <= 0) errs.budget = "Budget invalide";
    if (form.dateDebut && form.dateFin && form.dateFin < form.dateDebut) {
      errs.dateFin = "La date de fin doit être après le début";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleClose = () => {
    if (!loading) {
      setForm(EMPTY);
      setError("");
      setFieldErrors({});
      onClose?.();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setLoading(true);
    try {
      await api.post("/chantier", {
        ...form,
        clientId: form.clientId,
        budget: Number(form.budget),
      });
      setForm(EMPTY);
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de la création du chantier");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title="Nouveau chantier"
      subtitle="Créez un projet avec client, budget et planning"
      icon={<Building2 className="w-5 h-5" />}
      size="lg"
      footer={
        <FormActions
          formId="chantier-form"
          onCancel={handleClose}
          submitLabel="Créer le chantier"
          loading={loading}
        />
      }
    >
      <form id="chantier-form" onSubmit={handleSubmit}>
        {error && <FormAlert>{error}</FormAlert>}

        <div className="space-y-6">
          <FormSection title="Identification" description="Informations générales du projet">
            <FormGrid>
              <FormField label="Nom du chantier" required error={fieldErrors.nom}>
                <FormInput
                  value={form.nom}
                  onChange={(e) => set("nom", e.target.value)}
                  placeholder="Ex. Villa Résidentielle Cocody"
                  error={fieldErrors.nom}
                />
              </FormField>
              <FormField label="Client" required error={fieldErrors.clientId}>
                <FormSelect
                  value={form.clientId}
                  onChange={(e) => set("clientId", e.target.value)}
                  error={fieldErrors.clientId}
                >
                  <option value="">— Sélectionner un client —</option>
                  {clients.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>{c.nom}</option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Type de travaux">
                <FormSelect value={form.typeTravaux} onChange={(e) => set("typeTravaux", e.target.value)}>
                  {TYPES_TRAVAUX.map((t) => <option key={t} value={t}>{t}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="Statut initial">
                <FormSelect value={form.statut} onChange={(e) => set("statut", e.target.value)}>
                  {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="Description" className="md:col-span-2">
                <FormTextarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Objectifs, contraintes, notes internes..."
                  rows={2}
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Localisation">
            <FormGrid cols={3}>
              <FormField label="Ville">
                <FormInput value={form.ville} onChange={(e) => set("ville", e.target.value)} placeholder="Abidjan" />
              </FormField>
              <FormField label="Pays">
                <FormSelect value={form.pays} onChange={(e) => set("pays", e.target.value)}>
                  {PAYS.map((p) => <option key={p} value={p}>{p}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="Adresse" className="md:col-span-3">
                <FormInput
                  value={form.adresse}
                  onChange={(e) => set("adresse", e.target.value)}
                  placeholder="Rue, quartier, repères..."
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Budget & planning" description="Montants et dates clés du projet">
            <FormGrid>
              <FormField label="Budget prévisionnel" required error={fieldErrors.budget} hint="Montant total engagé pour ce chantier">
                <FormMoneyInput
                  value={form.budget}
                  onChange={(e) => set("budget", e.target.value)}
                  placeholder="0"
                  error={fieldErrors.budget}
                />
              </FormField>
              <div />
              <FormField label="Date de début">
                <FormInput type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)} />
              </FormField>
              <FormField label="Date de fin prévue" error={fieldErrors.dateFin}>
                <FormInput
                  type="date"
                  value={form.dateFin}
                  onChange={(e) => set("dateFin", e.target.value)}
                  error={fieldErrors.dateFin}
                />
              </FormField>
            </FormGrid>
          </FormSection>
        </div>
      </form>
    </FormModal>
  );
}
