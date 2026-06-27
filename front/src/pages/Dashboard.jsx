import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import {
  Users,
  Building2,
  FileText,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Activity,
  Target,
  ArrowRight,
  Banknote,
  Receipt,
  HardHat,
  Package,
  Clock,
  ShieldCheck,
  RefreshCw,
  Landmark,
  BookOpen,
  Truck,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

import { formatMoneyShort } from "../lib/format";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const scoreColor = (n) =>
  n >= 80
    ? "text-green-600 dark:text-green-400"
    : n >= 60
      ? "text-blue-600 dark:text-blue-400"
      : n >= 40
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

const scoreBg = (n) =>
  n >= 80 ? "from-brand-yellow to-amber-500" : n >= 60 ? "from-brand-charcoal to-brand-slate" : n >= 40 ? "from-amber-500 to-orange-500" : "from-red-500 to-rose-600";

const prioriteStyle = {
  CRITIQUE: "border-red-500 bg-red-50 dark:bg-red-900/20",
  HAUTE: "border-orange-500 bg-orange-50 dark:bg-orange-900/20",
  MOYENNE: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
  BASSE: "border-gray-300 bg-gray-50 dark:bg-gray-700/30",
};

const RACCOURCIS = [
  { page: "tresorerie", label: "Trésorerie", icon: Wallet },
  { page: "factures", label: "Factures", icon: Receipt },
  { page: "budget", label: "Budget", icon: Building2 },
  { page: "fournisseurs", label: "Fournisseurs", icon: Truck },
  { page: "compta", label: "Compta", icon: BookOpen },
  { page: "conformite", label: "Conformité", icon: ShieldCheck },
];

function goTo(page) {
  window.location.hash = `/${page}`;
}

function ProgressBar({ value, max = 100, color = "bg-blue-500" }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/dashboard/summary")
      .then((res) => {
        setData(res.data);
        setError("");
      })
      .catch(() => setError("Impossible de charger le tableau de bord"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="animate-pulse text-gray-500">Chargement du pilotage...</div>
      </div>
    );
  }
  if (error) return <p className="text-red-500 p-8">{error}</p>;

  const {
    organization,
    stats,
    pipelineDevis,
    graphData,
    warnings,
    chantiersActifs,
    facturesARelancer,
    activiteTerrain,
    santeEntreprise,
    actionsPrioritaires,
    previsionTresorerie,
    pilotage,
  } = data;

  const conformite = pilotage?.conformite;
  const tresoKpis = pilotage?.tresorerie?.kpis;
  const comptaSync = pilotage?.compta;
  const fournStats = pilotage?.fournisseurs?.stats;

  const alertesPilotage = [
    ...(pilotage?.compta?.manquantes > 0
      ? [
          {
            type: "warning",
            titre: "Compta SYSCOHADA",
            message: `${pilotage.compta.manquantes} écriture(s) manquante(s) sur ${pilotage.compta.exercice}.`,
            action: () => goTo("compta"),
          },
        ]
      : []),
    ...(pilotage?.tresorerie?.alertes || []).map((a) => ({
      ...a,
      action: () => goTo(a.linkPage || "tresorerie"),
    })),
    ...(pilotage?.fournisseurs?.alertes || []).map((a) => ({
      ...a,
      action: () => goTo("fournisseurs"),
    })),
    ...(pilotage?.conformite?.alertes || []).map((a) => ({
      ...a,
      action: () => goTo("conformite"),
    })),
  ];

  const score = santeEntreprise?.score ?? 0;

  const kpis = [
    {
      label: "CA encaissé",
      value: formatMoneyShort(stats.caEncaisse),
      sub: "Factures payées",
      icon: <Banknote className="w-5 h-5" />,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
    },
    {
      label: "Impayés",
      value: formatMoneyShort(stats.caImpaye),
      sub: `${stats.facturesImpayeesCount} facture(s)`,
      icon: <Receipt className="w-5 h-5" />,
      color: stats.caImpaye > 0 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-300",
      bg: stats.caImpaye > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-50 dark:bg-gray-800",
    },
    {
      label: "Chantiers actifs",
      value: stats.chantiersActifs,
      sub: `${stats.chantiers} au total`,
      icon: <Building2 className="w-5 h-5" />,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/30",
    },
    {
      label: "Marge estimée",
      value: formatMoneyShort(stats.margeGlobale),
      sub: "Encaissements − dépenses",
      icon: <TrendingUp className="w-5 h-5" />,
      color: stats.margeGlobale >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
      bg: "bg-indigo-50 dark:bg-indigo-900/30",
    },
    {
      label: "Devis en attente",
      value: pipelineDevis?.enAttente ?? 0,
      sub: `${pipelineDevis?.acceptes ?? 0} accepté(s)`,
      icon: <FileText className="w-5 h-5" />,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/30",
    },
    {
      label: "Masse salariale",
      value: formatMoneyShort(stats.masseSalariale),
      sub: "Équipe active",
      icon: <Users className="w-5 h-5" />,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/30",
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tableau de bord</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {organization?.nom || "Mon entreprise"}
            {organization?.ville ? ` · ${organization.ville}` : ""}
          </p>
        </div>
        <div className={`px-5 py-3 rounded-xl bg-gradient-to-r ${scoreBg(score)} text-white shadow-md`}>
          <p className="text-xs opacity-90 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> Santé entreprise
          </p>
          <p className="text-3xl font-bold">{score}/100</p>
          {santeEntreprise?.details?.length > 0 && (
            <p className="text-xs opacity-80 mt-1 max-w-[200px]">
              {santeEntreprise.details[0].label}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* Raccourcis pilotage */}
      <div className="flex flex-wrap gap-2">
        {RACCOURCIS.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            type="button"
            onClick={() => goTo(page)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Icon className="w-3.5 h-3.5 text-slate-500" />
            {label}
          </button>
        ))}
      </div>

      {/* Alertes pilotage consolidées */}
      {alertesPilotage.length > 0 && (
        <div className="space-y-2">
          {alertesPilotage.slice(0, 4).map((a, i) => (
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
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  <strong>{a.titre}</strong> — {a.message}
                </span>
              </div>
              <button type="button" onClick={a.action} className="text-blue-600 hover:underline shrink-0 text-xs flex items-center gap-1">
                Voir <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pilotage financier — 4 widgets */}
      {pilotage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" /> Trésorerie
              </h3>
              <button type="button" onClick={() => goTo("tresorerie")} className="text-xs text-blue-600 hover:underline">
                Détail →
              </button>
            </div>
            {tresoKpis ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Solde actuel</span>
                  <span className={`font-bold ${tresoKpis.soldeActuel >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatMoneyShort(tresoKpis.soldeActuel)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Créances</span>
                  <span className="font-medium text-amber-600">{formatMoneyShort(tresoKpis.creancesClients)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dettes fourn.</span>
                  <span className="font-medium text-red-500">{formatMoneyShort(tresoKpis.dettesFournisseurs)}</span>
                </div>
                <div className="flex justify-between border-t dark:border-gray-700 pt-2">
                  <span className="text-gray-500">Position nette</span>
                  <span className="font-semibold">{formatMoneyShort(tresoKpis.positionNette)}</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">—</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Landmark className="w-4 h-4 text-indigo-600" /> Compta SYSCOHADA
              </h3>
              <button type="button" onClick={() => goTo("compta")} className="text-xs text-blue-600 hover:underline">
                Sync →
              </button>
            </div>
            {comptaSync ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {comptaSync.aJour ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="font-medium">
                    {comptaSync.aJour ? "Journal à jour" : `${comptaSync.manquantes} écriture(s) manquante(s)`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Exercice {comptaSync.exercice}</span>
                  <span>{comptaSync.ecrituresCount} écriture(s)</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">—</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-600" /> Fournisseurs
              </h3>
              <button type="button" onClick={() => goTo("fournisseurs")} className="text-xs text-blue-600 hover:underline">
                Voir →
              </button>
            </div>
            {fournStats ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Dette totale</span>
                  <span className="font-bold text-red-600">{formatMoneyShort(fournStats.detteTotale)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">BC en cours</span>
                  <span>{fournStats.engagementsEnCours ?? 0}</span>
                </div>
                {(fournStats.depensesEnRetard ?? 0) > 0 && (
                  <p className="text-xs text-amber-600">{fournStats.depensesEnRetard} charge(s) en retard</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">—</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> Conformité
              </h3>
              <button type="button" onClick={() => goTo("conformite")} className="text-xs text-blue-600 hover:underline">
                Voir tout
              </button>
            </div>
            {conformite ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">En retard</span>
                  <span className={`font-bold ${conformite.stats?.enRetard > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {conformite.stats?.enRetard ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sous 7 jours</span>
                  <span className="font-medium text-amber-600">{conformite.stats?.sous7j ?? 0}</span>
                </div>
                {(conformite.prochaines || []).slice(0, 2).map((e) => (
                  <p key={e.id} className="text-xs text-gray-500 truncate">
                    {formatDate(e.dateEcheance)} — {e.libelle}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">—</p>
            )}
          </div>
        </div>
      )}

      {/* KPIs financiers & opérationnels */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className={`inline-flex p-2 rounded-lg ${k.bg} ${k.color} mb-3`}>{k.icon}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Actions prioritaires */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-yellow" />
            À traiter aujourd'hui
          </h3>
          {actionsPrioritaires?.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">Rien en urgence — continuez sur vos chantiers.</p>
          ) : (
            <div className="space-y-2">
              {actionsPrioritaires.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-lg border-l-4 ${prioriteStyle[a.priorite] || prioriteStyle.MOYENNE}`}
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{a.titre}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{a.message}</p>
                    </div>
                    {a.actionUrl && (
                      <a href={a.actionUrl} className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                        {a.actionLabel} <ArrowRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trésorerie 30j */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-600" />
                Prévision 30 jours
              </h3>
              <button type="button" onClick={() => goTo("tresorerie")} className="text-sm text-blue-600 hover:underline">
                Trésorerie →
              </button>
            </div>
            {previsionTresorerie ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Encaissements prévus</span>
                  <span className="font-semibold text-green-600">
                    {formatMoneyShort(previsionTresorerie.periode30j?.encaissements)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dépenses prévues</span>
                  <span className="font-semibold text-red-500">
                    {formatMoneyShort(previsionTresorerie.periode30j?.depenses)}
                  </span>
                </div>
                <div className="border-t dark:border-gray-700 pt-3 flex justify-between">
                  <span className="text-gray-500">Solde estimé</span>
                  <span className={`font-bold text-lg ${scoreColor(previsionTresorerie.periode30j?.solde > 0 ? 80 : 30)}`}>
                    {formatMoneyShort(previsionTresorerie.periode30j?.solde)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Ajoutez des factures et dépenses pour la prévision.</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Prochaines échéances
              </h3>
              <button type="button" onClick={() => goTo("conformite")} className="text-sm text-blue-600 hover:underline">
                Conformité →
              </button>
            </div>
            {conformite?.prochaines?.length ? (
              <div className="space-y-2 text-sm">
                {conformite.prochaines.map((e) => (
                  <div
                    key={e.id || e._id}
                    className={`flex justify-between items-center p-2 rounded-lg ${
                      e.statutRaw === "EN_RETARD" ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-50 dark:bg-gray-900/30"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-medium truncate text-xs">{e.libelle}</p>
                      <p className="text-xs text-gray-500">{formatDate(e.dateEcheance)}</p>
                    </div>
                    <span
                      className={`text-[10px] shrink-0 px-2 py-0.5 rounded-full ${
                        e.statutRaw === "EN_RETARD" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {e.statutRaw === "EN_RETARD" ? "Retard" : `J-${e.joursRestants}`}
                    </span>
                  </div>
                ))}
                {(conformite.prochaines || []).length === 0 && (
                  <p className="text-gray-500 text-sm">Obligations à jour.</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Chantiers en cours — tableau opérationnel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <HardHat className="w-5 h-5 text-blue-600" />
            Chantiers en cours
          </h3>
          <a href="#/chantiers" className="text-sm text-blue-600 hover:underline">Voir tous</a>
        </div>
        {chantiersActifs?.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">Aucun chantier actif. Créez un chantier pour commencer.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="p-3">Chantier</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Avancement</th>
                  <th className="p-3">Budget</th>
                  <th className="p-3">Santé</th>
                </tr>
              </thead>
              <tbody>
                {chantiersActifs.map((c) => (
                  <tr key={c.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="p-3 font-medium">{c.nom}</td>
                    <td className="p-3 text-gray-500">{c.client}</td>
                    <td className="p-3 w-40">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={c.avancement} color="bg-blue-500" />
                        <span className="text-xs w-8">{c.avancement}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-xs">
                        <span className="font-medium">{formatMoneyShort(c.depenses)}</span>
                        <span className="text-gray-400"> / {formatMoneyShort(c.budget)}</span>
                      </div>
                      <ProgressBar
                        value={c.ratioBudget}
                        max={100}
                        color={c.ratioBudget > 100 ? "bg-red-500" : c.ratioBudget > 80 ? "bg-amber-500" : "bg-green-500"}
                      />
                    </td>
                    <td className="p-3">
                      {c.scoreSante != null ? (
                        <span className={`font-bold ${scoreColor(c.scoreSante)}`}>{c.scoreSante}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Factures à relancer */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-red-500" />
              Factures à relancer
            </h3>
            <a href="#/factures" className="text-sm text-blue-600 hover:underline">Factures</a>
          </div>
          {facturesARelancer?.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucune facture en attente de paiement.</p>
          ) : (
            <div className="space-y-2">
              {facturesARelancer.map((f) => (
                <div
                  key={f.id}
                  className={`flex justify-between items-center p-3 rounded-lg ${f.enRetard ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-50 dark:bg-gray-900/30"}`}
                >
                  <div>
                    <p className="font-medium text-sm">{f.numero} · {f.client}</p>
                    <p className="text-xs text-gray-500">{f.chantier}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatMoneyShort(f.resteDu ?? f.montantTTC)}</p>
                    {f.resteDu > 0 && f.resteDu !== f.montantTTC && (
                      <p className="text-[10px] text-gray-400">TTC {formatMoneyShort(f.montantTTC)}</p>
                    )}
                    <p className={`text-xs ${f.enRetard ? "text-red-600 font-medium" : "text-gray-400"}`}>
                      {f.enRetard ? `${f.joursRetard}j de retard` : formatDate(f.dateEcheance)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activité terrain */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" />
            Dernières remontées terrain
          </h3>
          {activiteTerrain?.length === 0 ? (
            <p className="text-gray-500 text-sm">
              Pas encore de rapport journalier.{" "}
              <a href="#/terrain" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                Créer un rapport terrain →
              </a>
            </p>
          ) : (
            <div className="space-y-3">
              {activiteTerrain.map((a) => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                    <HardHat className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium">{a.chantier}</p>
                    <p className="text-gray-600 dark:text-gray-300 text-xs">{a.detail}</p>
                    <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(a.date)} · {a.auteur}
                      {a.ouvriersPresents ? ` · ${a.ouvriersPresents} présents` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(stats.demandesMateriel > 0 || stats.stocksAlerte > 0) && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700 flex gap-4 text-xs">
              {stats.demandesMateriel > 0 && (
                <span className="text-amber-600 font-medium">
                  {stats.demandesMateriel} demande(s) matériel en attente
                </span>
              )}
              {stats.stocksAlerte > 0 && (
                <a href="#/stock" className="text-red-600 font-medium hover:underline">
                  {stats.stocksAlerte} alerte(s) stock
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Flux financier */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Flux financier mensuel
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatMoneyShort(v)} />
            <Legend />
            <Line type="monotone" dataKey="encaissements" name="Encaissements" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="depenses" name="Dépenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Alertes budget */}
      {warnings?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5" />
            Alertes budgétaires
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {warnings.map((w, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{w.chantier}</span>
                <span className="text-amber-700 dark:text-amber-300"> — {w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
