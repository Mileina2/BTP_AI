import { useEffect, useState, useMemo } from "react";
import api, { downloadFile } from "../lib/api";
import BudgetDepenseForm from "../components/BudgetDepenseForm";
import { formatFCFAShort, formatFCFA } from "../lib/format";
import {
  card,
  cardInner,
  textPrimary,
  textSecondary,
  textMuted,
  textFaint,
  kpiLabel,
  searchInput,
  linkAccent,
  filterChipActive,
  filterChipIdle,
} from "../lib/uiClasses";
import {
  Wallet,
  Plus,
  Search,
  Trash2,
  FileDown,
  FileSpreadsheet,
  X,
  Building2,
  AlertTriangle,
  Edit,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  PieChart as PieIcon,
  BarChart3,
  Activity,
  Target,
  Banknote,
  Layers,
  List,
  RefreshCw,
  Calendar,
  Truck,
  ArrowRight,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

const CHART_COLORS = ["#0f172a", "#2563eb", "#059669", "#d97706", "#dc2626", "#6366f1"];
const CATEGORIES = ["Toutes", "Matériaux", "Main-d'œuvre", "Transport", "Sous-traitance", "Autre"];
const VIEWS = [
  { id: "portfolio", label: "Portefeuille projets", icon: Layers },
  { id: "control", label: "Contrôle financier", icon: Activity },
  { id: "echeances", label: "Échéances fournisseurs", icon: Calendar },
  { id: "journal", label: "Journal des charges", icon: List },
];

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function goToFournisseurs() {
  window.location.hash = "/fournisseurs";
}

function EcheanceRow({ d, onOpen, onPaye }) {
  const id = d.id || d._id;
  return (
    <div className="flex flex-wrap items-center gap-2 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0 text-sm">
      <button type="button" onClick={() => onOpen?.(id)} className="flex-1 min-w-0 text-left hover:opacity-80">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium ${textPrimary}`}>{d.libelle}</span>
          {d.enRetard && (
            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">Retard</span>
          )}
          {!d.enRetard && d.joursRestants !== null && d.joursRestants <= 7 && (
            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">J-{d.joursRestants}</span>
          )}
        </div>
        <p className={`text-xs ${textMuted}`}>
          {[d.chantierNom, d.fournisseurNom || d.fournisseur, d.dateEcheance ? formatDate(d.dateEcheance) : "Sans échéance"].filter(Boolean).join(" · ")}
        </p>
      </button>
      <span className="font-semibold text-red-600 shrink-0">{formatFCFAShort(d.montant)}</span>
      {!d.paye && (
        <button type="button" onClick={() => onPaye?.(id)} title="Marquer soldée" className={linkAccent}>
          <CheckCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function progressColor(pct) {
  if (pct >= 100) return "bg-red-600";
  if (pct >= 80) return "bg-amber-500";
  if (pct >= 50) return "bg-blue-600";
  return "bg-emerald-600";
}

function risqueStyle(risque) {
  switch (risque) {
    case "CRITIQUE":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "ÉLEVÉ":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    case "MODÉRÉ":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    default:
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
}

function DepenseDetail({ id, onClose, onUpdated, onEdit }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => api.get(`/budget/${id}/detail`).then((res) => setDetail(res.data));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  const togglePaye = async () => {
    await api.put(`/budget/${id}`, { paye: !detail.paye });
    onUpdated();
    await load();
  };

  if (loading) return <div className={`p-8 text-center ${textMuted}`}>Chargement…</div>;
  if (!detail) return null;

  const f = detail.finances || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="bg-slate-900 text-white p-5 flex justify-between items-start rounded-t-2xl">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Ligne de charge</p>
            <h3 className="text-xl font-semibold mt-1">{detail.libelle}</h3>
            <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> {detail.chantier?.nom || detail.chantierNom}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {detail.categorie}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                detail.paye
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              }`}
            >
              {detail.paye ? "Soldée" : "Engagement non soldé"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Quantité", value: `${f.quantite} ${f.unite || "u"}` },
              { label: "Prix unitaire HT", value: formatFCFAShort(f.prixUnitaire) },
              { label: "Montant HT", value: formatFCFAShort(f.montant), highlight: true },
              { label: "Date d'imputation", value: formatDate(detail.date) },
            ].map((k) => (
              <div key={k.label} className={cardInner}>
                <p className={kpiLabel}>{k.label}</p>
                <p className={`font-bold text-sm ${k.highlight ? "text-slate-900 dark:text-white" : textPrimary}`}>
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          {detail.fournisseur && (
            <div className={cardInner}>
              <p className={`text-xs ${textMuted} mb-1`}>Fournisseur / tiers</p>
              <p className={`text-sm ${textSecondary}`}>{detail.fournisseur}</p>
            </div>
          )}

          {detail.dateEcheance && (
            <div className={cardInner}>
              <p className={`text-xs ${textMuted} mb-1`}>Échéance paiement</p>
              <p className={`text-sm font-medium ${textPrimary}`}>{formatDate(detail.dateEcheance)}</p>
            </div>
          )}

          {detail.commentaire && (
            <div className={cardInner}>
              <p className={`text-xs ${textMuted} mb-1`}>Commentaire</p>
              <p className={`text-sm ${textSecondary}`}>{detail.commentaire}</p>
            </div>
          )}

          {detail.chantier && (
            <div
              className={`${cardInner} border-l-4 ${
                detail.chantier.depasse ? "border-red-500" : detail.chantier.enAlerte ? "border-amber-500" : "border-emerald-500"
              }`}
            >
              <p className={`text-xs ${textMuted} mb-2`}>Impact sur le budget projet</p>
              <div className="flex justify-between text-sm mb-2">
                <span className={textSecondary}>Taux de consommation {detail.chantier.pourcentage}%</span>
                <span className={textMuted}>
                  {formatFCFAShort(detail.chantier.depenses)} / {formatFCFAShort(detail.chantier.budget)}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressColor(detail.chantier.pourcentage)}`}
                  style={{ width: `${Math.min(detail.chantier.pourcentage, 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={togglePaye}
              className={`text-sm px-4 py-2 rounded-lg border font-medium ${
                detail.paye
                  ? "border-gray-200 dark:border-gray-600 text-gray-600"
                  : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              {detail.paye ? "Réouvrir l'engagement" : "Marquer comme soldée"}
            </button>
            <button onClick={() => onEdit(detail)} className={`text-sm ml-auto ${linkAccent}`}>
              Modifier →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlTower({ controle, chantierName, prediction }) {
  if (!controle) return null;

  const cards = [
    { label: "Budget prévisionnel (BP)", value: formatFCFAShort(controle.budget), icon: Target },
    { label: "Charges réelles", value: formatFCFAShort(controle.depenses), icon: TrendingUp },
    {
      label: "Écart budgétaire",
      value: formatFCFAShort(controle.ecart),
      icon: controle.ecart > 0 ? TrendingUp : TrendingDown,
      bad: controle.ecart > 0,
      good: controle.ecart < 0,
    },
    { label: "Encaissements", value: formatFCFAShort(controle.encaisse), icon: Banknote },
    {
      label: "Marge opérationnelle",
      value: formatFCFAShort(controle.margeOperationnelle),
      icon: Wallet,
      good: controle.margeOperationnelle > 0,
      bad: controle.margeOperationnelle < 0,
    },
    { label: "Engagements non soldés", value: formatFCFAShort(controle.engageNonPaye), icon: AlertTriangle },
  ];

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Centre de contrôle financier</p>
          <h2 className="text-lg font-semibold mt-0.5">{chantierName}</h2>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${risqueStyle(controle.risque)}`}>
          Risque {controle.risque}
        </span>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((k) => (
            <div key={k.label} className={`${cardInner} border border-gray-100 dark:border-gray-700`}>
              <div className="flex items-center justify-between mb-1">
                <p className={kpiLabel}>{k.label}</p>
                <k.icon className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p
                className={`font-bold text-sm tabular-nums ${
                  k.bad ? "text-red-600" : k.good ? "text-emerald-600" : textPrimary
                }`}
              >
                {k.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className={cardInner}>
            <div className="flex justify-between text-xs mb-2">
              <span className={textMuted}>Avancement physique</span>
              <span className="font-medium">{controle.avancementPhysique}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${Math.min(controle.avancementPhysique, 100)}%` }} />
            </div>
          </div>
          <div className={cardInner}>
            <div className="flex justify-between text-xs mb-2">
              <span className={textMuted}>Avancement financier</span>
              <span className="font-medium">{controle.pourcentage}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${progressColor(controle.pourcentage)}`}
                style={{ width: `${Math.min(controle.pourcentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3 text-sm">
          {controle.montantDevis > 0 && (
            <div className={cardInner}>
              <p className={kpiLabel}>Devis de référence</p>
              <p className="font-semibold">{formatFCFAShort(controle.montantDevis)}</p>
              {controle.devisNumero && <p className={`text-xs ${textFaint} mt-0.5`}>{controle.devisNumero}</p>}
            </div>
          )}
          {controle.forecastFinal != null && (
            <div className={cardInner}>
              <p className={kpiLabel}>Projection fin de projet</p>
              <p className={`font-semibold ${controle.ecartForecast > 0 ? "text-red-600" : textPrimary}`}>
                {formatFCFAShort(controle.forecastFinal)}
              </p>
              {controle.ecartForecast != null && (
                <p className={`text-xs mt-0.5 ${controle.ecartForecast > 0 ? "text-red-500" : "text-emerald-600"}`}>
                  Écart forecast {formatFCFAShort(controle.ecartForecast)}
                </p>
              )}
            </div>
          )}
          {prediction?.burnRate > 0 && (
            <div className={cardInner}>
              <p className={kpiLabel}>Burn rate (3 mois)</p>
              <p className="font-semibold">{formatFCFAShort(prediction.burnRate)}/mois</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportReportModal({ open, onClose, chantiers, selectedId, onExportProject, onExportConsolidated, onExportProjectExcel, onExportConsolidatedExcel }) {
  const [pickId, setPickId] = useState(selectedId || "");

  useEffect(() => {
    if (open) setPickId(selectedId || chantiers[0]?.id || chantiers[0]?._id || "");
  }, [open, selectedId, chantiers]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md text-gray-900 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <div>
            <h3 className="font-semibold">Exporter le budget</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">PDF ou Excel — par projet ou consolidé</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Par projet</label>
            <select
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
              className="mt-2 w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-700"
            >
              {chantiers.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.nom}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                disabled={!pickId}
                onClick={() => onExportProject(pickId)}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg disabled:opacity-40"
              >
                <FileDown className="w-4 h-4" /> PDF
              </button>
              <button
                type="button"
                disabled={!pickId}
                onClick={() => onExportProjectExcel?.(pickId)}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Vue consolidée</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onExportConsolidated}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
              >
                <FileDown className="w-4 h-4" /> PDF
              </button>
              <button
                type="button"
                onClick={onExportConsolidatedExcel}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Budget() {
  const [stats, setStats] = useState(null);
  const [chantiers, setChantiers] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [selectedChantier, setSelectedChantier] = useState("");
  const [controle, setControle] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [analyse, setAnalyse] = useState({ pieChart: [], lineChart: [], barChart: [], categorieTable: [], monthlyChart: [] });
  const [loading, setLoading] = useState(true);
  const [loadingChantier, setLoadingChantier] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editDepense, setEditDepense] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("Toutes");
  const [filterPaye, setFilterPaye] = useState("tous");
  const [view, setView] = useState("portfolio");
  const [showExportModal, setShowExportModal] = useState(false);
  const [alertes, setAlertes] = useState([]);
  const [echeancesDepenses, setEcheancesDepenses] = useState([]);
  const [echeancesChantier, setEcheancesChantier] = useState([]);
  const [echeanceFiltre, setEcheanceFiltre] = useState("toutes");

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await api.get("/budget/overview");
      setStats(res.data.stats);
      setChantiers(res.data.chantiers || []);
      setDepenses(res.data.items || []);
      setAlertes(res.data.alertes || []);
      setEcheancesDepenses(res.data.echeancesDepenses || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const loadChantier = async (chantierId) => {
    if (!chantierId) {
      setControle(null);
      setPrediction(null);
      setAnalyse({ pieChart: [], lineChart: [], barChart: [], categorieTable: [], monthlyChart: [] });
      return;
    }
    setLoadingChantier(true);
    try {
      const res = await api.get(`/budget/chantier/${chantierId}`);
      setControle(res.data.controle || res.data.resume);
      setPrediction(res.data.prediction);
      setAnalyse(res.data.analyse || {});
      setEcheancesChantier(res.data.echeancesOuvertes || []);
    } catch {
      setError("Erreur chargement contrôle projet");
    } finally {
      setLoadingChantier(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (loading || !chantiers.length) return;
    const id = sessionStorage.getItem("btpia_nav_chantier");
    if (!id) return;
    sessionStorage.removeItem("btpia_nav_chantier");
    if (chantiers.some((c) => (c.id || c._id) === id)) {
      setSelectedChantier(id);
      setView("control");
    }
  }, [loading, chantiers]);

  useEffect(() => {
    loadChantier(selectedChantier);
  }, [selectedChantier]);

  const selectProject = (id, goToControl = false) => {
    setSelectedChantier(id);
    if (goToControl && id) setView("control");
  };

  const selectedChantierName = chantiers.find((c) => (c.id || c._id) === selectedChantier)?.nom;

  const visibleDepenses = useMemo(() => {
    let list = depenses;
    if (selectedChantier) list = list.filter((d) => (d.chantierId || d.chantier) === selectedChantier);
    if (filterCategorie !== "Toutes") list = list.filter((d) => d.categorie === filterCategorie);
    if (filterPaye === "payees") list = list.filter((d) => d.paye);
    if (filterPaye === "nonpayees") list = list.filter((d) => !d.paye);
    if (filterPaye === "retard") list = list.filter((d) => !d.paye && d.enRetard);
    if (filterPaye === "7j") list = list.filter((d) => !d.paye && d.joursRestants !== null && d.joursRestants <= 7);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.libelle?.toLowerCase().includes(q) ||
          d.fournisseur?.toLowerCase().includes(q) ||
          d.categorie?.toLowerCase().includes(q) ||
          d.chantierNom?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [depenses, selectedChantier, filterCategorie, filterPaye, search]);

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette ligne de charge ?")) return;
    await api.delete(`/budget/${id}`);
    await refresh();
  };

  const exportProjectPdf = (chantierId) => {
    const c = chantiers.find((x) => (x.id || x._id) === chantierId);
    const slug = (c?.nom || "projet").replace(/\s+/g, "_");
    downloadFile(`/budget/export/pdf/${chantierId}`, `controle_budget_${slug}.pdf`);
    setShowExportModal(false);
  };

  const exportConsolidatedPdf = () => {
    downloadFile("/budget/export/pdf/consolidated", "controle_budget_consolide.pdf");
    setShowExportModal(false);
  };

  const exportProjectExcel = (chantierId) => {
    const c = chantiers.find((x) => (x.id || x._id) === chantierId);
    const slug = (c?.nom || "projet").replace(/\s+/g, "_");
    downloadFile(`/budget/export/excel/${chantierId}`, `budget_${slug}.xlsx`);
    setShowExportModal(false);
  };

  const exportConsolidatedExcel = () => {
    downloadFile("/budget/export/excel/consolidated", "budget_consolide.xlsx");
    setShowExportModal(false);
  };

  const handleExportExcel = () => {
    if (chantiers.length === 0) {
      alert("Aucun projet disponible pour l'export.");
      return;
    }
    if (selectedChantier) {
      exportProjectExcel(selectedChantier);
      return;
    }
    if (chantiers.length === 1) {
      exportProjectExcel(chantiers[0].id || chantiers[0]._id);
      return;
    }
    setShowExportModal(true);
  };

  const handleExportPdf = () => {
    if (chantiers.length === 0) {
      alert("Aucun projet disponible pour générer un rapport.");
      return;
    }
    if (selectedChantier) {
      exportProjectPdf(selectedChantier);
      return;
    }
    if (chantiers.length === 1) {
      exportProjectPdf(chantiers[0].id || chantiers[0]._id);
      return;
    }
    setShowExportModal(true);
  };

  const openAdd = () => {
    setEditDepense(null);
    setShowForm(true);
  };

  const refresh = async () => {
    await loadOverview();
    if (selectedChantier) await loadChantier(selectedChantier);
  };

  const markDepensePayee = async (id) => {
    await api.put(`/budget/${id}`, { paye: true });
    await refresh();
  };

  const filteredEcheances = useMemo(() => {
    let list = selectedChantier
      ? echeancesDepenses.filter((d) => (d.chantierId || d.chantier) === selectedChantier)
      : echeancesDepenses;
    if (echeanceFiltre === "retard") list = list.filter((d) => d.enRetard);
    if (echeanceFiltre === "7j") list = list.filter((d) => d.joursRestants !== null && d.joursRestants <= 7 && !d.enRetard);
    if (echeanceFiltre === "sans") list = list.filter((d) => !d.dateEcheance);
    return list;
  }, [echeancesDepenses, selectedChantier, echeanceFiltre]);

  return (
    <div className="space-y-0 -mt-2">
      {/* Command center header */}
      <div className="bg-slate-900 text-white rounded-xl px-6 py-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-medium">Pilotage financier</p>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">Contrôle budgétaire & charges</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Suivi consolidé des budgets prévisionnels, charges réelles, écarts et marges opérationnelles par projet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </button>
            <button
              type="button"
              onClick={() => downloadFile("/budget/export/csv", `budget_charges_${new Date().toISOString().slice(0, 10)}.csv`)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600"
            >
              <FileSpreadsheet className="w-4 h-4" /> CSV
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer relative z-10"
            >
              <FileDown className="w-4 h-4" /> Rapport PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 cursor-pointer relative z-10"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer relative z-10"
            >
              <Plus className="w-4 h-4" /> Imputer une charge
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-6">
            {[
              { label: "BP consolidé", value: formatFCFAShort(stats.budgetTotal) },
              { label: "Charges réelles", value: formatFCFAShort(stats.depensesTotal) },
              {
                label: "Écart global",
                value: formatFCFAShort(stats.ecartGlobal),
                warn: stats.ecartGlobal > 0,
              },
              { label: "Encaissements", value: formatFCFAShort(stats.encaisseTotal) },
              {
                label: "Marge globale",
                value: formatFCFAShort(stats.margeGlobale),
                good: stats.margeGlobale > 0,
                bad: stats.margeGlobale < 0,
              },
              {
                label: "Engagements ouverts",
                value: formatFCFAShort(stats.montantNonPaye),
                sub: `${stats.depensesNonPayees} lignes`,
              },
            ].map((k) => (
              <div key={k.label} className="bg-slate-800/60 rounded-lg px-3 py-3 border border-slate-700/50">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{k.label}</p>
                <p
                  className={`text-lg font-bold tabular-nums mt-1 ${
                    k.warn ? "text-red-400" : k.good ? "text-emerald-400" : k.bad ? "text-red-400" : "text-white"
                  }`}
                >
                  {k.value}
                </p>
                {k.sub && <p className="text-[10px] text-slate-500 mt-0.5">{k.sub}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm mb-4">{error}</div>
      )}

      {alertes.map((a, i) => (
        <div
          key={i}
          className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-2 mb-4 ${
            a.type === "critical"
              ? "bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-800"
              : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-amber-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span><strong>{a.titre}</strong> — {a.message}</span>
          </div>
          <button type="button" onClick={() => setView("echeances")} className={`text-xs shrink-0 ${linkAccent} flex items-center gap-1`}>
            Voir échéances <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      ))}

      {/* View tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition ${
              view === v.id ? "bg-slate-900 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <v.icon className="w-4 h-4" /> {v.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className={`${card} p-4 mb-6 space-y-3`}>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-0 w-full sm:min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className={`${searchInput} pl-9`}
              placeholder="Rechercher dans le journal des charges…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={selectedChantier}
            onChange={(e) => setSelectedChantier(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-700 w-full sm:w-auto sm:min-w-[220px]"
          >
            <option value="">Tous les projets</option>
            {chantiers.map((c) => (
              <option key={c.id || c._id} value={c.id || c._id}>
                {c.nom} · {c.pourcentage ?? 0}%
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setFilterCategorie(cat)} className={filterCategorie === cat ? filterChipActive : filterChipIdle}>
              {cat}
            </button>
          ))}
          <span className="w-px bg-gray-200 dark:bg-gray-600 mx-1" />
          {[
            { id: "tous", label: "Toutes" },
            { id: "nonpayees", label: "Non soldées" },
            { id: "payees", label: "Soldées" },
            { id: "retard", label: "En retard" },
            { id: "7j", label: "Échéance 7j" },
          ].map((f) => (
            <button key={f.id} onClick={() => setFilterPaye(f.id)} className={filterPaye === f.id ? filterChipActive : filterChipIdle}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio view */}
      {view === "portfolio" && (
        <div className={`${card} overflow-hidden mb-6`}>
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className={`font-semibold ${textPrimary}`}>Portefeuille projets</h2>
            <span className={`text-xs ${textMuted}`}>{chantiers.length} projet(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/80 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Projet</th>
                  <th className="px-4 py-3 text-right font-medium">BP</th>
                  <th className="px-4 py-3 text-right font-medium">Charges</th>
                  <th className="px-4 py-3 text-right font-medium">Écart</th>
                  <th className="px-4 py-3 text-right font-medium">Encaissements</th>
                  <th className="px-4 py-3 text-right font-medium">Marge</th>
                  <th className="px-4 py-3 text-right font-medium">Dettes ouv.</th>
                  <th className="px-4 py-3 text-center font-medium">Conso.</th>
                  <th className="px-4 py-3 text-center font-medium">Risque</th>
                  <th className="px-4 py-3 text-center font-medium">Phys.</th>
                </tr>
              </thead>
              <tbody>
                {chantiers.map((c) => {
                  const id = c.id || c._id;
                  const selected = id === selectedChantier;
                  return (
                    <tr
                      key={id}
                      onClick={() => selectProject(selected ? "" : id, !selected)}
                      className={`border-t border-gray-100 dark:border-gray-700 cursor-pointer transition ${
                        selected ? "bg-slate-50 dark:bg-slate-800/50" : "hover:bg-gray-50 dark:hover:bg-gray-800/30"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className={`font-medium ${textPrimary}`}>{c.nom}</p>
                        {c.ville && <p className={`text-xs ${textFaint}`}>{c.ville}</p>}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${textMuted}`}>{formatFCFAShort(c.budget)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatFCFAShort(c.depenses)}</td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-medium ${
                          c.ecart > 0 ? "text-red-600" : c.ecart < 0 ? "text-emerald-600" : textMuted
                        }`}
                      >
                        {formatFCFAShort(c.ecart ?? (c.depenses - c.budget))}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${textMuted}`}>{formatFCFAShort(c.encaisse || 0)}</td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-medium ${
                          (c.margeOperationnelle || 0) >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {formatFCFAShort(c.margeOperationnelle || 0)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${c.engageNonPaye > 0 ? "text-amber-600" : textMuted}`}>
                        {formatFCFAShort(c.engageNonPaye || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full ${progressColor(c.pourcentage)}`} style={{ width: `${Math.min(c.pourcentage, 100)}%` }} />
                          </div>
                          <span className="text-xs tabular-nums w-10">{c.pourcentage}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${risqueStyle(c.risque)}`}>
                          {c.risque || "FAIBLE"}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-center text-xs tabular-nums ${textMuted}`}>{c.avancementPhysique ?? 0}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Control tower */}
      {view === "control" && (
        <div className="mb-6 space-y-6">
          {!selectedChantier ? (
            <div className={`${card} p-10 text-center`}>
              <Activity className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className={`font-medium ${textPrimary}`}>Sélectionnez un projet</p>
              <p className={`text-sm ${textMuted} mt-1 max-w-md mx-auto`}>
                Choisissez un projet dans le filtre ci-dessus ou depuis l’onglet Portefeuille projets pour afficher le centre de contrôle financier.
              </p>
              <button
                type="button"
                onClick={() => setView("portfolio")}
                className="mt-4 text-sm text-slate-700 dark:text-slate-300 underline hover:no-underline"
              >
                Voir le portefeuille projets →
              </button>
            </div>
          ) : loadingChantier ? (
            <p className={textMuted}>Chargement du contrôle financier…</p>
          ) : (
            <>
              <ControlTower controle={controle} chantierName={selectedChantierName} prediction={prediction} />

              {echeancesChantier.length > 0 && (
                <div className={`${card} p-4`}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className={`font-semibold text-sm ${textPrimary}`}>Échéances fournisseurs — {selectedChantierName}</h3>
                    <button type="button" onClick={goToFournisseurs} className={`text-xs ${linkAccent} flex items-center gap-1`}>
                      <Truck className="w-3 h-3" /> Fournisseurs
                    </button>
                  </div>
                  {echeancesChantier.slice(0, 6).map((d) => (
                    <EcheanceRow key={d.id || d._id} d={d} onOpen={setSelectedId} onPaye={markDepensePayee} />
                  ))}
                </div>
              )}

              {analyse.categorieTable?.length > 0 && (
                <div className={`${card} overflow-hidden`}>
                  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className={`font-semibold text-sm ${textPrimary}`}>Analyse par nature de charges</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Catégorie</th>
                        <th className="px-4 py-2 text-right">Montant</th>
                        <th className="px-4 py-2 text-right">Part charges</th>
                        <th className="px-4 py-2 text-right">Part BP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyse.categorieTable.map((row) => (
                        <tr key={row.categorie} className="border-t border-gray-100 dark:border-gray-700">
                          <td className={`px-4 py-2.5 ${textSecondary}`}>{row.categorie}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatFCFAShort(row.montant)}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums ${textMuted}`}>{row.partDepenses}%</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums ${textMuted}`}>{row.partBudget}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {analyse.pieChart?.length > 0 && (
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className={`${card} p-4`}>
                    <h3 className={`font-medium text-sm mb-4 flex items-center gap-2 ${textSecondary}`}>
                      <PieIcon className="w-4 h-4" /> Structure des charges
                    </h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={analyse.pieChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(entry) => `${entry.name} ${Math.round(entry.percent * 100)}%`}>
                          {analyse.pieChart.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatFCFA(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {analyse.lineChart?.length > 1 && (
                    <div className={`${card} p-4`}>
                      <h3 className={`font-medium text-sm mb-4 flex items-center gap-2 ${textSecondary}`}>
                        <TrendingUp className="w-4 h-4" /> Courbe de charges cumulées vs BP
                      </h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={analyse.lineChart}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} />
                          <Tooltip formatter={(v) => formatFCFA(v)} />
                          <ReferenceLine y={controle?.budget} stroke="#dc2626" strokeDasharray="4 4" label="BP" />
                          <Line type="monotone" dataKey="montant" name="Charges cumulées" stroke="#0f172a" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {analyse.monthlyChart?.length > 0 && (
                    <div className={`${card} p-4`}>
                      <h3 className={`font-medium text-sm mb-4 flex items-center gap-2 ${textSecondary}`}>
                        <BarChart3 className="w-4 h-4" /> Charges par période
                      </h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={analyse.monthlyChart}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} />
                          <Tooltip formatter={(v) => formatFCFA(v)} />
                          <Bar dataKey="value" fill="#334155" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {analyse.barChart?.length > 0 && (
                    <div className={`${card} p-4`}>
                      <h3 className={`font-medium text-sm mb-4 flex items-center gap-2 ${textSecondary}`}>
                        <BarChart3 className="w-4 h-4" /> Charges par catégorie
                      </h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={analyse.barChart} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} />
                          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v) => formatFCFA(v)} />
                          <Bar dataKey="montant" fill="#2563eb" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Échéances fournisseurs */}
      {view === "echeances" && (
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div>
              <h2 className={`font-semibold ${textPrimary}`}>Échéances paiement fournisseurs</h2>
              <p className={`text-xs ${textMuted}`}>{filteredEcheances.length} charge(s) ouverte(s)</p>
            </div>
            <button type="button" onClick={goToFournisseurs} className={filterChipIdle}>
              <Truck className="w-4 h-4" /> Gérer fournisseurs
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { id: "toutes", label: "Toutes" },
              { id: "retard", label: "En retard" },
              { id: "7j", label: "Sous 7 j" },
              { id: "sans", label: "Sans échéance" },
            ].map((f) => (
              <button key={f.id} type="button" onClick={() => setEcheanceFiltre(f.id)} className={echeanceFiltre === f.id ? filterChipActive : filterChipIdle}>
                {f.label}
              </button>
            ))}
          </div>
          {filteredEcheances.length === 0 ? (
            <p className={`text-sm ${textMuted}`}>Aucune charge pour ce filtre.</p>
          ) : (
            filteredEcheances.map((d) => (
              <EcheanceRow key={d.id || d._id} d={d} onOpen={setSelectedId} onPaye={markDepensePayee} />
            ))
          )}
        </div>
      )}

      {/* Journal */}
      {view === "journal" && (
        <div className={`${card} overflow-hidden mb-6`}>
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className={`font-semibold ${textPrimary}`}>Journal des charges</h2>
              <span className={`text-xs ${textMuted}`}>{visibleDepenses.length} ligne(s)</span>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
            >
              <Plus className="w-4 h-4" /> Imputer une charge
            </button>
          </div>
          {loading ? (
            <p className={`p-6 ${textMuted}`}>Chargement…</p>
          ) : visibleDepenses.length === 0 ? (
            <div className="p-10 text-center">
              <Wallet className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className={textSecondary}>Aucune ligne de charge</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-white text-xs">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Date</th>
                    <th className="px-4 py-2.5 text-left font-medium">Projet</th>
                    <th className="px-4 py-2.5 text-left font-medium">Libellé</th>
                    <th className="px-4 py-2.5 text-left font-medium">Catégorie</th>
                    <th className="px-4 py-2.5 text-left font-medium">Fournisseur</th>
                    <th className="px-4 py-2.5 text-left font-medium">Échéance</th>
                    <th className="px-4 py-2.5 text-right font-medium">Qté</th>
                    <th className="px-4 py-2.5 text-right font-medium">P.U. HT</th>
                    <th className="px-4 py-2.5 text-right font-medium">Montant HT</th>
                    <th className="px-4 py-2.5 text-center font-medium">Statut</th>
                    <th className="px-4 py-2.5 text-center font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDepenses.map((d) => {
                    const id = d._id || d.id;
                    return (
                      <tr
                        key={id}
                        className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                        onClick={() => setSelectedId(id)}
                      >
                        <td className={`px-4 py-2.5 tabular-nums ${textMuted}`}>{formatDate(d.date)}</td>
                        <td className={`px-4 py-2.5 text-xs ${textMuted}`}>{d.chantierNom || "—"}</td>
                        <td className={`px-4 py-2.5 font-medium ${textPrimary}`}>{d.libelle}</td>
                        <td className={`px-4 py-2.5 ${textSecondary}`}>{d.categorie}</td>
                        <td className={`px-4 py-2.5 ${textMuted}`}>{d.fournisseurNom || d.fournisseur || "—"}</td>
                        <td className={`px-4 py-2.5 tabular-nums ${d.enRetard ? "text-red-600 font-medium" : textMuted}`}>
                          {d.dateEcheance ? formatDate(d.dateEcheance) : "—"}
                          {d.enRetard && <span className="block text-[10px]">Retard</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${textMuted}`}>
                          {d.quantite} {d.unite}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${textMuted}`}>{formatFCFAShort(d.prixUnitaire)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatFCFAShort(d.montant)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              d.paye
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            }`}
                          >
                            {d.paye ? "Soldée" : "Ouverte"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5" onClick={(ev) => ev.stopPropagation()}>
                          <div className="flex justify-center gap-1">
                            <button onClick={() => { setEditDepense(d); setShowForm(true); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(id)} className="p-1.5 rounded hover:bg-red-50 text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <BudgetDepenseForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditDepense(null);
        }}
        onSaved={refresh}
        chantierId={selectedChantier || editDepense?.chantierId}
        chantierName={selectedChantierName || editDepense?.chantierNom}
        chantiers={chantiers}
        controle={controle}
        editData={editDepense}
      />

      {selectedId && (
        <DepenseDetail
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={refresh}
          onEdit={(d) => {
            setSelectedId(null);
            setEditDepense(d);
            setShowForm(true);
          }}
        />
      )}

      <ExportReportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        chantiers={chantiers}
        selectedId={selectedChantier}
        onExportProject={exportProjectPdf}
        onExportConsolidated={exportConsolidatedPdf}
        onExportProjectExcel={exportProjectExcel}
        onExportConsolidatedExcel={exportConsolidatedExcel}
      />
    </div>
  );
}
