import { useEffect, useState } from "react";
import { HardHat } from "lucide-react";
import api from "../lib/api";
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

const ROLES = [
  "Chef de chantier", "Maçon", "Électricien", "Plombier", "Peintre", "Menuisier",
  "Manœuvre", "Conducteur d'engins", "Sous-traitant", "Autre",
];

const EMPTY = {
  nom: "",
  role: "",
  tauxHoraire: "",
  chantier: "",
  typeContrat: "CDD",
  dateEmbauche: "",
  dateFinContrat: "",
  heuresParJour: 8,
  joursParSemaine: 5,
  prime: 0,
  bonus: 0,
  retenue: 0,
};

export default function EquipeForm({ open, onClose, onSaved, editData, chantiers = [] }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        nom: editData.nom || "",
        role: editData.role || "",
        tauxHoraire: editData.tauxHoraire ?? "",
        chantier: editData.chantier?._id || editData.chantier?.id || editData.chantier || "",
        typeContrat: editData.typeContrat || "CDD",
        dateEmbauche: editData.dateEmbauche ? new Date(editData.dateEmbauche).toISOString().slice(0, 10) : "",
        dateFinContrat: editData.dateFinContrat ? new Date(editData.dateFinContrat).toISOString().slice(0, 10) : "",
        heuresParJour: editData.heuresParJour ?? 8,
        joursParSemaine: editData.joursParSemaine ?? 5,
        prime: editData.prime ?? 0,
        bonus: editData.bonus ?? 0,
        retenue: editData.retenue ?? 0,
      });
    } else {
      setForm(EMPTY);
    }
    setError("");
    setFieldErrors({});
  }, [open, editData]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const editId = editData?._id || editData?.id;

  const validate = () => {
    const errs = {};
    if (!form.nom.trim()) errs.nom = "Nom requis";
    if (!form.role.trim()) errs.role = "Rôle requis";
    if (!form.chantier) errs.chantier = "Chantier requis";
    if (!form.tauxHoraire || Number(form.tauxHoraire) <= 0) errs.tauxHoraire = "Taux horaire invalide";
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
        tauxHoraire: Number(form.tauxHoraire),
        heuresParJour: Number(form.heuresParJour),
        joursParSemaine: Number(form.joursParSemaine),
        prime: Number(form.prime),
        bonus: Number(form.bonus),
        retenue: Number(form.retenue),
      };
      if (editId) await api.put(`/equipe/${editId}`, payload);
      else await api.post("/equipe", payload);
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || "Erreur d'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title={editId ? "Modifier le membre" : "Nouveau membre d'équipe"}
      subtitle="Contrat, rémunération et affectation chantier"
      icon={<HardHat className="w-5 h-5" />}
      size="lg"
      footer={
        <FormActions
          formId="equipe-form"
          onCancel={handleClose}
          submitLabel={editId ? "Mettre à jour" : "Enregistrer"}
          loading={loading}
        />
      }
    >
      <form id="equipe-form" onSubmit={handleSubmit}>
        {error && <FormAlert>{error}</FormAlert>}

        <div className="space-y-6">
          <FormSection title="Identité & affectation">
            <FormGrid>
              <FormField label="Nom complet" required error={fieldErrors.nom}>
                <FormInput value={form.nom} onChange={(e) => set("nom", e.target.value)} error={fieldErrors.nom} />
              </FormField>
              <FormField label="Rôle / fonction" required error={fieldErrors.role}>
                <FormSelect value={form.role} onChange={(e) => set("role", e.target.value)} error={fieldErrors.role}>
                  <option value="">— Sélectionner —</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  {form.role && !ROLES.includes(form.role) && <option value={form.role}>{form.role}</option>}
                </FormSelect>
              </FormField>
              <FormField label="Chantier" required error={fieldErrors.chantier}>
                <FormSelect value={form.chantier} onChange={(e) => set("chantier", e.target.value)} error={fieldErrors.chantier}>
                  <option value="">— Sélectionner —</option>
                  {chantiers.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>{c.nom}</option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Type de contrat">
                <FormSelect value={form.typeContrat} onChange={(e) => set("typeContrat", e.target.value)}>
                  <option value="CDD">CDD</option>
                  <option value="CDI">CDI</option>
                  <option value="Journalier">Journalier</option>
                  <option value="Sous-traitant">Sous-traitant</option>
                </FormSelect>
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Contrat">
            <FormGrid>
              <FormField label="Date d'embauche">
                <FormInput type="date" value={form.dateEmbauche} onChange={(e) => set("dateEmbauche", e.target.value)} />
              </FormField>
              <FormField label="Fin de contrat">
                <FormInput type="date" value={form.dateFinContrat} onChange={(e) => set("dateFinContrat", e.target.value)} />
              </FormField>
              <FormField label="Heures / jour">
                <FormInput type="number" min="1" max="24" value={form.heuresParJour} onChange={(e) => set("heuresParJour", e.target.value)} />
              </FormField>
              <FormField label="Jours / semaine">
                <FormInput type="number" min="1" max="7" value={form.joursParSemaine} onChange={(e) => set("joursParSemaine", e.target.value)} />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Rémunération">
            <FormGrid cols={3}>
              <FormField label="Taux horaire" required error={fieldErrors.tauxHoraire}>
                <FormMoneyInput
                  value={form.tauxHoraire}
                  onChange={(e) => set("tauxHoraire", e.target.value)}
                  error={fieldErrors.tauxHoraire}
                />
              </FormField>
              <FormField label="Prime mensuelle">
                <FormMoneyInput value={form.prime} onChange={(e) => set("prime", e.target.value)} />
              </FormField>
              <FormField label="Bonus">
                <FormMoneyInput value={form.bonus} onChange={(e) => set("bonus", e.target.value)} />
              </FormField>
              <FormField label="Retenue">
                <FormMoneyInput value={form.retenue} onChange={(e) => set("retenue", e.target.value)} />
              </FormField>
            </FormGrid>
          </FormSection>
        </div>
      </form>
    </FormModal>
  );
}
