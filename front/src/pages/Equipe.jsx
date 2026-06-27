import { useEffect, useState, useMemo } from "react";
import {
  FileDown,
  FileSpreadsheet,
  BarChart3,
  Trash2,
  Edit,
  Calculator,
  UserPlus,
  UsersRound,
  HardHat,
  Clock,
  Building2,
  Search,
  X,
} from "lucide-react";
import api, { downloadFile } from "../lib/api";
import EquipeForm from "../components/EquipeForm";
import { formatMoney, formatMoneyShort } from "../lib/format";
import {
  pageTitle,
  pageSubtitle,
  card,
  cardInner,
  textPrimary,
  textMuted,
  kpiValue,
  kpiLabel,
  searchInput,
  amountDefault,
  filterChipActive,
  filterChipIdle,
  btnSecondary,
  actionBtnBlue,
  actionBtnRed,
  actionBtnAmber,
} from "../lib/uiClasses";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_COLORS = ["#0f172a", "#2563eb", "#059669", "#d97706", "#dc2626", "#6366f1"];
const STATUTS = ["Tous", "Actif", "Inactif", "Archivé"];

const statutBadge = {
  Actif: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  Inactif: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Archivé: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
};

function AnalyseMasseSalariale({ chantierId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .get(`/equipe/analyse/${chantierId}`)
      .then((res) => setData(res.data))
      .catch((e) => setErr(e.response?.data?.error || "Erreur de chargement de l'analyse"))
      .finally(() => setLoading(false));
  }, [chantierId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto text-gray-900 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900 text-white p-5 flex justify-between items-start rounded-t-2xl sticky top-0 z-10">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Analyse RH</p>
            <h2 className="text-xl font-semibold mt-1">Masse salariale — {data?.chantierNom || "Chantier"}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading && <p className={textMuted}>Chargement…</p>}
          {err && <p className="text-red-600 dark:text-red-400 text-sm">{err}</p>}
          {data && !err && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Total salaires", value: formatMoney(data.totalSalaires) },
                  { label: "Heures mensuelles", value: `${data.totalHeures?.toFixed(1)} h` },
                  { label: "Coût horaire moyen", value: formatMoney(Math.round(data.moyenneHoraire || 0)) },
                ].map((k) => (
                  <div key={k.label} className={cardInner}>
                    <p className={kpiLabel}>{k.label}</p>
                    <p className={`${kpiValue} mt-1`}>{k.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`${cardInner} p-4`}>
                  <h3 className="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">Répartition par rôle</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data.repartition}
                        dataKey="total"
                        nameKey="role"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ role, percent }) => (percent != null ? `${role} ${(percent * 100).toFixed(0)}%` : role)}
                      >
                        {data.repartition.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatMoney(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className={`${cardInner} p-4`}>
                  <h3 className="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">Salaires par rôle</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.repartition}>
                      <XAxis dataKey="role" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => formatMoney(v)} />
                      <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Equipe() {
  const [overview, setOverview] = useState(null);
  const [chantiers, setChantiers] = useState([]);
  const [analyseChantier, setAnalyseChantier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [search, setSearch] = useState("");
  const [filtreChantier, setFiltreChantier] = useState("Tous");
  const [filtreStatut, setFiltreStatut] = useState("Tous");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [ovRes, chantiersRes] = await Promise.all([
        api.get("/equipe/overview"),
        api.get("/chantier"),
      ]);
      const chantierData = Array.isArray(chantiersRes.data)
        ? chantiersRes.data
        : chantiersRes.data?.items || [];
      setOverview(ovRes.data);
      setChantiers(chantierData);
    } catch (e) {
      console.error(e);
      setErr("Impossible de charger l'équipe");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const items = overview?.items || [];
  const stats = overview?.stats || {};

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => {
      if (filtreStatut !== "Tous" && m.statut !== filtreStatut) return false;
      if (filtreChantier !== "Tous") {
        const cid = m.chantier?._id || m.chantier?.id || m.chantier;
        if (cid !== filtreChantier) return false;
      }
      if (!q) return true;
      return (
        m.nom?.toLowerCase().includes(q) ||
        m.role?.toLowerCase().includes(q) ||
        m.chantier?.nom?.toLowerCase().includes(q)
      );
    });
  }, [items, search, filtreChantier, filtreStatut]);

  const handleEdit = (m) => {
    setEditMember(m);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce membre ? La charge salariale associée sera retirée du budget.")) return;
    try {
      await api.delete(`/equipe/${id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.error || "Erreur lors de la suppression");
    }
  };

  const handleCalculSalaires = async () => {
    if (!window.confirm("Recalculer tous les salaires actifs et mettre à jour le budget ?")) return;
    try {
      await api.put("/equipe/recalcul-auto");
      load();
    } catch (e) {
      alert(e.response?.data?.error || "Erreur lors du recalcul");
    }
  };

  const chantierIdOf = (m) => m.chantier?._id || m.chantier?.id || m.chantier;

  const exportChantierId =
    filtreChantier !== "Tous"
      ? filtreChantier
      : chantiers[0]?._id || chantiers[0]?.id || "";

  const handleExportPDF = async (chantierId) => {
    if (!chantierId) return alert("Chantier requis pour l'export");
    try {
      await downloadFile(`/equipe/export/pdf/${chantierId}`, `masse_salariale_${chantierId}.pdf`);
    } catch (e) {
      alert(e.message || "Export PDF impossible");
    }
  };

  const handleExportExcel = async (chantierId) => {
    if (!chantierId) return alert("Chantier requis pour l'export");
    try {
      await downloadFile(`/equipe/export/excel/${chantierId}`, `masse_salariale_${chantierId}.xlsx`);
    } catch (e) {
      alert(e.message || "Export Excel impossible");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Équipe & masse salariale</h2>
          <p className={pageSubtitle}>
            Affectations chantier, rémunération et impact budget main-d&apos;œuvre
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 mt-3 max-w-2xl">
            Les <strong>comptes de connexion</strong> (chef de chantier, propriétaire) sont gérés dans{" "}
            <a href="#/acces" className="underline font-medium">Accès & équipe</a>
            , ou depuis la fiche <strong>Client</strong> / le détail <strong>Chantier</strong>.
            Cette page concerne la masse salariale des ouvriers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleExportPDF(exportChantierId)}
            disabled={!exportChantierId}
            className={btnSecondary}
          >
            <FileDown className="w-4 h-4" /> Export PDF
          </button>
          <button
            type="button"
            onClick={() => handleExportExcel(exportChantierId)}
            disabled={!exportChantierId}
            className={btnSecondary}
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => exportChantierId && setAnalyseChantier(exportChantierId)}
            disabled={!exportChantierId}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50"
          >
            <BarChart3 className="w-4 h-4" /> Analyse RH
          </button>
          <button
            type="button"
            onClick={handleCalculSalaires}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40"
          >
            <Calculator className="w-4 h-4" /> Recalculer salaires
          </button>
          <button
            type="button"
            onClick={() => {
              setEditMember(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Ajouter un membre
          </button>
        </div>
      </div>

      {err && (
        <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {err}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Membres actifs", value: stats.actifs ?? 0, icon: HardHat },
          { label: "Masse salariale", value: formatMoneyShort(stats.masseSalariale ?? 0), icon: UsersRound },
          { label: "Heures / mois", value: `${(stats.heuresTotales ?? 0).toFixed(0)} h`, icon: Clock },
          { label: "Chantiers couverts", value: stats.chantiersCouvert ?? 0, icon: Building2 },
        ].map((k) => (
          <div key={k.label} className={`${card} p-4`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={kpiLabel}>{k.label}</p>
                <p className={`${kpiValue} mt-1`}>{k.value}</p>
              </div>
              <k.icon className="w-5 h-5 text-slate-400 shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {(overview?.chantiers?.length ?? 0) > 0 && (
        <div className={`${card} p-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Masse salariale par chantier
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltreChantier("Tous")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtreChantier === "Tous" ? filterChipActive : filterChipIdle}`}
            >
              Tous
            </button>
            {overview.chantiers.map((c) => (
              <button
                key={c.chantierId}
                type="button"
                onClick={() => setFiltreChantier(c.chantierId)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtreChantier === c.chantierId ? filterChipActive : filterChipIdle}`}
              >
                {c.nom} · {formatMoneyShort(c.masseSalariale)} ({c.membres})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-600 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Rechercher nom, rôle, chantier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={searchInput}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFiltreStatut(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filtreStatut === s ? filterChipActive : filterChipIdle}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className={`p-8 text-center ${textMuted}`}>Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className={`p-8 text-center ${textMuted}`}>Aucun membre trouvé</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-700/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Membre</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Chantier</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">Taux / h</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">Heures</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">Salaire</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Statut</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((m) => {
                  const cid = chantierIdOf(m);
                  return (
                    <tr key={m._id || m.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <p className={`font-medium ${textPrimary}`}>{m.nom}</p>
                        <p className={`text-xs ${textMuted}`}>{m.role} · {m.typeContrat || "—"}</p>
                      </td>
                      <td className={`px-4 py-3 ${textMuted}`}>{m.chantier?.nom || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatMoneyShort(m.tauxHoraire)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${textMuted}`}>{m.heuresMensuelles?.toFixed(1)} h</td>
                      <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${amountDefault}`}>
                        {formatMoneyShort(m.salaireTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statutBadge[m.statut] || statutBadge.Inactif}`}>
                          {m.statut}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <button type="button" onClick={() => handleEdit(m)} className={actionBtnBlue} title="Modifier">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDelete(m._id || m.id)} className={actionBtnRed} title="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {cid && (
                            <button
                              type="button"
                              onClick={() => setAnalyseChantier(cid)}
                              className={actionBtnAmber}
                              title="Analyse chantier"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      <EquipeForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditMember(null);
        }}
        onSaved={load}
        editData={editMember}
        chantiers={chantiers}
      />

      {analyseChantier && (
        <AnalyseMasseSalariale chantierId={analyseChantier} onClose={() => setAnalyseChantier(null)} />
      )}
    </div>
  );
}
