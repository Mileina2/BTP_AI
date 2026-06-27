import { useCallback, useEffect, useMemo, useState } from "react";

import api, { downloadFile } from "../lib/api";

import { formatFCFAShort } from "../lib/format";

import {

  pageTitle,

  pageSubtitle,

  card,

  cardInner,

  textPrimary,

  textMuted,

  textSecondary,

  kpiLabel,

  kpiValue,

  linkAccent,

  filterChipActive,

  filterChipIdle,

} from "../lib/uiClasses";

import {

  PiggyBank,

  TrendingUp,

  TrendingDown,

  AlertTriangle,

  Smartphone,

  Landmark,

  Banknote,

  Download,

  RefreshCw,

  ArrowRight,

  FileSpreadsheet,

  Clock,

  ExternalLink,

} from "lucide-react";

import {

  XAxis,

  YAxis,

  CartesianGrid,

  Tooltip,

  ResponsiveContainer,

  Legend,

  ComposedChart,

  Bar,

  Line,

} from "recharts";



const TABS = [

  { id: "synthese", label: "Synthèse" },

  { id: "flux", label: "Créances & dettes" },

  { id: "mouvements", label: "Mouvements" },

];



const CANAL_LABEL = {

  VIREMENT: "Virement",

  ESPECES: "Espèces",

  MOBILE_MONEY: "Mobile Money",

  CHEQUE: "Chèque",

  DEPENSE: "Dépense",

};



function goToPage(page, { factureId, chantierId } = {}) {

  if (factureId) sessionStorage.setItem("btpia_nav_facture", factureId);

  if (chantierId) sessionStorage.setItem("btpia_nav_chantier", chantierId);

  window.location.hash = `/${page}`;

}



function formatDate(d) {

  if (!d) return "—";

  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

}



function Kpi({ label, value, sub, tone }) {

  const c =

    tone === "green"

      ? "text-emerald-600 dark:text-emerald-400"

      : tone === "red"

        ? "text-red-600 dark:text-red-400"

        : tone === "amber"

          ? "text-amber-600 dark:text-amber-400"

          : textPrimary;

  return (

    <div className={cardInner}>

      <p className={kpiLabel}>{label}</p>

      <p className={`${kpiValue} ${c}`}>{value}</p>

      {sub && <p className={`text-xs mt-1 ${textMuted}`}>{sub}</p>}

    </div>

  );

}



function RetardBadge({ enRetard, joursRestants }) {

  if (enRetard) {

    return (

      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">

        Retard

      </span>

    );

  }

  if (joursRestants !== null && joursRestants !== undefined && joursRestants <= 7) {

    return (

      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">

        J-{joursRestants}

      </span>

    );

  }

  return null;

}



function FluxRow({ item, sens }) {
  const clickable = Boolean(item.linkPage);

  const handleClick = () => {
    if (item.linkPage === "factures" && item.factureId) goToPage("factures", { factureId: item.factureId });
    else if (item.linkPage === "budget" && item.chantierId) goToPage("budget", { chantierId: item.chantierId });
    else if (item.linkPage) goToPage(item.linkPage);
  };



  return (

    <button

      type="button"

      onClick={clickable ? handleClick : undefined}

      className={`w-full text-left flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0 ${

        clickable ? "hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group" : ""

      }`}

    >

      <div className="flex-1 min-w-0">

        <div className="flex items-center gap-2 flex-wrap">

          <span className={`text-sm font-medium ${textPrimary}`}>{item.libelle}</span>

          <RetardBadge enRetard={item.enRetard} joursRestants={item.joursRestants} />

        </div>

        <p className={`text-xs ${textMuted} truncate`}>

          {[item.client || item.fournisseur, item.chantier].filter(Boolean).join(" · ") || "—"}

        </p>

      </div>

      <div className="text-right shrink-0">

        <p className={`text-sm font-semibold ${sens === "entree" ? "text-emerald-600" : "text-red-600"}`}>

          {sens === "entree" ? "+" : "−"}

          {formatFCFAShort(item.montant)}

        </p>

        <p className={`text-[11px] ${textMuted}`}>{formatDate(item.dateEcheance || item.date)}</p>

      </div>

      {clickable && <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 shrink-0" />}

    </button>

  );

}



export default function Tresorerie() {

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("synthese");

  const [fluxFilter, setFluxFilter] = useState("tous");



  const load = useCallback(() => {

    setLoading(true);

    return api

      .get("/tresorerie/overview")

      .then((r) => setData(r.data))

      .finally(() => setLoading(false));

  }, []);



  useEffect(() => {

    load();

  }, [load]);



  const filteredCreances = useMemo(() => {

    const list = data?.creancesDetail || [];

    if (fluxFilter === "retard") return list.filter((x) => x.enRetard);

    if (fluxFilter === "30j") return list.filter((x) => x.joursRestants !== null && x.joursRestants <= 30);

    return list;

  }, [data, fluxFilter]);



  const filteredDettes = useMemo(() => {

    const list = data?.dettesDetail || [];

    if (fluxFilter === "retard") return list.filter((x) => x.enRetard);

    if (fluxFilter === "30j") return list.filter((x) => x.joursRestants !== null && x.joursRestants <= 30);

    return list;

  }, [data, fluxFilter]);



  if (loading && !data) {

    return <div className={`p-12 text-center ${textMuted}`}>Chargement trésorerie…</div>;

  }

  if (!data) return null;



  const k = data.kpis || {};

  const c = data.canaux || {};



  return (

    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

        <div>

          <h2 className={pageTitle}>Trésorerie & prévisions</h2>

          <p className={pageSubtitle}>

            Cash-flow UEMOA — Banque, Caisse, Mobile Money · {data.region}

          </p>

        </div>

        <div className="flex flex-wrap gap-2">

          <button type="button" onClick={load} className={filterChipIdle} disabled={loading}>

            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />

            Actualiser

          </button>

          <button

            type="button"

            onClick={() => downloadFile("/tresorerie/export/csv", `tresorerie_${new Date().toISOString().slice(0, 10)}.csv`)}

            className={filterChipIdle}

          >

            <FileSpreadsheet className="w-4 h-4" /> CSV

          </button>

          <button

            type="button"

            onClick={() => downloadFile("/tresorerie/export/pdf", `tresorerie_${new Date().toISOString().slice(0, 10)}.pdf`)}

            className={filterChipActive}

          >

            <Download className="w-4 h-4" /> PDF

          </button>

        </div>

      </div>



      <div className="flex flex-wrap gap-2">

        {TABS.map((t) => (

          <button

            key={t.id}

            type="button"

            onClick={() => setTab(t.id)}

            className={tab === t.id ? filterChipActive : filterChipIdle}

          >

            {t.label}

          </button>

        ))}

      </div>



      {data.alertes?.map((a, i) => (

        <div

          key={i}

          className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-2 ${

            a.type === "critical"

              ? "bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-800"

              : a.type === "warning"

                ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-amber-900"

                : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 text-blue-900"

          }`}

        >

          <div className="flex items-center gap-2">

            <AlertTriangle className="w-4 h-4 shrink-0" />

            <span>

              <strong>{a.titre}</strong> — {a.message}

            </span>

          </div>

          {a.linkPage && (

            <button type="button" onClick={() => goToPage(a.linkPage)} className={`shrink-0 ${linkAccent} text-xs flex items-center gap-1`}>

              Voir <ExternalLink className="w-3 h-3" />

            </button>

          )}

        </div>

      ))}



      {(tab === "synthese" || tab === "flux") && (

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          <Kpi

            label="Solde actuel estimé"

            value={formatFCFAShort(k.soldeActuel)}

            tone={k.soldeActuel < 0 ? "red" : "green"}

            sub={`Encaissé ${formatFCFAShort(k.encaisseTotal)} − payé ${formatFCFAShort(k.depensesPayees)}`}

          />

          <Kpi

            label="Créances clients"

            value={formatFCFAShort(k.creancesClients)}

            sub={`${k.nbCreances || 0} facture(s)${k.creancesEnRetard ? ` · ${formatFCFAShort(k.creancesEnRetard)} en retard` : ""}`}

            tone={k.creancesEnRetard > 0 ? "amber" : undefined}

          />

          <Kpi

            label="Dettes fournisseurs"

            value={formatFCFAShort(k.dettesFournisseurs)}

            sub={`${k.nbDettes || 0} échéance(s)${k.dettesEnRetard ? ` · ${formatFCFAShort(k.dettesEnRetard)} échues` : ""}`}

            tone="red"

          />

          <Kpi

            label="Position nette"

            value={formatFCFAShort(k.positionNette)}

            sub={`Masse salariale ${formatFCFAShort(k.masseSalariale)}/mois`}

            tone={k.positionNette < 0 ? "red" : "green"}

          />

        </div>

      )}



      {tab === "synthese" && (

        <>

          <div className="grid grid-cols-3 gap-3">

            <Kpi label="Horizon 30 j" value={formatFCFAShort(data.horizons?.j30)} tone={data.horizons?.j30 < 0 ? "red" : undefined} />

            <Kpi label="Horizon 60 j" value={formatFCFAShort(data.horizons?.j60)} tone={data.horizons?.j60 < 0 ? "red" : undefined} />

            <Kpi label="Horizon 90 j" value={formatFCFAShort(data.horizons?.j90)} tone={data.horizons?.j90 < 0 ? "red" : undefined} />

          </div>



          <div className={`${card} p-5`}>

            <h3 className={`font-semibold mb-4 ${textPrimary}`}>Encaissements par canal</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

              {[

                { icon: Landmark, label: "Banque / virement", val: c.banque },

                { icon: Banknote, label: "Caisse", val: c.caisse },

                { icon: Smartphone, label: "Mobile Money", val: c.mobileMoney },

                { icon: PiggyBank, label: "Autre", val: c.autre },

              ].map(({ icon: Icon, label, val }) => (

                <div key={label} className={cardInner}>

                  <Icon className="w-5 h-5 text-indigo-500 mb-1" />

                  <p className={`text-xs ${textMuted}`}>{label}</p>

                  <p className={`font-bold ${textPrimary}`}>{formatFCFAShort(val)}</p>

                </div>

              ))}

            </div>

          </div>



          <div className={`${card} p-5`}>

            <h3 className={`font-semibold mb-4 ${textPrimary}`}>Prévision 13 semaines</h3>

            <div className="h-80">

              <ResponsiveContainer width="100%" height="100%">

                <ComposedChart data={data.prevision13s || []}>

                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />

                  <XAxis dataKey="semaine" tick={{ fontSize: 10 }} />

                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />

                  <Tooltip formatter={(v) => formatFCFAShort(v)} />

                  <Legend />

                  <Bar dataKey="entrees" name="Entrées" fill="#059669" radius={[3, 3, 0, 0]} />

                  <Bar dataKey="sorties" name="Sorties" fill="#dc2626" radius={[3, 3, 0, 0]} />

                  <Line type="monotone" dataKey="solde" name="Solde cumulé" stroke="#2563eb" strokeWidth={2} dot={false} />

                </ComposedChart>

              </ResponsiveContainer>

            </div>

          </div>



          <div className="grid md:grid-cols-2 gap-4">

            <div className={`${card} p-4`}>

              <h4 className={`font-medium mb-3 flex items-center gap-2 ${textPrimary}`}>

                <TrendingUp className="w-4 h-4 text-emerald-600" /> Prochains encaissements

              </h4>

              {(data.prochainEncaissements || []).length === 0 ? (

                <p className={`text-sm ${textMuted}`}>Aucun encaissement prévu.</p>

              ) : (

                (data.prochainEncaissements || []).map((e) => (

                  <FluxRow key={e.id || e.libelle} item={e} sens="entree" />

                ))

              )}

            </div>

            <div className={`${card} p-4`}>

              <h4 className={`font-medium mb-3 flex items-center gap-2 ${textPrimary}`}>

                <TrendingDown className="w-4 h-4 text-red-600" /> Prochains décaissements

              </h4>

              {(data.prochainsDecaissements || []).length === 0 ? (

                <p className={`text-sm ${textMuted}`}>Aucun décaissement prévu.</p>

              ) : (

                (data.prochainsDecaissements || []).map((e, i) => (

                  <FluxRow key={e.id || `${e.libelle}-${i}`} item={e} sens="sortie" />

                ))

              )}

            </div>

          </div>

        </>

      )}



      {tab === "flux" && (

        <>

          <div className="flex flex-wrap gap-2">

            {[

              { id: "tous", label: "Tous" },

              { id: "retard", label: "En retard" },

              { id: "30j", label: "Sous 30 jours" },

            ].map((f) => (

              <button

                key={f.id}

                type="button"

                onClick={() => setFluxFilter(f.id)}

                className={fluxFilter === f.id ? filterChipActive : filterChipIdle}

              >

                {f.label}

              </button>

            ))}

          </div>



          <div className="grid lg:grid-cols-2 gap-4">

            <div className={`${card} p-4`}>

              <div className="flex items-center justify-between mb-3">

                <h4 className={`font-medium ${textPrimary}`}>Créances clients ({filteredCreances.length})</h4>

                <button type="button" onClick={() => goToPage("factures")} className={`text-xs ${linkAccent}`}>

                  Ouvrir factures →

                </button>

              </div>

              {filteredCreances.length === 0 ? (

                <p className={`text-sm ${textMuted}`}>Aucune créance pour ce filtre.</p>

              ) : (

                filteredCreances.map((e) => <FluxRow key={e.id} item={e} sens="entree" />)

              )}

            </div>

            <div className={`${card} p-4`}>

              <div className="flex items-center justify-between mb-3">

                <h4 className={`font-medium ${textPrimary}`}>Dettes & engagements ({filteredDettes.length})</h4>

                <button type="button" onClick={() => goToPage("budget")} className={`text-xs ${linkAccent}`}>

                  Ouvrir budget →

                </button>

              </div>

              {filteredDettes.length === 0 ? (

                <p className={`text-sm ${textMuted}`}>Aucune dette pour ce filtre.</p>

              ) : (

                filteredDettes.map((e) => <FluxRow key={e.id} item={e} sens="sortie" />)

              )}

            </div>

          </div>

        </>

      )}



      {tab === "mouvements" && (

        <div className={`${card} p-4`}>

          <h4 className={`font-medium mb-1 flex items-center gap-2 ${textPrimary}`}>

            <Clock className="w-4 h-4" /> Derniers mouvements de trésorerie

          </h4>

          <p className={`text-xs mb-4 ${textMuted}`}>Paiements clients et dépenses réglées — cliquez pour ouvrir la source.</p>

          {(data.mouvementsRecents || []).length === 0 ? (

            <p className={`text-sm ${textMuted}`}>Aucun mouvement enregistré.</p>

          ) : (

            <ul>

              {data.mouvementsRecents.map((m) => (

                <li key={`${m.sens}-${m.id}`}>

                  <button

                    type="button"

                    onClick={() => {

                      if (m.linkPage === "factures" && m.linkId) goToPage("factures", { factureId: m.linkId });

                      else if (m.linkPage === "budget" && m.linkId) goToPage("budget", { chantierId: m.linkId });

                    }}

                    className="w-full flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 group"

                  >

                    <div

                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${

                        m.sens === "entree" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"

                      }`}

                    >

                      {m.sens === "entree" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}

                    </div>

                    <div className="flex-1 min-w-0 text-left">

                      <p className={`text-sm font-medium ${textPrimary}`}>{m.libelle}</p>

                      <p className={`text-xs ${textMuted}`}>

                        {[m.tiers, CANAL_LABEL[m.canal] || m.canal, formatDate(m.date)].filter(Boolean).join(" · ")}

                      </p>

                    </div>

                    <p className={`text-sm font-semibold shrink-0 ${m.sens === "entree" ? "text-emerald-600" : "text-red-600"}`}>

                      {m.sens === "entree" ? "+" : "−"}

                      {formatFCFAShort(m.montant)}

                    </p>

                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 shrink-0" />
                  </button>
                </li>

              ))}

            </ul>

          )}

        </div>

      )}

    </div>

  );

}

