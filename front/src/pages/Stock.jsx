import { useEffect, useState, useMemo } from "react";
import api, { downloadFile } from "../lib/api";
import StockItemForm from "../components/StockItemForm";
import { formatMoney, formatMoneyShort } from "../lib/format";
import {
  pageTitle,
  pageSubtitle,
  card,
  textPrimary,
  textMuted,
  kpiValue,
  kpiLabel,
  searchInput,
  amountDefault,
  filterChipActive,
  filterChipIdle,
  btnSecondary,
  btnIconSecondary,
  actionBtnGreen,
  actionBtnAmber,
  actionBtnBlue,
  actionBtnRed,
} from "../lib/uiClasses";
import {
  FormModal,
  FormField,
  FormInput,
  FormSelect,
  FormActions,
  FormAlert,
} from "../components/form/FormUI";
import {
  PlusCircle,
  Edit,
  Trash2,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  FileSpreadsheet,
  FileDown,
  AlertTriangle,
  BarChart3,
  Building2,
  Search,
  Boxes,
  RefreshCw,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const CHART_COLORS = ["#0f172a", "#2563eb", "#059669", "#d97706", "#dc2626", "#6366f1"];
const ETATS = ["Tous", "OK", "Alerte", "Rupture"];

const etatBadge = {
  OK: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  Alerte: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Rupture: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

function pieLabel({ name, percent }) {
  if (percent == null) return name;
  return `${name} ${(percent * 100).toFixed(0)}%`;
}

function MouvementModal({ item, defaultType = "Entrée", onClose, onSaved }) {
  const [type, setType] = useState(defaultType);
  const [quantite, setQuantite] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setType(defaultType);
    setQuantite("");
    setCommentaire("");
    setError("");
  }, [item, defaultType]);

  const submit = async () => {
    const qte = Number(quantite);
    if (!qte || qte <= 0) {
      setError("Indiquez une quantité valide");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post(`/stock/${item._id || item.id}/mouvements`, {
        type,
        quantite: qte,
        commentaire,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors du mouvement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title="Mouvement de stock"
      subtitle={item.nom}
      icon={<Package className="w-5 h-5" />}
      size="md"
      footer={
        <FormActions
          onCancel={onClose}
          submitLabel="Enregistrer"
          loading={loading}
          onSubmit={submit}
        />
      }
    >
      {error && <FormAlert>{error}</FormAlert>}
      <p className={`text-sm ${textMuted} mb-4`}>
        Stock actuel : <strong className={textPrimary}>{item.quantiteActuelle}</strong> {item.unite}
      </p>
      <div className="space-y-4">
        <FormField label="Type de mouvement" required>
          <FormSelect value={type} onChange={(e) => setType(e.target.value)}>
            <option value="Entrée">Entrée (réception)</option>
            <option value="Sortie">Sortie (consommation)</option>
          </FormSelect>
        </FormField>
        <FormField label="Quantité" required>
          <FormInput
            type="number"
            min="0.01"
            step="0.01"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Commentaire">
          <FormInput value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Optionnel" />
        </FormField>
      </div>
    </FormModal>
  );
}

export default function Stock() {
  const [overview, setOverview] = useState(null);
  const [analyse, setAnalyse] = useState(null);
  const [chantiers, setChantiers] = useState([]);
  const [chantierId, setChantierId] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [mouvementItem, setMouvementItem] = useState(null);
  const [mouvementType, setMouvementType] = useState("Entrée");
  const [search, setSearch] = useState("");
  const [filtreEtat, setFiltreEtat] = useState("Tous");

  const chantierName = chantiers.find((c) => (c._id || c.id) === chantierId)?.nom;

  const loadChantiers = async () => {
    const res = await api.get("/chantier");
    const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
    setChantiers(list);
    if (list.length && !chantierId) {
      setChantierId(list[0]._id || list[0].id);
    }
  };

  const loadData = async (cid) => {
    if (!cid) {
      setOverview(null);
      setAnalyse(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const ovRes = await api.get(`/stock/overview?chantier=${cid}`);
      setOverview(ovRes.data);
      try {
        const analyseRes = await api.get(`/stock/analyse/${cid}`);
        setAnalyse(analyseRes.data);
      } catch {
        setAnalyse(null);
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Impossible de charger le stock");
      setOverview(null);
      setAnalyse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChantiers().catch(() => setErr("Impossible de charger les chantiers")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (chantierId) loadData(chantierId);
  }, [chantierId]);

  const stocks = overview?.items || [];
  const stats = overview?.stats || {};
  const alertes = overview?.alertes || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stocks.filter((s) => {
      if (filtreEtat !== "Tous" && s.etat !== filtreEtat) return false;
      if (!q) return true;
      return (
        s.nom?.toLowerCase().includes(q) ||
        s.reference?.toLowerCase().includes(q) ||
        s.categorie?.toLowerCase().includes(q)
      );
    });
  }, [stocks, search, filtreEtat]);

  const openAddForm = () => {
    if (!chantierId) {
      setErr("Sélectionnez un chantier d'abord.");
      return;
    }
    setEditItem(null);
    setShowForm(true);
  };

  const exportExcel = async () => {
    if (!chantierId) return;
    try {
      await downloadFile(`/stock/export/excel/${chantierId}`, `stock_${chantierId}.xlsx`);
    } catch (e) {
      setErr(e.message || "Export Excel impossible");
    }
  };

  const exportPdf = async () => {
    if (!chantierId) return;
    try {
      await downloadFile(`/stock/export/pdf/${chantierId}`, `stock_${chantierId}.pdf`);
    } catch (e) {
      setErr(e.message || "Export PDF impossible");
    }
  };

  const openMouvement = (item, type) => {
    setMouvementType(type);
    setMouvementItem(item);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Supprimer « ${item.nom} » ?`)) return;
    try {
      await api.delete(`/stock/${item._id || item.id}`);
      await loadData(chantierId);
    } catch (e) {
      setErr(e.response?.data?.error || "Suppression impossible");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Stock & matériaux</h2>
          <p className={pageSubtitle}>Inventaire par chantier, alertes et valorisation</p>
        </div>
      </div>

      {err && (
        <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          <span>{err}</span>
          <button type="button" onClick={() => setErr("")} className="shrink-0 p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barre outils */}
      <div className={`${card} p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between`}>
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            className="px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full sm:w-auto sm:min-w-[220px]"
            value={chantierId}
            onChange={(e) => setChantierId(e.target.value)}
          >
            <option value="">— Chantier —</option>
            {chantiers.map((c) => (
              <option key={c._id || c.id} value={c._id || c.id}>
                {c.nom}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => chantierId && loadData(chantierId)}
            disabled={!chantierId || loading}
            className={btnIconSecondary}
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportPdf}
            disabled={!chantierId}
            className={btnSecondary}
          >
            <FileDown className="w-4 h-4" /> Export PDF
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={!chantierId}
            className={btnSecondary}
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          <button
            type="button"
            onClick={openAddForm}
            disabled={!chantierId}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4" /> Nouvel article
          </button>
        </div>
      </div>

      {!chantierId ? (
        <div className={`${card} p-12 text-center ${textMuted}`}>
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Choisissez un chantier pour gérer le stock</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Articles", value: stats.totalArticles ?? 0, icon: Boxes },
              { label: "Valeur stock", value: formatMoneyShort(stats.totalValeur ?? 0), icon: Package },
              { label: "Alertes", value: stats.alertes ?? 0, icon: AlertTriangle, warn: stats.alertes > 0 },
              { label: "Ruptures", value: stats.ruptures ?? 0, icon: AlertTriangle, warn: stats.ruptures > 0 },
            ].map((k) => (
              <div key={k.label} className={`${card} p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={kpiLabel}>{k.label}</p>
                    <p className={`${kpiValue} mt-1 ${k.warn ? "text-amber-600 dark:text-amber-400" : ""}`}>{k.value}</p>
                  </div>
                  <k.icon className={`w-5 h-5 shrink-0 ${k.warn ? "text-amber-500" : "text-slate-400"}`} />
                </div>
              </div>
            ))}
          </div>

          {alertes.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <h4 className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold text-sm mb-2">
                <AlertTriangle className="w-4 h-4" /> Alertes ({alertes.length})
              </h4>
              <ul className="text-sm text-amber-900 dark:text-amber-100 space-y-1">
                {alertes.slice(0, 8).map((a) => (
                  <li key={a._id || a.id}>
                    <strong>{a.nom}</strong> — {a.etat} · {a.quantiteActuelle} {a.unite} restant(s)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={`${card} overflow-hidden`}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-600 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-slate-50/80 dark:bg-gray-800/50">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={searchInput}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ETATS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setFiltreEtat(e)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filtreEtat === e ? filterChipActive : filterChipIdle}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className={`p-10 text-center ${textMuted}`}>Chargement…</p>
            ) : filtered.length === 0 ? (
              <div className={`p-10 text-center ${textMuted}`}>
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="mb-4">Aucun article pour ce chantier</p>
                <button
                  type="button"
                  onClick={openAddForm}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <PlusCircle className="w-4 h-4" /> Ajouter un article
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-gray-700/60 text-left">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Article</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Catégorie</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">Qté</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">P.U.</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">Valeur</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">État</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right min-w-[280px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filtered.map((s) => (
                      <tr key={s._id || s.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/20">
                        <td className="px-4 py-3">
                          <p className={`font-medium ${textPrimary}`}>{s.nom}</p>
                          {s.reference && <p className={`text-xs ${textMuted}`}>Ref. {s.reference}</p>}
                        </td>
                        <td className={`px-4 py-3 ${textMuted}`}>{s.categorie}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {s.quantiteActuelle} <span className={textMuted}>{s.unite}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatMoneyShort(s.prixUnitaire)}</td>
                        <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${amountDefault}`}>
                          {formatMoneyShort(s.valeurTotale)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${etatBadge[s.etat] || etatBadge.OK}`}>
                            {s.etat}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openMouvement(s, "Entrée")}
                              className={actionBtnGreen}
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5" /> Entrée
                            </button>
                            <button
                              type="button"
                              onClick={() => openMouvement(s, "Sortie")}
                              className={actionBtnAmber}
                            >
                              <ArrowUpCircle className="w-3.5 h-3.5" /> Sortie
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditItem(s); setShowForm(true); }}
                              className={actionBtnBlue}
                            >
                              <Edit className="w-3.5 h-3.5" /> Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(s)}
                              className={actionBtnRed}
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {analyse?.parCategorie?.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className={`${card} p-4`}>
                <h4 className="flex items-center gap-2 font-semibold text-sm mb-3 text-gray-800 dark:text-gray-200">
                  <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Valeur par catégorie
                </h4>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={analyse.parCategorie}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={90}
                      label={pieLabel}
                    >
                      {analyse.parCategorie.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className={`${card} p-4`}>
                <h4 className="flex items-center gap-2 font-semibold text-sm mb-3 text-gray-800 dark:text-gray-200">
                  <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Sorties (rotation)
                </h4>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analyse.topRotation?.filter((r) => r.rotation > 0) || []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="nom" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => `${v} unités`} />
                    <Bar dataKey="rotation" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      <StockItemForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditItem(null); }}
        onSaved={() => loadData(chantierId)}
        chantierId={chantierId}
        chantierName={chantierName}
        editData={editItem}
      />

      {mouvementItem && (
        <MouvementModal
          key={`${mouvementItem._id || mouvementItem.id}-${mouvementType}`}
          item={mouvementItem}
          defaultType={mouvementType}
          onClose={() => setMouvementItem(null)}
          onSaved={() => loadData(chantierId)}
        />
      )}
    </div>
  );
}
