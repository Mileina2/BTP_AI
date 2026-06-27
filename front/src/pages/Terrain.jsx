import { useEffect, useState } from "react";
import api, { uploadFile } from "../lib/api";
import { getCurrentPosition } from "../lib/geoLocation";
import { watermarkImageFile, uploadWatermarkFields } from "../lib/mediaWatermark";
import LiveCameraCapture from "../components/LiveCameraCapture";
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  FormAlert,
  FormGrid,
  FormActions,
} from "../components/form/FormUI";
import {
  card,
  cardInner,
  pageTitle,
  pageSubtitle,
  textPrimary,
  textMuted,
  textSecondary,
  btnSecondary,
  filterChipActive,
  filterChipIdle,
  actionBtnGreen,
  actionBtnAmber,
} from "../lib/uiClasses";
import {
  HardHat,
  Cloud,
  HardDrive,
  Camera,
  Plus,
  Trash2,
  Package,
  Sun,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

const METEO_OPTIONS = [
  { value: "", label: "— Non précisé —" },
  { value: "Ensoleillé", label: "☀️ Ensoleillé" },
  { value: "Nuageux", label: "🌤️ Nuageux" },
  { value: "Pluie", label: "🌧️ Pluie" },
  { value: "Orage", label: "⛈️ Orage" },
  { value: "Chaleur", label: "🌡️ Chaleur intense" },
];

const URGENCE_OPTIONS = [
  { value: "BASSE", label: "Basse" },
  { value: "MOYENNE", label: "Moyenne" },
  { value: "HAUTE", label: "Haute" },
];

const DEMANDE_STATUT_LABEL = {
  EN_ATTENTE: "En attente",
  VALIDEE: "Validée",
  REFUSEE: "Refusée",
  LIVREE: "Livrée",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function auteurLabel(a) {
  if (!a) return "—";
  if (a.prenom || a.nom) return [a.prenom, a.nom].filter(Boolean).join(" ");
  return a;
}

export default function Terrain() {
  const [tab, setTab] = useState("rapport");
  const [storage, setStorage] = useState(null);
  const [chantiers, setChantiers] = useState([]);
  const [rapports, setRapports] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const [chantierId, setChantierId] = useState("");
  const [ouvriersPresents, setOuvriersPresents] = useState("");
  const [ouvriersAbsents, setOuvriersAbsents] = useState("");
  const [avancement, setAvancement] = useState("");
  const [meteo, setMeteo] = useState("");
  const [travauxRealises, setTravauxRealises] = useState("");
  const [incidents, setIncidents] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [demChantierId, setDemChantierId] = useState("");
  const [demDesignation, setDemDesignation] = useState("");
  const [demQuantite, setDemQuantite] = useState("");
  const [demUnite, setDemUnite] = useState("unité");
  const [demUrgence, setDemUrgence] = useState("MOYENNE");
  const [demCommentaire, setDemCommentaire] = useState("");
  const [demSubmitting, setDemSubmitting] = useState(false);

  const load = async () => {
    setErr("");
    try {
      const [storageRes, chRes, rapRes, demRes] = await Promise.all([
        api.get("/terrain/storage"),
        api.get("/chantier"),
        api.get("/terrain/rapports"),
        api.get("/terrain/demandes"),
      ]);
      setStorage(storageRes.data);
      const list = Array.isArray(chRes.data) ? chRes.data : chRes.data?.items || [];
      setChantiers(list);
      setRapports(Array.isArray(rapRes.data) ? rapRes.data : []);
      setDemandes(Array.isArray(demRes.data) ? demRes.data : []);
      if (list.length && !chantierId) {
        const active = list.find((c) => c.statut === "En cours" || c.statutRaw === "EN_COURS");
        const id = active?._id || active?.id || list[0]._id || list[0].id;
        setChantierId(id);
        setDemChantierId(id);
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Impossible de charger l'espace terrain");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const uploadPhoto = async (file, captureMeta = null) => {
    if (!chantierId) throw new Error("Sélectionnez un chantier");
    setUploadingPhoto(true);
    try {
      const fields = {
        chantierId,
        ...(captureMeta ? uploadWatermarkFields(captureMeta, true) : {}),
      };
      const res = await uploadFile("/terrain/rapports/photo", file, fields);
      setPhotos((prev) => [...prev, { url: res.data.url, storage: res.data.storage }]);
    } catch (e) {
      throw new Error(e.response?.data?.error || e.message || "Photo non enregistrée");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCameraCapture = async (file, captureMeta) => {
    await uploadPhoto(file, captureMeta);
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetRapportForm = () => {
    setOuvriersPresents("");
    setOuvriersAbsents("");
    setAvancement("");
    setMeteo("");
    setTravauxRealises("");
    setIncidents("");
    setNotes("");
    setPhotos([]);
  };

  const submitRapport = async (e) => {
    e.preventDefault();
    if (!chantierId) {
      setErr("Choisissez un chantier");
      return;
    }
    if (!travauxRealises.trim()) {
      setErr("Décrivez les travaux réalisés aujourd'hui");
      return;
    }
    setSubmitting(true);
    setErr("");
    setSuccess("");
    try {
      await api.post("/terrain/rapports", {
        chantierId,
        ouvriersPresents: Number(ouvriersPresents) || 0,
        ouvriersAbsents: Number(ouvriersAbsents) || 0,
        avancement: Number(avancement) || 0,
        meteo: meteo || undefined,
        travauxRealises: travauxRealises.trim(),
        incidents: incidents.trim() || undefined,
        notes: notes.trim() || undefined,
        photos: photos.map((p) => p.url),
      });
      setSuccess("Rapport journalier enregistré sur le chantier.");
      resetRapportForm();
      const rapRes = await api.get("/terrain/rapports");
      setRapports(Array.isArray(rapRes.data) ? rapRes.data : []);
      setTab("historique");
      setTimeout(() => setSuccess(""), 5000);
    } catch (e) {
      setErr(e.response?.data?.error || "Enregistrement impossible");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDemande = async (e) => {
    e.preventDefault();
    if (!demChantierId || !demDesignation.trim()) {
      setErr("Chantier et désignation requis");
      return;
    }
    setDemSubmitting(true);
    setErr("");
    try {
      await api.post("/terrain/demandes", {
        chantierId: demChantierId,
        designation: demDesignation.trim(),
        quantite: Number(demQuantite) || 1,
        unite: demUnite,
        urgence: demUrgence,
        commentaire: demCommentaire.trim() || undefined,
      });
      setSuccess("Demande de matériel envoyée.");
      setDemDesignation("");
      setDemQuantite("");
      setDemCommentaire("");
      const demRes = await api.get("/terrain/demandes");
      setDemandes(Array.isArray(demRes.data) ? demRes.data : []);
      setTimeout(() => setSuccess(""), 5000);
    } catch (e) {
      setErr(e.response?.data?.error || "Demande impossible");
    } finally {
      setDemSubmitting(false);
    }
  };

  const validateDemande = async (id, statut) => {
    try {
      await api.patch(`/terrain/demandes/${id}`, { statut });
      const demRes = await api.get("/terrain/demandes");
      setDemandes(Array.isArray(demRes.data) ? demRes.data : []);
    } catch (e) {
      setErr(e.response?.data?.error || "Mise à jour impossible");
    }
  };

  const chantierNom = (id) => chantiers.find((c) => (c._id || c.id) === id)?.nom || "—";
  const selectedChantier = chantiers.find((c) => (c._id || c.id) === chantierId);

  if (loading) {
    return <div className={`p-8 text-center ${textMuted}`}>Chargement terrain…</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={pageTitle}>Terrain</h1>
          <p className={pageSubtitle}>Rapport journalier et demandes matériel — interface simple pour le chantier</p>
        </div>
        {storage && (
          <div
            className={`${cardInner} flex items-start gap-3 text-sm max-w-sm shrink-0`}
            title={storage.hint}
          >
            {storage.mode === "cloudinary" ? (
              <Cloud className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            ) : (
              <HardDrive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-semibold ${textPrimary}`}>{storage.label}</p>
              <p className={`text-xs ${textMuted} mt-0.5 leading-relaxed`}>{storage.hint}</p>
            </div>
          </div>
        )}
      </div>

      {err && <FormAlert>{err}</FormAlert>}
      {success && (
        <div className="px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { id: "rapport", label: "Rapport du jour", icon: HardHat },
          { id: "historique", label: "Historique", icon: Clock },
          { id: "demandes", label: "Matériel", icon: Package },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition ${
              tab === id ? filterChipActive : filterChipIdle
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "rapport" && (
        <form onSubmit={submitRapport} className={`${card} p-5 md:p-6 space-y-5`}>
          <FormField label="Chantier" required>
            <FormSelect
              value={chantierId}
              onChange={(e) => setChantierId(e.target.value)}
              required
            >
              <option value="">— Sélectionner —</option>
              {chantiers.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.nom} {c.statut ? `(${c.statut})` : ""}
                </option>
              ))}
            </FormSelect>
          </FormField>

          <FormGrid>
            <FormField label="Ouvriers présents">
              <FormInput
                type="number"
                min="0"
                value={ouvriersPresents}
                onChange={(e) => setOuvriersPresents(e.target.value)}
                placeholder="Ex. 8"
              />
            </FormField>
            <FormField label="Ouvriers absents">
              <FormInput
                type="number"
                min="0"
                value={ouvriersAbsents}
                onChange={(e) => setOuvriersAbsents(e.target.value)}
                placeholder="Ex. 2"
              />
            </FormField>
          </FormGrid>

          <FormGrid>
            <FormField label="Avancement physique (%)" hint="Met à jour le % du chantier">
              <FormInput
                type="number"
                min="0"
                max="100"
                value={avancement}
                onChange={(e) => setAvancement(e.target.value)}
                placeholder={selectedChantier?.indicateurs?.avancementPhysique?.toString() || "0–100"}
              />
            </FormField>
            <FormField label="Météo">
              <FormSelect value={meteo} onChange={(e) => setMeteo(e.target.value)}>
                {METEO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </FormSelect>
            </FormField>
          </FormGrid>

          <FormField label="Travaux réalisés aujourd'hui" required>
            <FormTextarea
              rows={4}
              value={travauxRealises}
              onChange={(e) => setTravauxRealises(e.target.value)}
              placeholder="Ex. Coulage dalle RDC, finition murs façade nord…"
              required
            />
          </FormField>

          <FormField label="Incidents / blocages">
            <FormTextarea
              rows={2}
              value={incidents}
              onChange={(e) => setIncidents(e.target.value)}
              placeholder="Retard livraison, panne, accident… (optionnel)"
            />
          </FormField>

          <FormField label="Notes complémentaires">
            <FormTextarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Visite client, consignes… (optionnel)"
            />
          </FormField>

          <div className={`${cardInner} p-4 space-y-3`}>
            <div className="flex items-center justify-between gap-2">
              <p className={`font-medium text-sm ${textPrimary}`}>Photos du jour</p>
              <span className={`text-xs ${textMuted}`}>
                {storage?.mode === "cloudinary" ? "Cloud" : "Local"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                disabled={!chantierId || uploadingPhoto}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                <Camera className="w-5 h-5" />
                {uploadingPhoto ? "Envoi…" : "Prendre une photo"}
              </button>
              <label className={`${btnSecondary} cursor-pointer ${!chantierId || uploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                <Camera className="w-4 h-4" />
                Appareil (mobile)
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const geo = await getCurrentPosition();
                      const meta = { chantierNom: selectedChantier?.nom, ...geo, capturedAt: new Date() };
                      const stamped = await watermarkImageFile(file, meta);
                      await uploadPhoto(stamped, meta);
                    } catch (err) {
                      setErr(err.message || "Photo non enregistrée");
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {photos.map((p, i) => (
                  <div key={p.url} className="relative group">
                    <img
                      src={p.url}
                      alt={`Photo ${i + 1}`}
                      className="w-20 h-20 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-red-600 text-white shadow"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {p.storage === "cloudinary" && (
                      <span className="absolute bottom-1 left-1 text-[9px] bg-sky-600 text-white px-1 rounded">cloud</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <FormActions
            submitLabel="Enregistrer le rapport"
            loading={submitting}
            loadingLabel="Enregistrement…"
            disabled={uploadingPhoto}
          />
        </form>
      )}

      {tab === "historique" && (
        <div className="space-y-3">
          {rapports.length === 0 ? (
            <div className={`${card} p-8 text-center ${textMuted} text-sm`}>
              Aucun rapport. Utilisez « Rapport du jour » pour la première remontée terrain.
            </div>
          ) : (
            rapports.map((r) => {
              const id = r._id || r.id;
              const ch = r.chantier?.nom || chantierNom(r.chantierId);
              return (
                <article key={id} className={`${card} p-4 md:p-5 space-y-3`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className={`font-semibold ${textPrimary}`}>{ch}</p>
                      <p className={`text-xs ${textMuted} flex items-center gap-2 mt-1`}>
                        <Clock className="w-3 h-3" />
                        {formatDate(r.date)}
                        · {auteurLabel(r.auteur)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {r.meteo && (
                        <span className="px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                          {r.meteo}
                        </span>
                      )}
                      {r.avancement > 0 && (
                        <span className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                          {r.avancement}% avancement
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 ${textSecondary}`}>
                        {r.ouvriersPresents ?? 0} présents · {r.ouvriersAbsents ?? 0} absents
                      </span>
                    </div>
                  </div>
                  {r.travauxRealises && (
                    <p className={`text-sm ${textSecondary}`}>
                      <strong className={textPrimary}>Travaux :</strong> {r.travauxRealises}
                    </p>
                  )}
                  {r.incidents && (
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      {r.incidents}
                    </p>
                  )}
                  {r.notes && <p className={`text-sm ${textMuted}`}>{r.notes}</p>}
                  {r.photos?.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {r.photos.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-600" />
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {tab === "demandes" && (
        <div className="space-y-6">
          <form onSubmit={submitDemande} className={`${card} p-5 space-y-4`}>
            <h2 className={`text-sm font-semibold ${textPrimary} flex items-center gap-2`}>
              <Plus className="w-4 h-4" /> Nouvelle demande matériel
            </h2>
            <FormField label="Chantier" required>
              <FormSelect value={demChantierId} onChange={(e) => setDemChantierId(e.target.value)} required>
                {chantiers.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>{c.nom}</option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Matériel / désignation" required>
              <FormInput
                value={demDesignation}
                onChange={(e) => setDemDesignation(e.target.value)}
                placeholder="Ex. Ciment CPJ 42.5 — 50 sacs"
                required
              />
            </FormField>
            <FormGrid cols={3}>
              <FormField label="Quantité">
                <FormInput type="number" min="0.01" value={demQuantite} onChange={(e) => setDemQuantite(e.target.value)} />
              </FormField>
              <FormField label="Unité">
                <FormInput value={demUnite} onChange={(e) => setDemUnite(e.target.value)} />
              </FormField>
              <FormField label="Urgence">
                <FormSelect value={demUrgence} onChange={(e) => setDemUrgence(e.target.value)}>
                  {URGENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </FormSelect>
              </FormField>
            </FormGrid>
            <FormField label="Commentaire">
              <FormInput value={demCommentaire} onChange={(e) => setDemCommentaire(e.target.value)} placeholder="Optionnel" />
            </FormField>
            <FormActions submitLabel="Envoyer la demande" loading={demSubmitting} />
          </form>

          <div className="space-y-2">
            <h3 className={`text-sm font-semibold ${textPrimary}`}>Demandes récentes</h3>
            {demandes.length === 0 ? (
              <p className={`text-sm ${textMuted}`}>Aucune demande.</p>
            ) : (
              demandes.map((d) => {
                const id = d._id || d.id;
                const statut = d.statut || "EN_ATTENTE";
                return (
                  <div key={id} className={`${cardInner} p-4 flex flex-wrap items-center justify-between gap-3`}>
                    <div className="min-w-0">
                      <p className={`font-medium text-sm ${textPrimary}`}>{d.designation}</p>
                      <p className={`text-xs ${textMuted}`}>
                        {d.chantier?.nom || chantierNom(d.chantierId)} · {d.quantite} {d.unite} · {DEMANDE_STATUT_LABEL[statut] || statut}
                      </p>
                    </div>
                    {statut === "EN_ATTENTE" && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => validateDemande(id, "VALIDEE")} className={actionBtnGreen}>
                          Valider
                        </button>
                        <button type="button" onClick={() => validateDemande(id, "REFUSEE")} className={actionBtnAmber}>
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <LiveCameraCapture
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
        title={selectedChantier?.nom || "Rapport terrain"}
        watermarkMeta={{ chantierNom: selectedChantier?.nom }}
      />
    </div>
  );
}
