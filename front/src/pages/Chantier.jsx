import { useEffect, useState, useMemo } from "react";
import api, { downloadFile, uploadFile } from "../lib/api";
import { getCurrentPosition } from "../lib/geoLocation";
import { watermarkImageFile, uploadWatermarkFields } from "../lib/mediaWatermark";
import ChantierForm from "../components/ChantierForm";
import ChefAccessBlock from "../components/ChefAccessBlock";
import LiveCameraCapture from "../components/LiveCameraCapture";
import LiveVideoCapture from "../components/LiveVideoCapture";
import {
  pageTitle,
  pageSubtitle,
  card,
  cardInner,
  cardFooter,
  textPrimary,
  textMuted,
  textFaint,
  kpiValue,
  kpiLabel,
  searchInput,
  linkAccent,
  btnGhost,
  amountDefault,
  filterChipActive,
  filterChipIdle,
  btnSecondary,
  actionBtnRed,
} from "../lib/uiClasses";
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Calendar,
  Wallet,
  Users,
  FileText,
  Receipt,
  AlertTriangle,
  X,
  ChevronRight,
  HardHat,
  MessageSquare,
  FolderOpen,
  Upload,
  Trash2,
  ExternalLink,
  Camera,
  Video,
} from "lucide-react";

const STATUTS = ["Tous", "En préparation", "En cours", "Terminé", "Suspendu"];
const STATUT_FILTERS = ["En préparation", "En cours", "Terminé", "Suspendu"];

const statutBadge = {
  "En préparation": "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  "En cours": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  "Terminé": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  "Suspendu": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

import { formatMoneyShort } from "../lib/format";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function ProgressBar({ value, color = "bg-blue-500" }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function ChantierDetail({ id, initialTab = "resume", openCameraOnMount = false, openVideoOnMount = false, onClose, onUpdated, canOperateField = true, canManageAccess = false }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);
  const [avancement, setAvancement] = useState(0);
  const [timeline, setTimeline] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [visibleClient, setVisibleClient] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [tabErr, setTabErr] = useState("");

  const loadDetail = async () => {
    const res = await api.get(`/chantier/${id}/detail`);
    setDetail(res.data);
    setAvancement(res.data.indicateurs?.avancementPhysique ?? 0);
  };

  const loadTimeline = async () => {
    const res = await api.get(`/chantier/${id}/timeline`);
    setTimeline(res.data.items || []);
  };

  const loadDocuments = async () => {
    const res = await api.get(`/chantier/${id}/documents`);
    setDocuments(res.data.items || []);
  };

  useEffect(() => {
    setTab(initialTab);
  }, [id, initialTab]);

  useEffect(() => {
    if (openCameraOnMount) setShowCamera(true);
    if (openVideoOnMount) setShowVideo(true);
  }, [id, openCameraOnMount, openVideoOnMount]);

  useEffect(() => {
    setLoading(true);
    setTabErr("");
    loadDetail()
      .catch(() => setTabErr("Impossible de charger le chantier"))
      .finally(() => setLoading(false));
    loadTimeline().catch(() => setTabErr("Journal indisponible — vérifiez que le backend est à jour"));
    loadDocuments().catch(() => setTabErr("Documents indisponibles — vérifiez que le backend est à jour"));
  }, [id]);

  const saveAvancement = async () => {
    await api.put(`/chantier/${id}/indicateurs`, {
      avancementPhysique: Number(avancement),
      avancementFinancier: detail.finances?.ratioBudget ?? 0,
    });
    onUpdated();
    await loadDetail();
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentLoading(true);
    setTabErr("");
    try {
      await api.post(`/chantier/${id}/commentaire`, {
        texte: commentText.trim(),
        visibleClient,
      });
      setCommentText("");
      await loadTimeline();
      await loadDetail();
    } catch (err) {
      setTabErr(err.response?.data?.error || "Impossible d'ajouter le commentaire");
    } finally {
      setCommentLoading(false);
    }
  };

  const removeComment = async (entryId) => {
    if (!window.confirm("Supprimer cette note ?")) return;
    try {
      await api.delete(`/chantier/${id}/timeline/${entryId}`);
      await loadTimeline();
      await loadDetail();
    } catch (err) {
      setTabErr(err.response?.data?.error || "Suppression impossible");
    }
  };

  const uploadDocument = async (file, captureMeta = null) => {
    setUploadLoading(true);
    setTabErr("");
    setUploadSuccess("");
    try {
      const fields = {
        nom: file.name,
        ...(captureMeta ? uploadWatermarkFields(captureMeta, true) : {}),
      };
      await uploadFile(`/chantier/${id}/document`, file, fields);
      await loadDocuments();
      await loadDetail();
      const kind = file.type?.startsWith("video/") ? "Vidéo" : file.type?.startsWith("image/") ? "Photo" : "Fichier";
      setUploadSuccess(`${kind} enregistrée sur le chantier.`);
      setTimeout(() => setUploadSuccess(""), 5000);
      return true;
    } catch (err) {
      setTabErr(err.response?.data?.error || err.message || "Enregistrement impossible");
      return false;
    } finally {
      setUploadLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadDocument(file);
    e.target.value = "";
  };

  const handleCameraCapture = async (file, captureMeta) => {
    const ok = await uploadDocument(file, captureMeta);
    if (!ok) throw new Error("Photo non enregistrée");
  };

  const handleVideoCapture = async (file, captureMeta) => {
    const ok = await uploadDocument(file, captureMeta);
    if (!ok) throw new Error("Vidéo non enregistrée");
  };

  const handleNativeVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadDocument(file);
    e.target.value = "";
  };

  const handleNativeCamera = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setTabErr("");
    try {
      const geo = await getCurrentPosition();
      const meta = { chantierNom: detail.nom, ...geo, capturedAt: new Date() };
      const stamped = await watermarkImageFile(file, meta);
      await uploadDocument(stamped, meta);
    } catch (err) {
      setTabErr(err.message || "Photo non enregistrée");
    } finally {
      setUploadLoading(false);
      e.target.value = "";
    }
  };

  const removeDocument = async (docId) => {
    if (!window.confirm("Supprimer ce document ?")) return;
    try {
      await api.delete(`/chantier/${id}/document/${docId}`);
      await loadDocuments();
      await loadDetail();
    } catch (err) {
      setTabErr(err.response?.data?.error || "Suppression impossible");
    }
  };

  if (loading) return <div className={`p-8 text-center ${textMuted}`}>Chargement...</div>;
  if (!detail) return null;

  const f = detail.finances || {};
  const tabs = [
    { id: "resume", label: "Résumé" },
    { id: "journal", label: `Journal (${timeline.length})` },
    { id: "documents", label: `Documents (${documents.length})` },
  ];

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-5 z-10">
          <div className="flex justify-between items-start gap-3">
            <div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statutBadge[detail.statut] || ""}`}>
                {detail.statut}
              </span>
              <h3 className={`text-xl font-bold mt-2 ${textPrimary}`}>{detail.nom}</h3>
              <p className={`text-sm ${textMuted} flex items-center gap-1 mt-1`}>
                <MapPin className="w-3.5 h-3.5" />
                {detail.ville || detail.adresse || "—"} · {detail.client}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-1 mt-4 border-b border-gray-200 dark:border-gray-700 -mb-px">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setTabErr(""); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  tab === t.id
                    ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-6">
          {tabErr && (
            <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {tabErr}
            </div>
          )}
          {uploadSuccess && (
            <div className="px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 text-sm font-medium">
              {uploadSuccess}
            </div>
          )}
          {uploadLoading && (
            <div className="px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-sm">
              Enregistrement en cours… ne fermez pas cette page.
            </div>
          )}

          {tab === "resume" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Budget", value: formatMoneyShort(f.budget) },
                  { label: "Dépenses", value: formatMoneyShort(f.depenses) },
                  { label: "Restant", value: formatMoneyShort(f.restant), warn: f.restant < 0 },
                  { label: "Impayés", value: formatMoneyShort(f.facturesImpayees), warn: f.facturesImpayees > 0 },
                ].map((k) => (
                  <div key={k.label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
                    <p className={`font-bold ${k.warn ? "text-red-600 dark:text-red-400" : textPrimary}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {canManageAccess && (
                <ChefAccessBlock
                  chantierId={id}
                  chefChantier={detail.chefChantier}
                  onUpdated={async () => {
                    const res = await api.get(`/chantier/${id}/detail`);
                    setDetail(res.data);
                    onUpdated?.();
                  }}
                />
              )}

              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium text-sm">Avancement physique</p>
                  {detail.scoreSante && (
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      Santé chantier : {detail.scoreSante.score}/100
                    </span>
                  )}
                </div>
                <div className="flex gap-3 items-center">
                  {canOperateField ? (
                    <>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={avancement}
                        onChange={(e) => setAvancement(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm font-bold w-10">{avancement}%</span>
                      <button
                        type="button"
                        onClick={saveAvancement}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg"
                      >
                        Enregistrer
                      </button>
                    </>
                  ) : (
                    <>
                      <ProgressBar value={avancement} />
                      <span className="text-sm font-bold w-10">{avancement}%</span>
                    </>
                  )}
                </div>
                <ProgressBar value={f.ratioBudget} color={f.ratioBudget > 100 ? "bg-red-500" : f.ratioBudget > 80 ? "bg-amber-500" : "bg-green-500"} />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Budget consommé : {f.ratioBudget}%</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
                <div className="p-3 border dark:border-gray-700 rounded-lg">
                  <FileText className="w-5 h-5 mx-auto text-purple-500 mb-1" />
                  <p className="font-bold">{detail.counts?.devis ?? 0}</p>
                  <p className="text-gray-500 text-xs">Devis</p>
                </div>
                <div className="p-3 border dark:border-gray-700 rounded-lg">
                  <Receipt className="w-5 h-5 mx-auto text-green-500 mb-1" />
                  <p className="font-bold">{detail.counts?.factures ?? 0}</p>
                  <p className="text-gray-500 text-xs">Factures</p>
                </div>
                <div className="p-3 border dark:border-gray-700 rounded-lg">
                  <Users className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                  <p className="font-bold">{detail.counts?.equipe ?? 0}</p>
                  <p className="text-gray-500 text-xs">Équipe</p>
                </div>
                <div className="p-3 border dark:border-gray-700 rounded-lg">
                  <FolderOpen className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                  <p className="font-bold">{detail.counts?.documents ?? 0}</p>
                  <p className="text-gray-500 text-xs">Documents</p>
                </div>
              </div>

              {detail.depensesRecentes?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Dernières dépenses</h4>
                  <div className="space-y-1">
                    {detail.depensesRecentes.map((d) => (
                      <div key={d.id} className="flex justify-between text-sm py-1.5 border-b dark:border-gray-700 last:border-0">
                        <span>{d.libelle} <span className="text-gray-400">({d.categorie})</span></span>
                        <span className="font-medium">{formatMoneyShort(d.montant)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.rapports?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                    <HardHat className="w-4 h-4" /> Rapports terrain
                  </h4>
                  {detail.rapports.map((r) => (
                    <div key={r.id} className="text-sm py-2 border-b dark:border-gray-700">
                      <p>{r.travaux || `Avancement ${r.avancement}%`}</p>
                      <p className="text-xs text-gray-400">{formatDate(r.date)} · {r.auteur} · {r.presents} présents</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setTab("journal")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Ouvrir le journal
                </button>
                <button
                  type="button"
                  onClick={() => setTab("documents")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Photos & docs
                </button>
                <a href="#/budget" className="text-blue-600 dark:text-blue-400 hover:underline py-1.5">Budget →</a>
                <a href="#/devis" className="text-blue-600 dark:text-blue-400 hover:underline py-1.5">Devis →</a>
                <a href="#/factures" className="text-blue-600 dark:text-blue-400 hover:underline py-1.5">Factures →</a>
              </div>
            </>
          )}

          {tab === "journal" && (
            <div className="space-y-4">
              {canOperateField && (
              <form onSubmit={submitComment} className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-500" /> Nouvelle note
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  placeholder="Compte-rendu, décision, alerte terrain…"
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleClient}
                    onChange={(e) => setVisibleClient(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Visible par le client
                </label>
                <button
                  type="submit"
                  disabled={commentLoading || !commentText.trim()}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {commentLoading ? "Envoi…" : "Publier"}
                </button>
              </form>
              )}

              {timeline.length === 0 ? (
                <p className={`text-sm text-center py-8 ${textMuted}`}>Aucune note pour ce chantier.</p>
              ) : (
                <ul className="space-y-3">
                  {timeline.map((entry) => (
                    <li key={entry.id || entry._id} className={`${cardInner} p-4`}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-medium text-sm">{entry.titre}</p>
                          <p className={`text-xs ${textMuted} mt-0.5`}>
                            {entry.auteur} · {formatDate(entry.date)}
                          </p>
                        </div>
                        {canOperateField && (
                        <button
                          type="button"
                          onClick={() => removeComment(entry.id || entry._id)}
                          className={actionBtnRed}
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-sm mt-2 whitespace-pre-wrap">{entry.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "documents" && (
            <div className="space-y-4">
              <div className={`${cardInner} p-4 space-y-4`}>
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600" /> Photo prise sur le chantier
                  </p>
                  <p className={`text-xs ${textMuted} mt-1`}>
                    Caméra en direct — filigrane date, chantier et GPS gravés sur la photo.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    disabled={uploadLoading}
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-50"
                  >
                    <Camera className="w-5 h-5" />
                    {uploadLoading ? "Envoi…" : "Ouvrir la caméra"}
                  </button>
                  <label className={`${btnSecondary} cursor-pointer ${uploadLoading ? "opacity-50 pointer-events-none" : ""}`}>
                    <Camera className="w-4 h-4" />
                    Appareil photo (mobile)
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      capture="environment"
                      onChange={handleNativeCamera}
                    />
                  </label>
                </div>
              </div>

              <div className={`${cardInner} p-4 space-y-4`}>
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    <Video className="w-4 h-4 text-red-600" /> Vidéo filmée sur le chantier
                  </p>
                  <p className={`text-xs ${textMuted} mt-1`}>
                    Enregistrement live caméra + micro — filigrane sur toute la vidéo (max 2 min).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVideo(true)}
                    disabled={uploadLoading}
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-sm disabled:opacity-50"
                  >
                    <Video className="w-5 h-5" />
                    {uploadLoading ? "Envoi…" : "Filmer en direct"}
                  </button>
                  <label className={`${btnSecondary} cursor-pointer ${uploadLoading ? "opacity-50 pointer-events-none" : ""}`}>
                    <Video className="w-4 h-4" />
                    Caméra vidéo (mobile)
                    <input
                      type="file"
                      className="hidden"
                      accept="video/*"
                      capture="environment"
                      onChange={handleNativeVideo}
                    />
                  </label>
                </div>
              </div>

              <div className={`${cardInner} p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between`}>
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-500" /> Autres documents
                  </p>
                  <p className={`text-xs ${textMuted} mt-1`}>PDF, Word, Excel uniquement — max 15 Mo</p>
                </div>
                <label className={`${btnSecondary} cursor-pointer ${uploadLoading ? "opacity-50 pointer-events-none" : ""}`}>
                  <FolderOpen className="w-4 h-4" />
                  Importer un PDF
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf"
                  />
                </label>
              </div>

              {documents.length === 0 ? (
                <p className={`text-sm text-center py-8 ${textMuted}`}>
                  Aucun média. Utilisez la caméra ou « Filmer en direct » pour capturer sur le chantier.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                  {documents.map((doc) => {
                    const isImage = doc.mimeType?.startsWith("image/");
                    const isVideo = doc.mimeType?.startsWith("video/");
                    return (
                    <li key={doc.id || doc._id} className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-gray-800/50">
                      {isImage && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <img src={doc.url} alt={doc.nom} className="w-14 h-14 rounded-lg object-cover border border-gray-200 dark:border-gray-600" />
                        </a>
                      )}
                      {isVideo && (
                        <video
                          src={doc.url}
                          controls
                          playsInline
                          className="w-24 h-14 rounded-lg object-cover border border-gray-200 dark:border-gray-600 shrink-0 bg-black"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{doc.nom}</p>
                        <p className={`text-xs ${textMuted}`}>
                          {formatFileSize(doc.taille)} · {doc.uploadedBy} · {formatDate(doc.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={btnSecondary}
                          title="Ouvrir"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => removeDocument(doc.id || doc._id)}
                          className={actionBtnRed}
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    <LiveCameraCapture
      open={showCamera}
      onClose={() => setShowCamera(false)}
      onCapture={handleCameraCapture}
      title={detail.nom}
      watermarkMeta={{ chantierNom: detail.nom }}
    />
    <LiveVideoCapture
      open={showVideo}
      onClose={() => setShowVideo(false)}
      onCapture={handleVideoCapture}
      title={detail.nom}
      watermarkMeta={{ chantierNom: detail.nom }}
    />
    </>
  );
}

export default function Chantier({ userRole = "ENTREPRENEUR" }) {
  const isManagement = userRole === "ENTREPRENEUR" || userRole === "ADMIN";
  const canOperateField = isManagement || userRole === "CHEF_CHANTIER";
  const [stats, setStats] = useState(null);
  const [chantiers, setChantiers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("Tous");
  const [selectedView, setSelectedView] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [overview, clientsRes] = await Promise.all([
        api.get("/chantier/overview"),
        isManagement ? api.get("/client") : Promise.resolve({ data: [] }),
      ]);
      setStats(overview.data.stats);
      setChantiers(overview.data.items || []);
      setClients(clientsRes.data);
      setError("");
    } catch {
      setError("Erreur de chargement des chantiers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = chantiers;
    if (filterStatut !== "Tous") list = list.filter((c) => c.statut === filterStatut);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.nom?.toLowerCase().includes(q) ||
          c.client?.toLowerCase().includes(q) ||
          c.ville?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [chantiers, filterStatut, search]);

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce chantier et toutes ses données liées ?")) return;
    await api.delete(`/chantier/${id}`);
    if (selectedView?.id === id) setSelectedView(null);
    load();
  };

  const handleStatutChange = async (id, newStatut) => {
    await api.put(`/chantier/${id}`, { statut: newStatut });
    load();
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Chantiers</h2>
          <p className={pageSubtitle}>Pilotage opérationnel de vos projets</p>
        </div>
        <div className="flex gap-2">
          {isManagement && (
            <>
              <button
                type="button"
                onClick={() => downloadFile("/chantier/export/excel", "chantiers.xlsx")}
                className={btnSecondary}
              >
                Export Excel
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                <Plus className="w-4 h-4" />
                Nouveau chantier
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Building2 },
            { label: "En cours", value: stats.enCours, icon: HardHat },
            { label: "En préparation", value: stats.enPreparation },
            { label: "Budget total", value: formatMoneyShort(stats.budgetTotal) },
            { label: "Dépenses", value: formatMoneyShort(stats.depensesTotal) },
            {
              label: "Alertes budget",
              value: stats.alertesBudget,
              warn: stats.alertesBudget > 0,
            },
          ].map((k) => (
            <div key={k.label} className={`${card} p-4`}>
              <p className={kpiLabel}>{k.label}</p>
              <p className={`${kpiValue} ${k.warn ? "text-red-600 dark:text-red-400" : ""}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className={`${card} px-4 py-3 flex flex-wrap items-center gap-3 text-sm border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/30`}>
        <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="text-gray-700 dark:text-gray-200 flex-1">
          <strong>Photos & vidéos live</strong> — boutons « Caméra » ou « Vidéo » : prise directe sur le chantier, pas la galerie.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        {STATUTS.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatut(s)}
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              filterStatut === s ? filterChipActive : filterChipIdle
            }`}
          >
            {s}
          </button>
        ))}
        <div className="w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm sm:ml-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher chantier, client, ville..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={searchInput}
            />
          </div>
        </div>
      </div>

      {/* Formulaire création (modal) */}
      {isManagement && (
        <ChantierForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSaved={load}
          clients={clients}
        />
      )}

      {/* Liste */}
      {loading ? (
        <p className={textMuted}>Chargement...</p>
      ) : error ? (
        <p className="text-red-600 dark:text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 ${card}`}>
          <Building2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className={textMuted}>Aucun chantier trouvé.</p>
          <button onClick={() => setShowForm(true)} className={`mt-3 text-sm ${linkAccent}`}>
            Créer votre premier chantier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const id = c._id || c.id;
            const avancement = c.indicateurs?.avancementPhysique ?? 0;
            const ratio = c.ratioBudget ?? 0;
            return (
              <div key={id} className={`${card} hover:shadow-md transition overflow-hidden`}>
                <div className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statutBadge[c.statut] || ""}`}>
                        {c.statut}
                      </span>
                      <h3 className={`font-semibold mt-2 truncate ${textPrimary}`}>{c.nom}</h3>
                      <p className={`text-sm ${textMuted}`}>{c.client}</p>
                      {c.ville && (
                        <p className={`text-xs ${textFaint} flex items-center gap-1 mt-0.5`}>
                          <MapPin className="w-3 h-3" /> {c.ville}
                        </p>
                      )}
                    </div>
                    {ratio >= 80 && (
                      <AlertTriangle className={`w-5 h-5 shrink-0 ${ratio > 100 ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400"}`} />
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className={`flex justify-between text-xs ${textMuted}`}>
                      <span>Avancement</span>
                      <span className={`font-medium ${textPrimary}`}>{avancement}%</span>
                    </div>
                    <ProgressBar value={avancement} />
                    <div className={`flex justify-between text-xs ${textMuted}`}>
                      <span>Budget {formatMoneyShort(c.depenses)} / {formatMoneyShort(c.budget)}</span>
                      <span className={ratio > 100 ? "text-red-600 dark:text-red-400 font-bold" : textPrimary}>{ratio}%</span>
                    </div>
                    <ProgressBar
                      value={ratio}
                      color={ratio > 100 ? "bg-red-500" : ratio > 80 ? "bg-amber-500" : "bg-green-500"}
                    />
                  </div>

                  {c.counts && (
                    <div className={`flex gap-3 mt-3 text-xs ${textMuted}`}>
                      {c.counts.devis > 0 && <span>{c.counts.devis} devis</span>}
                      {c.counts.factures > 0 && <span>{c.counts.factures} factures</span>}
                      {c.counts.equipe > 0 && <span>{c.counts.equipe} ouvriers</span>}
                    </div>
                  )}
                </div>

                <div className={cardFooter}>
                  {isManagement ? (
                    <select
                      value={c.statut}
                      onChange={(e) => handleStatutChange(id, e.target.value)}
                      className={`text-xs border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 ${textPrimary}`}
                    >
                      {STATUT_FILTERS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`text-xs ${textMuted}`}>{c.statut}</span>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedView({ id, tab: "journal" })}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Journal
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedView({ id, tab: "documents", openVideo: true })}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50"
                    >
                      <Video className="w-3.5 h-3.5" /> Vidéo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedView({ id, tab: "documents", openCamera: true })}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                    >
                      <Camera className="w-3.5 h-3.5" /> Caméra
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedView({ id, tab: "resume" })}
                      className={`text-xs ${linkAccent} flex items-center gap-0.5`}
                    >
                      Détails <ChevronRight className="w-3 h-3" />
                    </button>
                    {isManagement && (
                    <button onClick={() => handleDelete(id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                      Supprimer
                    </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedView && (
        <ChantierDetail
          id={selectedView.id}
          initialTab={selectedView.tab}
          openCameraOnMount={!!selectedView.openCamera}
          openVideoOnMount={!!selectedView.openVideo}
          onClose={() => setSelectedView(null)}
          onUpdated={load}
          canOperateField={canOperateField}
          canManageAccess={isManagement}
        />
      )}
    </div>
  );
}
