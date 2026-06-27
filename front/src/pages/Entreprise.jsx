import { useEffect, useState, useRef } from "react";
import api from "../lib/api";
import { Building2, ImagePlus, Trash2, Save } from "lucide-react";
import {
  FormField,
  FormInput,
  FormTextarea,
  FormSelect,
  FormAlert,
} from "../components/form/FormUI";
import { AFRICAN_CURRENCIES, guessCurrencyFromCountry } from "../lib/currency";
import { formatMoneyWithCode } from "../lib/format";
import { pageTitle, pageSubtitle, card } from "../lib/uiClasses";
import TwoFactorSettings from "../components/TwoFactorSettings";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function applyOrgData(setForm, org) {
  if (!org) return false;
  setForm((f) => ({
    ...f,
    nom: org.nom || "",
    adresse: org.adresse || "",
    ville: org.ville || "",
    pays: org.pays || "Côte d'Ivoire",
    telephone: org.telephone || "",
    email: org.email || "",
    rccm: org.rccm || "",
    compteContribuable: org.compteContribuable || "",
    banque: org.banque || "",
    rib: org.rib || "",
    assuranceRc: org.assuranceRc || "",
    assuranceDecennale: org.assuranceDecennale || "",
    signataireNom: org.signataireNom || "",
    signataireFonction: org.signataireFonction || "",
    logoUrl: org.logoUrl || "",
    devise: org.devise || "XOF",
  }));
  return true;
}

export default function Entreprise({ initialOrganization = null }) {
  const [form, setForm] = useState({
    nom: "",
    adresse: "",
    ville: "",
    pays: "Côte d'Ivoire",
    telephone: "",
    email: "",
    rccm: "",
    compteContribuable: "",
    banque: "",
    rib: "",
    assuranceRc: "",
    assuranceDecennale: "",
    signataireNom: "",
    signataireFonction: "",
    logoUrl: "",
    devise: "XOF",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      if (initialOrganization && applyOrgData(setForm, initialOrganization)) {
        setLoading(false);
        return;
      }

      const sources = [
        async () => ({ org: (await api.get("/organization")).data }),
        async () => {
          const res = await api.get("/user/me");
          return { org: res.data?.organization };
        },
        async () => {
          const res = await api.get("/auth/profil");
          return { org: res.data?.organization };
        },
      ];

      for (const fetchSource of sources) {
        try {
          const { org } = await fetchSource();
          if (applyOrgData(setForm, org)) {
            setError("");
            setLoading(false);
            return;
          }
        } catch (err) {
          if (err.response?.status === 401) {
            setError("Session expirée. Reconnectez-vous.");
            setLoading(false);
            return;
          }
        }
      }

      setError("Impossible de charger les informations de l'entreprise");
      setLoading(false);
    };
    load();
  }, [initialOrganization]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleLogoPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choisissez une image (PNG, JPG, WEBP)");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Logo trop volumineux (max 2 Mo)");
      return;
    }
    setError("");
    const dataUrl = await fileToDataUrl(file);
    set("logoUrl", dataUrl);
    e.target.value = "";
  };

  const removeLogo = () => {
    set("logoUrl", "");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.put("/organization", {
        ...form,
        logoUrl: form.logoUrl || null,
      });
      window.dispatchEvent(new CustomEvent("org:updated", { detail: res.data }));
      setSuccess("Informations enregistrées — devise et logo appliqués sur toute l'application.");
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500">Chargement…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className={pageTitle}>Mon entreprise</h2>
        <p className={pageSubtitle}>
          Logo, identité légale et coordonnées bancaires — affichés sur vos devis et factures
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <FormAlert>{error}</FormAlert>}
        {success && <FormAlert type="success">{success}</FormAlert>}

        <section className={`${card} p-6 space-y-4`}>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <ImagePlus className="w-4 h-4" /> Logo de l&apos;entreprise
          </h3>
          <div className="flex flex-wrap items-start gap-6">
            <div className="w-28 h-28 border border-gray-200 dark:border-gray-600 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
              ) : (
                <div className="text-center text-gray-400 p-2">
                  <Building2 className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px]">Aucun logo</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleLogoPick}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Choisir un logo
              </button>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" /> Supprimer
                </button>
              )}
              <p className="text-xs text-gray-500 max-w-xs">
                PNG ou JPG, max 2 Mo. Visible sur le PDF et l&apos;aperçu du devis.
              </p>
            </div>
          </div>
        </section>

        <section className={`${card} p-6 space-y-4`}>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Identité</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Nom de l'entreprise" required>
              <FormInput value={form.nom} onChange={(e) => set("nom", e.target.value)} required />
            </FormField>
            <FormField label="Ville">
              <FormInput value={form.ville} onChange={(e) => set("ville", e.target.value)} />
            </FormField>
            <FormField label="Adresse" className="md:col-span-2">
              <FormTextarea value={form.adresse} onChange={(e) => set("adresse", e.target.value)} rows={2} />
            </FormField>
            <FormField label="Pays">
              <FormInput
                value={form.pays}
                onChange={(e) => {
                  const pays = e.target.value;
                  setForm((f) => ({
                    ...f,
                    pays,
                    devise: f.devise === "XOF" && !f.nom ? guessCurrencyFromCountry(pays) : f.devise,
                  }));
                }}
              />
            </FormField>
            <FormField label="Devise" hint="Appliquée à tous les montants, devis, factures et budget">
              <FormSelect value={form.devise} onChange={(e) => set("devise", e.target.value)}>
                {AFRICAN_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </FormSelect>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Aperçu dans l&apos;application :{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums whitespace-nowrap">
                  {formatMoneyWithCode(1_250_000, form.devise)}
                </span>
              </p>
            </FormField>
            <FormField label="Téléphone">
              <FormInput value={form.telephone} onChange={(e) => set("telephone", e.target.value)} />
            </FormField>
            <FormField label="Email">
              <FormInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </FormField>
            <FormField label="RCCM">
              <FormInput value={form.rccm} onChange={(e) => set("rccm", e.target.value)} placeholder="CI-ABJ-2020-B-12345" />
            </FormField>
            <FormField label="N° compte contribuable">
              <FormInput value={form.compteContribuable} onChange={(e) => set("compteContribuable", e.target.value)} />
            </FormField>
            <FormField label="Assurance RC pro" hint="Numéro de police — affiché sur les devis">
              <FormInput value={form.assuranceRc} onChange={(e) => set("assuranceRc", e.target.value)} placeholder="Police RC n° …" />
            </FormField>
            <FormField label="Assurance décennale" hint="Obligatoire pour certains lots">
              <FormInput value={form.assuranceDecennale} onChange={(e) => set("assuranceDecennale", e.target.value)} placeholder="Police décennale n° …" />
            </FormField>
          </div>
        </section>

        <section className={`${card} p-6 space-y-4`}>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Paiement & signataire</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Banque">
              <FormInput value={form.banque} onChange={(e) => set("banque", e.target.value)} />
            </FormField>
            <FormField label="RIB / N° de compte">
              <FormInput value={form.rib} onChange={(e) => set("rib", e.target.value)} />
            </FormField>
            <FormField label="Nom du signataire (devis)">
              <FormInput value={form.signataireNom} onChange={(e) => set("signataireNom", e.target.value)} />
            </FormField>
            <FormField label="Fonction du signataire">
              <FormInput value={form.signataireFonction} onChange={(e) => set("signataireFonction", e.target.value)} placeholder="Gérant" />
            </FormField>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <TwoFactorSettings />
    </div>
  );
}
