import { useEffect, useState, useMemo } from "react";
import api, { downloadFile } from "../lib/api";
import DevisForm from "../components/DevisForm";
import { formatFCFAShort } from "../lib/format";
import {
  pageTitle,
  pageSubtitle,
  card,
  cardInner,
  cardFooter,
  textPrimary,
  textSecondary,
  textMuted,
  textFaint,
  kpiValue,
  kpiLabel,
  searchInput,
  linkAccent,
  amountDefault,
  filterChipActive,
  filterChipIdle,
  actionBtnGreen,
} from "../lib/uiClasses";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  FileDown,
  Send,
  Mail,
  X,
  ChevronRight,
  User,
  Building2,
  Clock,
  AlertTriangle,
  Edit,
  TrendingUp,
  CheckCircle,
  Receipt,
  Copy,
  GitBranch,
} from "lucide-react";

const STATUTS = ["Tous", "En attente", "Envoyé", "Accepté", "Refusé"];

const statutBadge = {
  "En attente": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  "Envoyé": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  "Accepté": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  "Refusé": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function pickFactureType() {
  const choice = window.prompt(
    "Type de facture :\n\n1 = Intégrale (toutes les lignes)\n2 = Acompte (% du devis)\n3 = Solde (après acompte)\n\nSaisissez 1, 2 ou 3 :",
    "1"
  );
  if (choice === null) return null;
  const map = { "1": "integrale", "2": "acompte", "3": "solde" };
  return map[choice.trim()] || "integrale";
}

const FACTURE_TYPE_LABELS = {
  integrale: "facture intégrale",
  acompte: "facture d'acompte",
  solde: "facture de solde",
};

function DevisDetail({ id, onClose, onUpdated, onEdit, onFacturer, onOpenDevis }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const [factureLoading, setFactureLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [dupLoading, setDupLoading] = useState(false);
  const [versionLoading, setVersionLoading] = useState(false);
  const [sendMsg, setSendMsg] = useState("");
  const [sendErr, setSendErr] = useState("");

  const load = () =>
    api.get(`/devis/${id}/detail`).then((res) => setDetail(res.data));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  const handleStatutChange = async (newStatut) => {
    await api.put(`/devis/${id}`, { statut: newStatut });
    onUpdated();
    await load();
  };

  const handleFacturer = async () => {
    const type = pickFactureType();
    if (!type) return;
    if (!confirm(`Créer une ${FACTURE_TYPE_LABELS[type]} à partir de ce devis ?`)) return;
    setFactureLoading(true);
    try {
      const res = await api.post(`/devis/${id}/facture`, { type });
      onUpdated();
      if (onFacturer) {
        onFacturer(res.data.message || "Facture créée.");
      } else {
        alert(res.data.message || "Facture créée.");
        window.location.hash = "/factures";
      }
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || "Impossible de facturer ce devis";
      if (err.response?.data?.factureId) {
        if (confirm(`${msg}. Aller aux factures ?`)) window.location.hash = "/factures";
      } else {
        alert(msg);
      }
    } finally {
      setFactureLoading(false);
    }
  };

  const handlePDF = () => downloadFile(`/devis/${id}/pdf`, `devis_${detail?.numero || id}.pdf`);

  const handleEmail = async () => {
    setEmailLoading(true);
    setSendMsg("");
    setSendErr("");
    try {
      const res = await api.post(`/devis/${id}/email`, {
        email: detail.client?.email || undefined,
      });
      setSendMsg(res.data.message || "Devis envoyé par email.");
      onUpdated();
      await load();
    } catch (err) {
      setSendErr(err.response?.data?.error || "Envoi email impossible");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleWhatsApp = async () => {
    setSendErr("");
    try {
      const res = await api.get(`/devis/${id}/whatsapp`);
      const url = res.data.url || res.data.whatsappUrl;
      if (!url) throw new Error("Lien WhatsApp indisponible");
      window.open(url, "_blank");
      setSendMsg(res.data.message || "WhatsApp ouvert — envoyez le message au client.");
    } catch (err) {
      setSendErr(err.response?.data?.error || err.message || "WhatsApp impossible");
    }
  };

  const handleDuplicate = async () => {
    if (!confirm("Dupliquer ce devis en brouillon (nouveau numéro) ?")) return;
    setDupLoading(true);
    setSendErr("");
    try {
      const res = await api.post(`/devis/${id}/duplicate`);
      setSendMsg(res.data.message || "Devis dupliqué.");
      onUpdated();
      const newId = res.data.devis?.id || res.data.devis?._id;
      if (newId && onOpenDevis) {
        onClose();
        onOpenDevis(newId);
      }
    } catch (err) {
      setSendErr(err.response?.data?.error || "Duplication impossible");
    } finally {
      setDupLoading(false);
    }
  };

  const handleVersion = async () => {
    if (!confirm("Créer une nouvelle version de ce devis (même client, lignes copiées) ?")) return;
    setVersionLoading(true);
    setSendErr("");
    try {
      const res = await api.post(`/devis/${id}/version`);
      setSendMsg(res.data.message || "Nouvelle version créée.");
      onUpdated();
      const newId = res.data.devis?.id || res.data.devis?._id;
      if (newId && onOpenDevis) {
        onClose();
        onOpenDevis(newId);
      }
    } catch (err) {
      setSendErr(err.response?.data?.error || "Création de version impossible");
    } finally {
      setVersionLoading(false);
    }
  };

  if (loading) return <div className={`p-8 text-center ${textMuted}`}>Chargement...</div>;
  if (!detail) return null;

  const v = detail.validite || {};
  const f = detail.finances || {};
  const displayNumero = detail.numeroAffiche || detail.numero;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 p-5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statutBadge[detail.statut] || ""}`}>
                {detail.statut}
              </span>
              <span className={`text-xs font-mono ${textMuted}`}>{displayNumero}</span>
              {detail.version > 1 && (
                <span className="text-xs text-blue-600 dark:text-blue-400">v{detail.version}</span>
              )}
              {v.expire && (
                <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Expiré
                </span>
              )}
            </div>
            <h3 className={`text-xl font-bold mt-2 ${textPrimary}`}>Devis {displayNumero}</h3>
            <p className={`text-sm ${textMuted} mt-1 flex items-center gap-2 flex-wrap`}>
              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {detail.client?.nom}</span>
              {detail.chantier?.nom && (
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {detail.chantier.nom}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-gray-500 dark:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Montant HT", value: formatFCFAShort(f.montantHT) },
              { label: "TVA", value: formatFCFAShort(f.montantTVA) },
              { label: "Total TTC", value: formatFCFAShort(f.montantTTC), highlight: true },
              {
                label: "Validité",
                value: v.joursRestants != null ? `${v.joursRestants} j restants` : "—",
                warn: v.expire,
              },
            ].map((k) => (
              <div key={k.label} className={cardInner}>
                <p className={kpiLabel}>{k.label}</p>
                <p className={`font-bold ${k.warn ? "text-red-600 dark:text-red-400" : k.highlight ? "text-blue-600 dark:text-blue-400" : textPrimary}`}>
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          {detail.description && (
            <div className={cardInner}>
              <p className={`text-xs ${textMuted} mb-1`}>Description</p>
              <p className={`text-sm ${textSecondary}`}>{detail.description}</p>
            </div>
          )}

          {/* Lignes */}
          <div>
            <h4 className={`font-medium text-sm mb-2 ${textSecondary}`}>Lignes de prestation</h4>
            <div className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="p-2 text-left">Désignation</th>
                    <th className="p-2 text-right w-16">Qté</th>
                    <th className="p-2 text-center w-14">Unité</th>
                    <th className="p-2 text-right w-24">P.U.</th>
                    <th className="p-2 text-right w-24">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lignes?.map((l) => (
                    <tr key={l.id} className="border-t border-gray-200 dark:border-gray-600">
                      <td className={`p-2 ${textSecondary}`}>{l.designation}</td>
                      <td className={`p-2 text-right ${textMuted}`}>{l.quantite}</td>
                      <td className={`p-2 text-center ${textMuted}`}>{l.unite || "u"}</td>
                      <td className={`p-2 text-right ${textMuted}`}>{formatFCFAShort(l.prixUnitaire)}</td>
                      <td className={`p-2 text-right font-medium ${textPrimary}`}>{formatFCFAShort(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {detail.conditions && (
            <div className={cardInner}>
              <p className={`text-xs ${textMuted} mb-1`}>Conditions</p>
              <p className={`text-sm ${textSecondary}`}>{detail.conditions}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className={`text-sm font-medium ${textSecondary}`}>Statut</label>
            <select
              value={detail.statut}
              onChange={(e) => handleStatutChange(e.target.value)}
              className={`text-sm border border-gray-200 dark:border-gray-500 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 ${textPrimary}`}
            >
              {["En attente", "Envoyé", "Accepté", "Refusé"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex gap-2 ml-auto flex-wrap">
              {detail.statut === "Accepté" && (
                <button
                  type="button"
                  onClick={handleFacturer}
                  disabled={factureLoading}
                  className={actionBtnGreen}
                >
                  <Receipt className="w-4 h-4" />
                  {factureLoading ? "Facturation…" : "Facturer"}
                </button>
              )}
              <button onClick={handlePDF} className={`text-sm flex items-center gap-1 ${linkAccent}`}>
                <FileDown className="w-4 h-4" /> PDF
              </button>
              <button
                onClick={handleEmail}
                disabled={emailLoading}
                className="text-sm flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                <Mail className="w-4 h-4" /> {emailLoading ? "Envoi…" : "Email"}
              </button>
              <button onClick={handleWhatsApp} className="text-sm flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline">
                <Send className="w-4 h-4" /> WhatsApp
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={dupLoading}
                className="text-sm flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:underline disabled:opacity-50"
              >
                <Copy className="w-4 h-4" /> {dupLoading ? "…" : "Dupliquer"}
              </button>
              <button
                type="button"
                onClick={handleVersion}
                disabled={versionLoading}
                className="text-sm flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
              >
                <GitBranch className="w-4 h-4" /> {versionLoading ? "…" : "Nouvelle version"}
              </button>
              <button onClick={() => onEdit(detail)} className={`text-sm ${linkAccent}`}>
                Modifier →
              </button>
            </div>
          </div>

          <p className={`text-xs ${textFaint}`}>
            Émis le {formatDate(v.dateEmission)} · Expire le {formatDate(v.expireLe)} · Validité {v.jours} jours
          </p>
          {sendMsg && (
            <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
              {sendMsg}
            </p>
          )}
          {sendErr && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {sendErr}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Devis() {
  const [stats, setStats] = useState(null);
  const [devisList, setDevisList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editDevis, setEditDevis] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("Tous");

  const [factureMsg, setFactureMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/devis/overview");
      setStats(res.data.stats);
      setDevisList(res.data.items || []);
      setError("");
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await api.get("/devis");
        const items = fallback.data || [];
        setDevisList(items);
        setStats({
          total: items.length,
          enAttente: items.filter((d) => d.statut === "En attente").length,
          envoyes: items.filter((d) => d.statut === "Envoyé").length,
          acceptes: items.filter((d) => d.statut === "Accepté").length,
          refuses: items.filter((d) => d.statut === "Refusé").length,
          montantTotal: items.reduce((s, d) => s + (d.montantTTC || 0), 0),
          pipelineMontant: 0,
          accepteMontant: 0,
          tauxConversion: 0,
          expiresSoon: 0,
        });
        setError("");
      } else {
        setError(err.response?.data?.error || "Erreur lors du chargement des devis");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = devisList;
    if (filterStatut !== "Tous") list = list.filter((d) => d.statut === filterStatut);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.numeroAffiche?.toLowerCase().includes(q) ||
          d.numero?.toLowerCase().includes(q) ||
          d.client?.toLowerCase().includes(q) ||
          d.chantier?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [devisList, filterStatut, search]);

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce devis ?")) return;
    await api.delete(`/devis/${id}`);
    if (selectedId === id) setSelectedId(null);
    load();
  };

  const handleStatutChange = async (id, statut) => {
    await api.put(`/devis/${id}`, { statut });
    load();
  };

  const openEdit = async (d) => {
    const id = d._id || d.id;
    try {
      if (id && !d.lignes?.length) {
        const res = await api.get(`/devis/${id}/detail`);
        setEditDevis(res.data);
      } else {
        setEditDevis(d);
      }
    } catch {
      setEditDevis(d);
    }
    setShowForm(true);
    setSelectedId(null);
  };

  const handleFacturer = async (id) => {
    const type = pickFactureType();
    if (!type) return;
    if (!confirm(`Créer une ${FACTURE_TYPE_LABELS[type]} ?`)) return;
    try {
      const res = await api.post(`/devis/${id}/facture`, { type });
      setFactureMsg(res.data.message || "Facture créée.");
      setTimeout(() => {
        window.location.hash = "/factures";
      }, 1200);
    } catch (err) {
      const msg = err.response?.data?.error || "Impossible de facturer ce devis";
      if (err.response?.data?.factureId) {
        if (confirm(`${msg}. Aller aux factures ?`)) window.location.hash = "/factures";
      } else {
        alert(msg);
      }
    }
  };

  const handlePDF = (id, numero) => downloadFile(`/devis/${id}/pdf`, `devis_${numero || id}.pdf`);

  const handleEmail = async (id, clientEmail) => {
    try {
      const res = await api.post(`/devis/${id}/email`, clientEmail ? { email: clientEmail } : {});
      alert(res.data.message || "Devis envoyé par email.");
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Envoi email impossible");
    }
  };

  const handleWhatsApp = async (id) => {
    try {
      const res = await api.get(`/devis/${id}/whatsapp`);
      const url = res.data.url || res.data.whatsappUrl;
      if (!url) throw new Error("Lien WhatsApp indisponible");
      window.open(url, "_blank");
    } catch (err) {
      alert(err.response?.data?.error || "WhatsApp impossible");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Devis</h2>
          <p className={pageSubtitle}>Pipeline commercial, propositions et suivi des offres</p>
        </div>
        <button
          onClick={() => {
            setEditDevis(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau devis
        </button>
      </div>

      {factureMsg && (
        <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
          {factureMsg} Redirection vers les factures…
        </p>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Total devis", value: stats.total, icon: FileText },
            { label: "En attente", value: stats.enAttente },
            { label: "Envoyés", value: stats.envoyes },
            { label: "Acceptés", value: stats.acceptes, icon: CheckCircle },
            { label: "Pipeline TTC", value: formatFCFAShort(stats.pipelineMontant), icon: TrendingUp },
            { label: "CA accepté", value: formatFCFAShort(stats.accepteMontant) },
            { label: "Conversion", value: `${stats.tauxConversion}%` },
            {
              label: "Expire bientôt",
              value: stats.expiresSoon,
              warn: stats.expiresSoon > 0,
            },
          ].map((k) => (
            <div key={k.label} className={`${card} p-4`}>
              <p className={kpiLabel}>{k.label}</p>
              <p className={`${kpiValue} ${k.warn ? "text-amber-600 dark:text-amber-400" : ""}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

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
              placeholder="Rechercher n°, client, chantier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={searchInput}
            />
          </div>
        </div>
      </div>

      <DevisForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditDevis(null);
        }}
        devis={editDevis}
        onSaved={load}
      />

      {loading ? (
        <p className={textMuted}>Chargement...</p>
      ) : error ? (
        <p className="text-red-600 dark:text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 ${card}`}>
          <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className={textMuted}>Aucun devis trouvé.</p>
          <button onClick={() => setShowForm(true)} className={`mt-3 text-sm ${linkAccent}`}>
            Créer votre premier devis
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((d) => {
            const id = d._id || d.id;
            const expireSoon =
              (d.statut === "En attente" || d.statut === "Envoyé") &&
              d.joursRestants != null &&
              d.joursRestants >= 0 &&
              d.joursRestants <= 7;
            const expired = d.joursRestants != null && d.joursRestants < 0 && d.statut !== "Accepté" && d.statut !== "Refusé";

            return (
              <div key={id} className={`${card} hover:shadow-md transition overflow-hidden`}>
                <div className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statutBadge[d.statut] || ""}`}>
                          {d.statut}
                        </span>
                        <span className={`text-xs font-mono ${textFaint}`}>{d.numeroAffiche || d.numero}</span>
                      </div>
                      <h3 className={`font-semibold mt-2 truncate ${textPrimary}`}>{d.client}</h3>
                      {d.chantier && (
                        <p className={`text-sm ${textMuted} flex items-center gap-1`}>
                          <Building2 className="w-3 h-3" /> {d.chantier}
                        </p>
                      )}
                      <p className={`text-xs ${textFaint} mt-1 flex items-center gap-1`}>
                        <Clock className="w-3 h-3" /> {formatDate(d.date || d.dateEmission)}
                        {d.joursRestants != null && d.statut !== "Accepté" && d.statut !== "Refusé" && (
                          <span className={expired ? "text-red-500" : expireSoon ? "text-amber-500" : ""}>
                            · {expired ? "Expiré" : `${d.joursRestants}j restants`}
                          </span>
                        )}
                      </p>
                    </div>
                    {(expireSoon || expired) && (
                      <AlertTriangle className={`w-5 h-5 shrink-0 ${expired ? "text-red-500" : "text-amber-500"}`} />
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className={cardInner}>
                      <p className={textMuted}>Montant TTC</p>
                      <p className={`${amountDefault} text-blue-600 dark:text-blue-400`}>{formatFCFAShort(d.montantTTC)}</p>
                    </div>
                    <div className={cardInner}>
                      <p className={textMuted}>Lignes</p>
                      <p className={amountDefault}>{d.nbLignes || 0}</p>
                    </div>
                  </div>
                </div>

                <div className={`${cardFooter.replace("flex items-center justify-between", "space-y-2")}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <select
                      value={d.statut}
                      onChange={(e) => handleStatutChange(id, e.target.value)}
                      className={`text-xs border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 ${textPrimary}`}
                    >
                      {["En attente", "Envoyé", "Accepté", "Refusé"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {d.statut === "Accepté" && (
                      <button
                        type="button"
                        onClick={() => handleFacturer(id)}
                        className={actionBtnGreen}
                        title="Facturer"
                      >
                        <Receipt className="w-3.5 h-3.5" /> Facturer
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <button
                      onClick={() => handlePDF(id, d.numero)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                      title="Télécharger PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button
                      onClick={() => handleEmail(id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                      title="Envoyer par email"
                    >
                      <Mail className="w-3.5 h-3.5" /> Email
                    </button>
                    <button
                      onClick={() => handleWhatsApp(id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50"
                      title="Envoyer via WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    <button onClick={() => openEdit(d)} className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600" title="Modifier">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setSelectedId(id)} className={`text-xs ${linkAccent} flex items-center gap-0.5`}>
                      Détails <ChevronRight className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(id)} className="p-1 text-red-600 dark:text-red-400" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedId && (
        <DevisDetail
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={load}
          onEdit={(d) => openEdit(d)}
          onOpenDevis={(newId) => setSelectedId(newId)}
          onFacturer={(msg) => {
            setFactureMsg(msg);
            setTimeout(() => {
              window.location.hash = "/factures";
            }, 1200);
          }}
        />
      )}
    </div>
  );
}
