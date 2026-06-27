import { useEffect, useState, useMemo } from "react";
import api, { downloadFile } from "../lib/api";
import { formatFCFAShort } from "../lib/format";
import {
  pageTitle,
  pageSubtitle,
  card,
  cardInner,
  textPrimary,
  textSecondary,
  textMuted,
  kpiLabel,
  kpiValue,
  linkAccent,
  filterChipActive,
  filterChipIdle,
} from "../lib/uiClasses";
import {
  Landmark,
  TrendingUp,
  Banknote,
  Receipt,
  Wallet,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  PieChart as PieIcon,
  BarChart3,
  Download,
  Users,
  FileText,
  BookOpen,
  Scale,
  List,
  RefreshCw,
  CheckCircle2,
  XCircle,
  PiggyBank,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = ["#0f172a", "#2563eb", "#059669", "#d97706", "#dc2626", "#6366f1"];

const TABS = [
  { id: "overview", label: "Vue d'ensemble", icon: Landmark },
  { id: "sync", label: "Synchronisation", icon: RefreshCw },
  { id: "journal", label: "Journal SYSCOHADA", icon: BookOpen },
  { id: "balance", label: "Balance", icon: Scale },
  { id: "plan", label: "Plan comptable", icon: List },
  { id: "recettes", label: "Recettes", icon: Receipt },
  { id: "charges", label: "Charges", icon: Wallet },
  { id: "exports", label: "Exports", icon: FileSpreadsheet },
];

function goTo(page) {
  window.location.hash = `/${page}`;
}

const SOURCE_TYPE_LABELS = {
  facture: "Facture vente (VT)",
  paiement: "Encaissement (BQ/CA/MM)",
  depense: "Charge chantier (AC)",
  avoir: "Avoir client (VT)",
};

function formatDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function KpiCard({ label, value, sub, tone = "default", icon: Icon }) {
  const toneClass =
    tone === "green"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "red"
        ? "text-red-600 dark:text-red-400"
        : tone === "amber"
          ? "text-amber-600 dark:text-amber-400"
          : textPrimary;
  return (
    <div className={cardInner}>
      <div className="flex items-start justify-between gap-2">
        <p className={kpiLabel}>{label}</p>
        {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
      </div>
      <p className={`${kpiValue} ${toneClass}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${textMuted}`}>{sub}</p>}
    </div>
  );
}

export default function Compta() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [year, setYear] = useState(new Date().getFullYear());
  const [journalItems, setJournalItems] = useState([]);
  const [balance, setBalance] = useState(null);
  const [planComptes, setPlanComptes] = useState([]);
  const [journalFilter, setJournalFilter] = useState("TOUS");
  const [grandLivre, setGrandLivre] = useState(null);
  const [selectedCompte, setSelectedCompte] = useState("411000");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/compta/overview?year=${year}`);
      setData(res.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Impossible de charger la comptabilité");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [year]);

  const loadSyscohada = async () => {
    try {
      const [planRes, balanceRes, journalRes] = await Promise.all([
        api.get("/compta/plan"),
        api.get(`/compta/balance?year=${year}`),
        api.get(`/compta/journal?year=${year}${journalFilter !== "TOUS" ? `&journal=${journalFilter}` : ""}`),
      ]);
      setPlanComptes(planRes.data.comptes || []);
      setBalance(balanceRes.data);
      setJournalItems(journalRes.data.items || []);
    } catch {
      /* plan auto-init on first sync */
    }
  };

  useEffect(() => {
    if (["journal", "balance", "plan", "exports"].includes(tab)) {
      loadSyscohada();
    }
  }, [tab, year, journalFilter]);

  const loadGrandLivre = async (compteNumero) => {
    try {
      const res = await api.get(`/compta/grand-livre?year=${year}&compteNumero=${compteNumero}`);
      setGrandLivre(res.data);
      setSelectedCompte(compteNumero);
    } catch (err) {
      alert(err.response?.data?.error || "Grand livre indisponible");
    }
  };

  const handleSyncSyscohada = async () => {
    setSyncLoading(true);
    setSyncMsg("");
    try {
      const res = await api.post("/compta/sync", { year });
      const created =
        (res.data.factures || 0) +
        (res.data.paiements || 0) +
        (res.data.depenses || 0) +
        (res.data.avoirs || 0);
      const restantes = res.data.syncStatus?.manquantes?.total ?? 0;
      setSyncMsg(
        `${res.data.message} ${created} nouvelle(s) écriture(s) — ${res.data.factures || 0} facture(s), ${res.data.paiements || 0} encaissement(s), ${res.data.depenses || 0} charge(s), ${res.data.avoirs || 0} avoir(s).` +
          (restantes > 0 ? ` Il reste ${restantes} opération(s) à synchroniser.` : " Journal à jour pour cet exercice.")
      );
      await loadSyscohada();
      await load();
    } catch (err) {
      setSyncMsg(err.response?.data?.error || "Synchronisation impossible");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleAlertAction = (a) => {
    if (a.tab) setTab(a.tab);
    else if (a.action && a.action !== "compta") goTo(a.action);
    else setTab("sync");
  };

  const kpis = data?.kpis || {};
  const syncStatus = data?.syncStatus;
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2];
  }, []);

  const handleExportFactures = () =>
    downloadFile("/facture/export/comptable", `export_factures_${year}.csv`);

  const handleExportJournal = () =>
    downloadFile(`/compta/export/journal?year=${year}`, `journal_comptable_${year}.csv`);

  const handleExportBalance = () =>
    downloadFile(`/compta/export/balance?year=${year}`, `balance_syscohada_${year}.csv`);

  const handleExportGrandLivre = () =>
    downloadFile(
      `/compta/export/grand-livre?year=${year}&compteNumero=${selectedCompte}`,
      `grand_livre_${selectedCompte}_${year}.csv`
    );

  if (loading && !data) {
    return <div className={`p-12 text-center ${textMuted}`}>Chargement de la comptabilité…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Compta & Finance</h2>
          <p className={pageSubtitle}>
            SYSCOHADA · OHADA · UEMOA (XOF) — Trésorerie, journal, balance — {data?.periode?.label || year}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Exercice {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
          <button
            type="button"
            onClick={handleSyncSyscohada}
            disabled={syncLoading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${syncLoading ? "animate-spin" : ""}`} />
            {syncLoading ? "Sync…" : "Sync SYSCOHADA"}
          </button>
          <button
            type="button"
            onClick={() => goTo("tresorerie")}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
          >
            <PiggyBank className="w-4 h-4" /> Trésorerie
          </button>
          <button
            type="button"
            onClick={() => goTo("factures")}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Factures →
          </button>
          <button
            type="button"
            onClick={() => goTo("budget")}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Budget chantiers →
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={tab === id ? filterChipActive : filterChipIdle}
          >
            <Icon className="w-3.5 h-3.5 inline mr-1.5" />
            {label}
          </button>
        ))}
      </div>

      {syncStatus && (
        <div
          className={`rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm ${
            syncStatus.aJour
              ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
              : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {syncStatus.aJour ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <span>
              <strong>
                {syncStatus.aJour
                  ? `Journal SYSCOHADA à jour — exercice ${year}`
                  : `${syncStatus.manquantes?.total || 0} écriture(s) manquante(s) sur ${year}`}
              </strong>
              {" · "}
              {syncStatus.ecrituresCount} écriture(s) en base
              {syncStatus.derniereSync && ` · dernière sync ${formatDateTime(syncStatus.derniereSync)}`}
            </span>
          </div>
          <div className="flex gap-2">
            {!syncStatus.aJour && (
              <button type="button" onClick={() => setTab("sync")} className={`text-xs ${linkAccent}`}>
                Détail manquantes →
              </button>
            )}
            {!syncStatus.aJour && (
              <button
                type="button"
                onClick={handleSyncSyscohada}
                disabled={syncLoading}
                className="text-xs px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Synchroniser
              </button>
            )}
          </div>
        </div>
      )}

      {syncMsg && (
        <p
          className={`text-sm px-4 py-2 rounded-lg ${
            syncMsg.includes("impossible") || syncMsg.includes("erreur")
              ? "text-red-700 bg-red-50 dark:bg-red-900/20"
              : "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20"
          }`}
        >
          {syncMsg}
        </p>
      )}

      {data?.alertes?.length > 0 && (
        <div className="space-y-2">
          {data.alertes.map((a, i) => (
            <div
              key={i}
              className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
                a.type === "critical"
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  : a.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                    : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>{a.titre}</strong> — {a.message}
                </span>
              </div>
              <button type="button" onClick={() => handleAlertAction(a)} className={linkAccent}>
                Voir <ArrowRight className="w-3 h-3 inline" />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Écritures SYSCOHADA"
              value={kpis.ecrituresAnnee ?? syncStatus?.ecrituresCount ?? 0}
              sub={
                (kpis.syncManquantes ?? syncStatus?.manquantes?.total ?? 0) > 0
                  ? `${kpis.syncManquantes ?? syncStatus?.manquantes?.total} manquante(s)`
                  : "Journal synchronisé"
              }
              tone={(kpis.syncManquantes ?? 0) > 0 ? "amber" : "green"}
              icon={BookOpen}
            />
            <KpiCard
              label="CA facturé"
              value={formatFCFAShort(kpis.caFacture)}
              sub={`${kpis.facturesAnnee || 0} facture(s) en ${year}`}
              icon={Receipt}
            />
            <KpiCard
              label="Encaissé"
              value={formatFCFAShort(kpis.caEncaisse)}
              sub={`Recettes ${year} : ${formatFCFAShort(kpis.recettesAnnee)}`}
              tone="green"
              icon={Banknote}
            />
            <KpiCard
              label="Créances (impayé)"
              value={formatFCFAShort(kpis.impaye)}
              sub={kpis.avoirs ? `Avoirs : ${formatFCFAShort(kpis.avoirs)}` : undefined}
              tone={kpis.impaye > 0 ? "amber" : "default"}
              icon={TrendingUp}
            />
            <KpiCard
              label="Trésorerie estimée"
              value={formatFCFAShort(kpis.tresorerieEstimee)}
              sub="Encaissements − charges payées"
              tone={kpis.tresorerieEstimee < 0 ? "red" : "green"}
              icon={Landmark}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Charges totales" value={formatFCFAShort(kpis.chargesTotal)} icon={Wallet} />
            <KpiCard
              label={`Charges ${year}`}
              value={formatFCFAShort(kpis.chargesAnnee)}
              sub={`${kpis.depensesAnnee || 0} ligne(s)`}
            />
            <KpiCard
              label="Charges à payer"
              value={formatFCFAShort(kpis.chargesAPayer)}
              tone={kpis.chargesAPayer > 0 ? "amber" : "default"}
            />
            <KpiCard
              label="Masse salariale / mois"
              value={formatFCFAShort(kpis.masseSalariale)}
              sub={`Résultat op. : ${formatFCFAShort(kpis.resultatOperationnel)}`}
              icon={Users}
            />
          </div>

          <div className={`${card} p-5`}>
            <h3 className={`font-semibold mb-4 flex items-center gap-2 ${textPrimary}`}>
              <BarChart3 className="w-5 h-5" /> Flux mensuel {year}
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.cashflowChart || []}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => formatFCFAShort(v)} />
                  <Legend />
                  <Bar dataKey="recettes" name="Recettes" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="charges" name="Charges" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className={`${card} p-5`}>
              <h3 className={`font-semibold mb-3 flex items-center gap-2 ${textPrimary}`}>
                <PieIcon className="w-5 h-5" /> Répartition des charges
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.repartitionCharges || []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {(data?.repartitionCharges || []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatFCFAShort(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${card} p-5`}>
              <h3 className={`font-semibold mb-3 flex items-center gap-2 ${textPrimary}`}>
                <FileText className="w-5 h-5" /> Pipeline devis
              </h3>
              <p className={`text-2xl font-bold ${textPrimary}`}>{formatFCFAShort(kpis.devisPipeline)}</p>
              <p className={`text-sm ${textMuted} mb-4`}>Devis acceptés / envoyés non encore totalement facturés</p>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {(data?.devisPipeline || []).map((d) => (
                  <li key={d.id || d._id} className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className={textSecondary}>{d.numero}</span>
                    <span className={textMuted}>{formatFCFAShort(d.montantTTC)}</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => goTo("devis")} className={`mt-3 text-sm ${linkAccent}`}>
                Voir les devis →
              </button>
            </div>
          </div>
        </>
      )}

      {tab === "sync" && syncStatus && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Écritures en base"
              value={syncStatus.ecrituresCount}
              sub={`Exercice ${year}`}
              icon={BookOpen}
            />
            <KpiCard
              label="Sources attendues"
              value={syncStatus.sourcesAttendues}
              sub="Factures + encaissements + charges + avoirs"
            />
            <KpiCard
              label="Manquantes"
              value={syncStatus.manquantes?.total ?? 0}
              tone={(syncStatus.manquantes?.total ?? 0) > 0 ? "amber" : "green"}
              sub={
                syncStatus.aJour
                  ? "Tout est passé en comptabilité"
                  : `${syncStatus.manquantes?.factures ?? 0} VT · ${syncStatus.manquantes?.paiements ?? 0} trés. · ${syncStatus.manquantes?.depenses ?? 0} AC`
              }
              icon={AlertTriangle}
            />
            <KpiCard
              label="Dernière écriture"
              value={syncStatus.derniereSync ? formatDate(syncStatus.derniereSync) : "—"}
              sub={syncStatus.planInitialise ? "Plan OHADA actif" : "Plan non initialisé"}
              tone={syncStatus.planInitialise ? "default" : "amber"}
            />
          </div>

          <div className={`${card} p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className={`font-semibold ${textPrimary}`}>Passerelle opérationnelle → SYSCOHADA</h3>
                <p className={`text-sm ${textMuted} mt-1`}>
                  Génère automatiquement les écritures depuis les factures (411/706/443), encaissements (521/572/531),
                  charges chantier (6xx/401 ou 521) et avoirs clients.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncSyscohada}
                disabled={syncLoading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${syncLoading ? "animate-spin" : ""}`} />
                {syncLoading ? "Synchronisation…" : `Sync exercice ${year}`}
              </button>
            </div>

            <div className="grid md:grid-cols-4 gap-3 text-sm">
              {[
                { key: "factures", label: "Factures vente", synced: syncStatus.synced?.factures, miss: syncStatus.manquantes?.factures },
                { key: "paiements", label: "Encaissements", synced: syncStatus.synced?.paiements, miss: syncStatus.manquantes?.paiements },
                { key: "depenses", label: "Charges", synced: syncStatus.synced?.depenses, miss: syncStatus.manquantes?.depenses },
                { key: "avoirs", label: "Avoirs", synced: syncStatus.synced?.avoirs, miss: syncStatus.manquantes?.avoirs },
              ].map((row) => (
                <div key={row.key} className={cardInner}>
                  <p className={kpiLabel}>{row.label}</p>
                  <p className={`${kpiValue} text-emerald-600`}>{row.synced ?? 0}</p>
                  <p className={`text-xs ${textMuted}`}>{row.miss ?? 0} manquante(s)</p>
                </div>
              ))}
            </div>
          </div>

          {(syncStatus.items?.length ?? 0) > 0 ? (
            <div className={`${card} overflow-hidden`}>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className={`font-semibold ${textPrimary}`}>Opérations sans écriture comptable</h3>
                <span className={`text-xs ${textMuted}`}>{syncStatus.items.length} affichée(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    <tr>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Libellé</th>
                      <th className="p-3 text-left">Détail</th>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-right">Montant</th>
                      <th className="p-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncStatus.items.map((item) => (
                      <tr key={item.sourceKey} className="border-t border-gray-100 dark:border-gray-700">
                        <td className={`p-3 ${textMuted} text-xs`}>{SOURCE_TYPE_LABELS[item.type] || item.type}</td>
                        <td className={`p-3 font-medium ${textSecondary}`}>{item.label}</td>
                        <td className={`p-3 ${textMuted}`}>{item.detail}</td>
                        <td className={`p-3 ${textMuted}`}>{formatDate(item.date)}</td>
                        <td className={`p-3 text-right ${textPrimary}`}>{formatFCFAShort(item.montant)}</td>
                        <td className="p-3">
                          <button type="button" onClick={() => goTo(item.action)} className={`text-xs ${linkAccent}`}>
                            Ouvrir →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className={`${card} p-8 text-center`}>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className={`font-semibold ${textPrimary}`}>Journal synchronisé pour {year}</p>
              <p className={`text-sm ${textMuted} mt-1`}>
                Toutes les opérations sources ont une écriture SYSCOHADA correspondante.
              </p>
              <button type="button" onClick={() => setTab("journal")} className={`mt-4 text-sm ${linkAccent}`}>
                Consulter le journal →
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "journal" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`text-sm ${textMuted}`}>Journal :</span>
            {["TOUS", "VT", "AC", "BQ", "CA", "MM", "OD"].map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJournalFilter(j)}
                className={journalFilter === j ? filterChipActive : filterChipIdle}
              >
                {j === "TOUS" ? "Tous" : j}
              </button>
            ))}
          </div>
          {journalItems.length === 0 ? (
            <p className={`p-8 text-center ${textMuted} ${card}`}>
              Aucune écriture — cliquez « Sync SYSCOHADA » pour générer les écritures depuis factures et charges.
            </p>
          ) : (
            journalItems.map((e) => (
              <div key={e.id} className={`${card} p-4`}>
                <div className="flex flex-wrap gap-2 text-xs mb-2">
                  <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{e.numero}</span>
                  <span className={textMuted}>{formatDate(e.dateEcriture)} · {e.journalLabel}</span>
                  {e.reference && <span className={textMuted}>Ref. {e.reference}</span>}
                </div>
                <p className={`text-sm font-medium ${textSecondary} mb-2`}>{e.libelle}</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className={textMuted}>
                      <th className="text-left pb-1">Compte</th>
                      <th className="text-right pb-1">Débit</th>
                      <th className="text-right pb-1">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.lignes.map((l) => (
                      <tr key={l.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-1">
                          <span className="font-mono">{l.compteNumero}</span> — {l.compteLibelle}
                        </td>
                        <td className="text-right">{l.debit > 0 ? formatFCFAShort(l.debit) : "—"}</td>
                        <td className="text-right">{l.credit > 0 ? formatFCFAShort(l.credit) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "balance" && (
        <div className="space-y-4">
          {balance && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total débits" value={formatFCFAShort(balance.totaux?.debit)} />
                <KpiCard label="Total crédits" value={formatFCFAShort(balance.totaux?.credit)} />
                <KpiCard
                  label="Résultat net"
                  value={formatFCFAShort(balance.resultat?.net)}
                  tone={balance.resultat?.net >= 0 ? "green" : "red"}
                />
                <KpiCard
                  label="Équilibre"
                  value={balance.totaux?.equilibre ? "OK" : "Écart"}
                  tone={balance.totaux?.equilibre ? "green" : "red"}
                  sub={balance.norme}
                />
              </div>
              <div className={`${card} overflow-hidden`}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="p-2 text-left">Compte</th>
                      <th className="p-2 text-left">Libellé</th>
                      <th className="p-2 text-right">Débit</th>
                      <th className="p-2 text-right">Crédit</th>
                      <th className="p-2 text-right">Solde D</th>
                      <th className="p-2 text-right">Solde C</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(balance.rows || []).map((r) => (
                      <tr
                        key={r.compteId}
                        className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                        onClick={() => loadGrandLivre(r.numero)}
                      >
                        <td className="p-2 font-mono text-xs">{r.numero}</td>
                        <td className={`p-2 ${textSecondary}`}>{r.libelle}</td>
                        <td className="p-2 text-right">{formatFCFAShort(r.totalDebit)}</td>
                        <td className="p-2 text-right">{formatFCFAShort(r.totalCredit)}</td>
                        <td className="p-2 text-right">{r.soldeDebiteur ? formatFCFAShort(r.soldeDebiteur) : "—"}</td>
                        <td className="p-2 text-right">{r.soldeCrediteur ? formatFCFAShort(r.soldeCrediteur) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {grandLivre && (
                <div className={`${card} p-4`}>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className={`font-semibold ${textPrimary}`}>
                      Grand livre — {grandLivre.compte.numero} {grandLivre.compte.libelle}
                    </h4>
                    <button type="button" onClick={handleExportGrandLivre} className={`text-sm ${linkAccent}`}>
                      Export CSV
                    </button>
                  </div>
                  <p className={`text-sm mb-3 ${textMuted}`}>
                    Solde final : <strong>{formatFCFAShort(grandLivre.soldeFinal)}</strong>
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className={textMuted}>
                        <th className="text-left p-1">Date</th>
                        <th className="text-left p-1">Écriture</th>
                        <th className="text-left p-1">Libellé</th>
                        <th className="text-right p-1">Débit</th>
                        <th className="text-right p-1">Crédit</th>
                        <th className="text-right p-1">Solde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grandLivre.mouvements.map((m, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="p-1">{formatDate(m.date)}</td>
                          <td className="p-1 font-mono">{m.ecritureNumero}</td>
                          <td className="p-1">{m.libelle}</td>
                          <td className="p-1 text-right">{m.debit ? formatFCFAShort(m.debit) : "—"}</td>
                          <td className="p-1 text-right">{m.credit ? formatFCFAShort(m.credit) : "—"}</td>
                          <td className="p-1 text-right font-medium">{formatFCFAShort(m.solde)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "plan" && (
        <div className={`${card} p-5`}>
          <p className={`text-sm ${textMuted} mb-4`}>
            Plan comptable SYSCOHADA révisé — PME BTP Afrique francophone (OHADA). Compte 572 Mobile Money inclus pour
            Orange Money, MTN, Wave…
          </p>
          {[1, 2, 3, 4, 5, 6, 7].map((classe) => {
            const items = planComptes.filter((c) => c.classe === classe);
            if (!items.length) return null;
            const labels = {
              1: "Capitaux",
              2: "Immobilisations",
              3: "Stocks",
              4: "Tiers",
              5: "Trésorerie",
              6: "Charges",
              7: "Produits",
            };
            return (
              <div key={classe} className="mb-6">
                <h4 className={`font-semibold text-sm mb-2 ${textPrimary}`}>
                  Classe {classe} — {labels[classe]}
                </h4>
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((c) => (
                      <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="p-2 font-mono text-xs w-24">{c.numero}</td>
                        <td className={`p-2 ${textSecondary}`}>{c.libelle}</td>
                        <td className={`p-2 text-xs ${textMuted}`}>{c.typeCompte}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {tab === "recettes" && (
        <div className={`${card} overflow-hidden`}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className={`font-semibold ${textPrimary}`}>Dernières factures</h3>
            <button type="button" onClick={() => goTo("factures")} className={`text-sm ${linkAccent}`}>
              Toutes les factures →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                <tr>
                  <th className="p-3 text-left">N°</th>
                  <th className="p-3 text-left">Client</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-right">TTC</th>
                  <th className="p-3 text-right">Encaissé</th>
                  <th className="p-3 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recettesRecentes || []).map((f) => (
                  <tr key={f.id || f._id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className={`p-3 font-mono text-xs ${textMuted}`}>{f.numero}</td>
                    <td className={`p-3 ${textSecondary}`}>{f.client}</td>
                    <td className={`p-3 ${textMuted}`}>{formatDate(f.dateEmission || f.date)}</td>
                    <td className={`p-3 text-right font-medium ${textPrimary}`}>{formatFCFAShort(f.montantTTC || f.montant)}</td>
                    <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">
                      {formatFCFAShort(f.montantVerse || 0)}
                    </td>
                    <td className={`p-3 ${textMuted}`}>{f.statut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "charges" && (
        <div className={`${card} overflow-hidden`}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className={`font-semibold ${textPrimary}`}>Dernières charges chantier</h3>
            <button type="button" onClick={() => goTo("budget")} className={`text-sm ${linkAccent}`}>
              Journal budget →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                <tr>
                  <th className="p-3 text-left">Libellé</th>
                  <th className="p-3 text-left">Chantier</th>
                  <th className="p-3 text-left">Catégorie</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3 text-left">Payée</th>
                </tr>
              </thead>
              <tbody>
                {(data?.chargesRecentes || []).map((d) => (
                  <tr key={d.id || d._id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className={`p-3 ${textSecondary}`}>{d.libelle}</td>
                    <td className={`p-3 ${textMuted}`}>{d.chantierNom || d.chantier}</td>
                    <td className={`p-3 ${textMuted}`}>{d.categorie || "Autre"}</td>
                    <td className={`p-3 ${textMuted}`}>{formatDate(d.date)}</td>
                    <td className={`p-3 text-right font-medium ${textPrimary}`}>{formatFCFAShort(d.montant)}</td>
                    <td className="p-3">
                      {d.paye ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Oui</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Non</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`p-4 border-t border-gray-200 dark:border-gray-700 ${cardInner}`}>
            <p className={`text-sm ${textSecondary}`}>
              Masse salariale mensuelle estimée :{" "}
              <strong>{formatFCFAShort(kpis.masseSalariale)}</strong>
            </p>
            <button type="button" onClick={() => goTo("equipe")} className={`mt-2 text-sm ${linkAccent}`}>
              Gérer l'équipe →
            </button>
          </div>
        </div>
      )}

      {tab === "exports" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className={`${card} p-6 space-y-4`}>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <Receipt className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className={`font-semibold ${textPrimary}`}>Export factures</h3>
                <p className={`text-sm ${textMuted}`}>CSV comptable : HT, TVA, TTC, encaissé, reste dû, RCCM</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportFactures}
              className="flex items-center gap-2 w-full justify-center px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Télécharger export factures
            </button>
          </div>

          <div className={`${card} p-6 space-y-4`}>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <FileSpreadsheet className="w-6 h-6 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <h3 className={`font-semibold ${textPrimary}`}>Journal comptable {year}</h3>
                <p className={`text-sm ${textMuted}`}>Factures (crédit) + charges chantier (débit) sur l'exercice</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportJournal}
              className="flex items-center gap-2 w-full justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Télécharger journal {year}
            </button>
          </div>

          <div className={`${card} p-6 space-y-4`}>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                <Scale className="w-6 h-6 text-indigo-700 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className={`font-semibold ${textPrimary}`}>Balance SYSCOHADA {year}</h3>
                <p className={`text-sm ${textMuted}`}>Balance générale OHADA — débits, crédits, soldes par compte</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportBalance}
              className="flex items-center gap-2 w-full justify-center px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Télécharger balance {year}
            </button>
          </div>

          <div className={`${card} p-6 md:col-span-2`}>
            <h3 className={`font-semibold mb-2 ${textPrimary}`}>Raccourcis</h3>
            <div className="flex flex-wrap gap-3">
              {[
                { page: "factures", label: "Factures & encaissements" },
                { page: "budget", label: "Budget & dépenses chantier" },
                { page: "devis", label: "Devis & pipeline" },
                { page: "equipe", label: "Masse salariale" },
                { page: "entreprise", label: "Infos légales (RCCM, CC…)" },
              ].map(({ page, label }) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => goTo(page)}
                  className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
