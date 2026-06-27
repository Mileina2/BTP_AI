import { useEffect, useState } from "react";
import { UserPlus, Edit } from "lucide-react";
import api from "../lib/api";
import {
  FormModal,
  FormSection,
  FormGrid,
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  FormActions,
  FormAlert,
} from "./form/FormUI";

const PAYS = [
  "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Cameroun", "Bénin", "Togo", "Gabon",
  "France", "Maroc", "Algérie", "Niger", "Guinée", "Congo", "Autre",
];
const SECTEURS = ["BTP", "Commerce", "Industrie", "Agriculture", "Transport", "Technologie", "Santé", "Éducation", "Autre"];

const EMPTY = {
  nom: "",
  email: "",
  telephone: "",
  pays: "Côte d'Ivoire",
  adresse: "",
  type: "Particulier",
  secteurActivite: "",
  statutRelation: "Prospect",
  notes: "",
};

function clientToForm(c) {
  if (!c) return EMPTY;
  return {
    nom: c.nom || "",
    email: c.email || "",
    telephone: c.telephone || "",
    pays: c.pays || "Côte d'Ivoire",
    adresse: c.adresse || "",
    type: c.type || "Particulier",
    secteurActivite: c.secteurActivite || "",
    statutRelation: c.statutRelation || "Prospect",
    notes: c.notes || "",
  };
}

export default function ClientForm({ open, onClose, onSaved, client }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const editId = client?._id || client?.id;
  const isEdit = Boolean(editId);

  useEffect(() => {
    if (!open) return;
    setForm(clientToForm(client));
    setError("");
    setFieldErrors({});
  }, [open, client]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const errs = {};
    if (!form.nom.trim()) errs.nom = "Le nom est requis";
    if (!form.telephone.trim()) errs.telephone = "Le téléphone est requis";
    if (!form.pays.trim()) errs.pays = "Le pays est requis";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Email invalide";
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
      const payload = {
        nom: form.nom,
        email: form.email || undefined,
        telephone: form.telephone,
        pays: form.pays,
        adresse: form.adresse,
        type: form.type,
        secteurActivite: form.secteurActivite || undefined,
        statutRelation: form.statutRelation,
        notes: form.notes,
      };
      if (isEdit) await api.put(`/client/${editId}`, payload);
      else await api.post("/client", payload);
      setForm(EMPTY);
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
      title={isEdit ? "Modifier le client" : "Nouveau client"}
      subtitle="Fiche client pour suivi commercial et facturation"
      icon={isEdit ? <Edit className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
      size="lg"
      footer={
        <FormActions
          formId="client-form"
          onCancel={handleClose}
          submitLabel={isEdit ? "Mettre à jour" : "Enregistrer le client"}
          loading={loading}
        />
      }
    >
      <form id="client-form" onSubmit={handleSubmit}>
        {error && <FormAlert>{error}</FormAlert>}

        <div className="space-y-6">
          <FormSection title="Coordonnées" description="Informations de contact principales">
            <FormGrid>
              <FormField label="Nom / Raison sociale" required error={fieldErrors.nom}>
                <FormInput
                  value={form.nom}
                  onChange={(e) => set("nom", e.target.value)}
                  placeholder="Nom du client ou entreprise"
                  error={fieldErrors.nom}
                />
              </FormField>
              <FormField label="Type de client">
                <FormSelect value={form.type} onChange={(e) => set("type", e.target.value)}>
                  <option value="Particulier">Particulier</option>
                  <option value="Entreprise">Entreprise</option>
                </FormSelect>
              </FormField>
              <FormField label="Téléphone" required error={fieldErrors.telephone}>
                <FormInput
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => set("telephone", e.target.value)}
                  placeholder="+225 07 00 00 00 00"
                  error={fieldErrors.telephone}
                />
              </FormField>
              <FormField label="Email" error={fieldErrors.email}>
                <FormInput
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="contact@entreprise.com"
                  error={fieldErrors.email}
                />
              </FormField>
              <FormField label="Pays" required error={fieldErrors.pays}>
                <FormSelect value={form.pays} onChange={(e) => set("pays", e.target.value)} error={fieldErrors.pays}>
                  {PAYS.map((p) => <option key={p} value={p}>{p}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="Adresse">
                <FormInput
                  value={form.adresse}
                  onChange={(e) => set("adresse", e.target.value)}
                  placeholder="Adresse complète"
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Commercial" description="Qualification et relation client">
            <FormGrid>
              <FormField label="Secteur d'activité">
                <FormSelect value={form.secteurActivite} onChange={(e) => set("secteurActivite", e.target.value)}>
                  <option value="">— Non renseigné —</option>
                  {SECTEURS.map((s) => <option key={s} value={s}>{s}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="Statut relationnel">
                <FormSelect value={form.statutRelation} onChange={(e) => set("statutRelation", e.target.value)}>
                  <option value="Prospect">Prospect</option>
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                  <option value="VIP">VIP</option>
                </FormSelect>
              </FormField>
              <FormField label="Notes internes" className="md:col-span-2">
                <FormTextarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Historique, préférences, remarques..."
                  rows={3}
                />
              </FormField>
            </FormGrid>
          </FormSection>
        </div>
      </form>
    </FormModal>
  );
}
