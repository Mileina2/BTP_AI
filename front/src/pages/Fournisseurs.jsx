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
  kpiLabel,
  kpiValue,
  linkAccent,
  filterChipActive,
  filterChipIdle,
} from "../lib/uiClasses";
import {
  Truck,
  Plus,
  GitCompare,
  CheckCircle,
  RefreshCw,
  FileSpreadsheet,
  ArrowRight,
  AlertTriangle,
  Wallet,
} from "lucide-react";

const TABS = [
  { id: "synthese", label: "Synthèse" },
  { id: "dettes", label: "Dettes & BC" },
  { id: "annuaire", label: "Annuaire" },
];

const STATUT_COLORS = {
  DEVIS: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  COMMANDE: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  LIVRE: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  PAYE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

function goToBudget(chantierId) {
  if (chantierId) sessionStorage.setItem("btpia_nav_chantier", chantierId);
  window.location.hash = "/budget";
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
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

export default function Fournisseurs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("synthese");
  const [filtre, setFiltre] = useState("tous");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showEngagement, setShowEngagement] = useState(false);
  const [chantiers, setChantiers] = useState([]);
  const [compare, setCompare] = useState([]);
  const [form, setForm] = useState({ nom: "", telephone: "", categorie: "Sous-traitance", rccm: "" });
  const [engForm, setEngForm] = useState({
    fournisseurId: "",
    chantierId: "",
    objet: "",
    montant: "",
    statut: "DEVIS",
    dateEcheance: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    return api
      .get("/fournisseur/overview")
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api.get("/chantier").then((r) => setChantiers(r.data.items || r.data || []));
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    await api.post("/fournisseur", form);
    setShowForm(false);
    setForm({ nom: "", telephone: "", categorie: "Sous-traitance", rccm: "" });
    load();
  };

  const handleEngagement = async (e) => {
    e.preventDefault();
    await api.post("/fournisseur/engagements", {
      ...engForm,
      montant: Number(engForm.montant),
      chantierId: engForm.chantierId || undefined,
    });
    setShowEngagement(false);
    load();
  };

  const handleCompare = async () => {
    const res = await api.get("/fournisseur/compare");
    setCompare(res.data || []);
    setTab("synthese");
  };

  const updateEngagement = async (id, statut) => {
    await api.put(`/fournisseur/engagements/${id}`, { statut });
    load();
  };

  const linkDepense = async (depenseId, fournisseurId) => {
    if (!fournisseurId) return;
    await api.put(`/fournisseur/depenses/${depenseId}/link`, { fournisseurId });
    load();
  };

  const markDepensePayee = async (id) => {
    await api.put(`/fournisseur/depenses/${id}/paye`);
    load();
  };

  const filteredEngagements = useMemo(() => {
    let list = (data?.engagements || []).filter((e) => !["PAYE", "ANNULE"].includes(e.statutRaw));
    if (filtre === "retard") list = list.filter((e) => e.enRetard);
    if (filtre === "devis") list = list.filter((e) => e.statutRaw === "DEVIS");
    return list;
  }, [data, filtre]);

  const filteredDepenses = useMemo(() => {
    let list = data?.depensesImpayees || [];
    if (filtre === "retard") list = list.filter((d) => d.enRetard);
    if (filtre === "orphelines") list = list.filter((d) => d.orpheline);
    return list;
  }, [data, filtre]);

  const filteredFournisseurs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.fournisseurs || [];
    return (data?.fournisseurs || []).filter(
      (f) => f.nom?.toLowerCase().includes(q) || f.categorie?.toLowerCase().includes(q)
    );
  }, [data, search]);

  if (loading && !data) {
    return <div className={`p-12 text-center ${textMuted}`}>Chargement fournisseurs…</div>;
  }

  const s = data?.stats || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Sous-traitants & fournisseurs</h2>
          <p className={pageSubtitle}>Devis, bons de commande, dettes budget — compte SYSCOHADA 401</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className={filterChipIdle} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
          <button
            type="button"
            onClick={() => downloadFile("/fournisseur/export/csv", `fournisseurs_${new Date().toISOString().slice(0, 10)}.csv`)}
            className={filterChipIdle}
          >
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </button>
          <button type="button" onClick={handleCompare} className={filterChipIdle}>
            <GitCompare className="w-4 h-4" /> Comparer devis
          </button>
          <button type="button" onClick={() => setShowEngagement(true)} className={filterChipIdle}>
            <Plus className="w-4 h-4" /> BC / Devis
          </button>
          <button type="button" onClick={() => setShowForm(true)} className={filterChipActive}>
            <Plus className="w-4 h-4" /> Fournisseur
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={tab === t.id ? filterChipActive : filterChipIdle}>
            {t.label}
          </button>
        ))}
      </div>

      {data?.alertes?.map((a, i) => (
        <div
          key={i}
          className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
            a.type === "warning"
              ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-amber-900"
              : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 text-blue-900"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{a.titre}</strong> — {a.message}
          </span>
        </div>
      ))}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Fournisseurs actifs", value: s.totalFournisseurs },
          { label: "Engagements en cours", value: s.engagementsEnCours },
          { label: "Dette BC / devis", value: formatFCFAShort(s.detteEngagements) },
          { label: "Dette budget", value: formatFCFAShort(s.detteDepenses), tone: "red" },
          { label: "Dette totale", value: formatFCFAShort(s.detteTotale), tone: "red" },
        ].map((k) => (
          <div key={k.label} className={cardInner}>
            <p className={kpiLabel}>{k.label}</p>
            <p className={`${kpiValue} ${k.tone === "red" ? "text-red-600" : textPrimary}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {tab === "synthese" && compare.length > 0 && (
        <div className={`${card} p-4`}>
          <h4 className={`font-semibold mb-3 ${textPrimary}`}>Comparaison devis — moins-disant</h4>
          {compare.map((g, i) => (
            <div key={i} className="mb-4 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <p className={`text-sm font-medium mb-2 ${textPrimary}`}>{g.offres?.[0]?.numero ? g.objet : g.objet}</p>
              {g.offres?.map((o, idx) => (
                <div
                  key={o.id}
                  className={`flex justify-between text-sm py-1 px-2 rounded ${idx === 0 ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}`}
                >
                  <span>
                    {idx === 0 && <span className="text-xs text-emerald-600 mr-1">✓</span>}
                    {o.fournisseur} <span className="text-xs text-gray-400">({o.numero})</span>
                  </span>
                  <span className="font-medium">{formatFCFAShort(o.montantTTC)}</span>
                </div>
              ))}
              {g.ecart > 0 && (
                <p className={`text-xs mt-1 ${textMuted}`}>Écart max : {formatFCFAShort(g.ecart)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "synthese" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className={`${card} p-4`}>
            <div className="flex justify-between items-center mb-3">
              <h4 className={`font-medium ${textPrimary}`}>Dépenses budget impayées</h4>
              <button type="button" onClick={() => { setTab("dettes"); setFiltre("orphelines"); }} className={`text-xs ${linkAccent}`}>
                Voir tout →
              </button>
            </div>
            {(data?.depensesImpayees || []).slice(0, 5).map((d) => (
              <DepenseRow
                key={d.id || d._id}
                d={d}
                fournisseurs={data?.fournisseurs || []}
                onLink={linkDepense}
                onPaye={markDepensePayee}
                compact
              />
            ))}
            {(data?.depensesImpayees || []).length === 0 && (
              <p className={`text-sm ${textMuted}`}>Aucune dépense impayée.</p>
            )}
          </div>
          <div className={`${card} p-4`}>
            <div className="flex justify-between items-center mb-3">
              <h4 className={`font-medium ${textPrimary}`}>Engagements récents</h4>
              <button type="button" onClick={() => setTab("dettes")} className={`text-xs ${linkAccent}`}>
                Voir tout →
              </button>
            </div>
            {filteredEngagements.slice(0, 5).map((e) => (
              <EngagementRow key={e.id || e._id} e={e} onUpdate={updateEngagement} compact />
            ))}
            {filteredEngagements.length === 0 && (
              <p className={`text-sm ${textMuted}`}>Aucun engagement en cours.</p>
            )}
          </div>
        </div>
      )}

      {tab === "dettes" && (
        <>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "tous", label: "Tous" },
              { id: "retard", label: "En retard" },
              { id: "orphelines", label: "Sans fournisseur" },
              { id: "devis", label: "Devis seulement" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltre(f.id)}
                className={filtre === f.id ? filterChipActive : filterChipIdle}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className={`${card} p-4`}>
              <h4 className={`font-medium mb-3 ${textPrimary}`}>
                Dépenses budget ({filteredDepenses.length})
              </h4>
              {filteredDepenses.length === 0 ? (
                <p className={`text-sm ${textMuted}`}>Aucune dépense pour ce filtre.</p>
              ) : (
                filteredDepenses.map((d) => (
                  <DepenseRow
                    key={d.id || d._id}
                    d={d}
                    fournisseurs={data?.fournisseurs || []}
                    onLink={linkDepense}
                    onPaye={markDepensePayee}
                  />
                ))
              )}
            </div>
            <div className={`${card} p-4`}>
              <h4 className={`font-medium mb-3 ${textPrimary}`}>
                Bons de commande & devis ({filteredEngagements.length})
              </h4>
              {filteredEngagements.length === 0 ? (
                <p className={`text-sm ${textMuted}`}>Aucun engagement pour ce filtre.</p>
              ) : (
                filteredEngagements.map((e) => (
                  <EngagementRow key={e.id || e._id} e={e} onUpdate={updateEngagement} />
                ))
              )}
            </div>
          </div>
        </>
      )}

      {tab === "annuaire" && (
        <div className={`${card} overflow-hidden`}>
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <input
              type="search"
              placeholder="Rechercher un fournisseur…"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              className="w-full max-w-sm px-3 py-2 text-sm border rounded-lg dark:bg-gray-800"
            />
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left">Fournisseur</th>
                <th className="p-3 text-left">Catégorie</th>
                <th className="p-3 text-left">Tél.</th>
                <th className="p-3 text-right">Dette BC</th>
                <th className="p-3 text-right">Dette budget</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredFournisseurs.map((f) => (
                <tr key={f.id || f._id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className={`p-3 ${textPrimary}`}>
                    <Truck className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                    {f.nom}
                  </td>
                  <td className={`p-3 ${textMuted}`}>{f.categorie}</td>
                  <td className={`p-3 ${textMuted}`}>{f.telephone || "—"}</td>
                  <td className="p-3 text-right">{formatFCFAShort(f.detteEngagements || 0)}</td>
                  <td className="p-3 text-right">{formatFCFAShort(f.detteDepenses || 0)}</td>
                  <td className="p-3 text-right font-semibold text-red-600">{formatFCFAShort(f.detteEstimee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredFournisseurs.length === 0 && (
            <p className={`p-6 text-center text-sm ${textMuted}`}>Aucun fournisseur. Créez-en un pour commencer.</p>
          )}
        </div>
      )}

      {showForm && (
        <ModalForm title="Nouveau fournisseur" onClose={() => setShowForm(false)} onSubmit={handleCreate}>
          <input required placeholder="Nom *" value={form.nom} onChange={(ev) => setForm({ ...form, nom: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
          <input placeholder="Téléphone" value={form.telephone} onChange={(ev) => setForm({ ...form, telephone: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
          <input placeholder="RCCM" value={form.rccm} onChange={(ev) => setForm({ ...form, rccm: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
          <select value={form.categorie} onChange={(ev) => setForm({ ...form, categorie: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700">
            {["Sous-traitance", "Matériaux", "Transport", "Location engins", "Autre"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </ModalForm>
      )}

      {showEngagement && (
        <ModalForm title="Nouvel engagement / devis" onClose={() => setShowEngagement(false)} onSubmit={handleEngagement}>
          <select required value={engForm.fournisseurId} onChange={(ev) => setEngForm({ ...engForm, fournisseurId: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700">
            <option value="">Fournisseur *</option>
            {(data?.fournisseurs || []).map((f) => (
              <option key={f.id || f._id} value={f.id || f._id}>{f.nom}</option>
            ))}
          </select>
          <select value={engForm.chantierId} onChange={(ev) => setEngForm({ ...engForm, chantierId: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700">
            <option value="">Chantier (optionnel)</option>
            {chantiers.map((c) => (
              <option key={c.id || c._id} value={c.id || c._id}>{c.nom}</option>
            ))}
          </select>
          <input required placeholder="Objet / prestation *" value={engForm.objet} onChange={(ev) => setEngForm({ ...engForm, objet: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
          <input required type="number" placeholder="Montant HT (FCFA) *" value={engForm.montant} onChange={(ev) => setEngForm({ ...engForm, montant: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
          <select value={engForm.statut} onChange={(ev) => setEngForm({ ...engForm, statut: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700">
            <option value="DEVIS">Devis reçu</option>
            <option value="COMMANDE">Commandé</option>
            <option value="LIVRE">Livré</option>
          </select>
          <input type="date" value={engForm.dateEcheance} onChange={(ev) => setEngForm({ ...engForm, dateEcheance: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
        </ModalForm>
      )}
    </div>
  );
}

function ModalForm({ title, onClose, onSubmit, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md space-y-3">
        <h3 className={`font-semibold ${textPrimary}`}>{title}</h3>
        {children}
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm">Annuler</button>
          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}

function DepenseRow({ d, fournisseurs, onLink, onPaye, compact }) {
  const id = d.id || d._id;
  return (
    <div className={`flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-700 py-2.5 text-sm ${compact ? "" : ""}`}>
      <button type="button" onClick={() => goToBudget(d.chantierId)} className="flex-1 min-w-0 text-left hover:opacity-80 group">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium ${textPrimary}`}>{d.libelle}</span>
          <RetardBadge enRetard={d.enRetard} joursRestants={d.joursRestants} />
          {d.orpheline && (
            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">Non rattachée</span>
          )}
        </div>
        <p className={`text-xs ${textMuted}`}>
          {d.chantierNom || "—"} · {formatDate(d.dateEcheance || d.date)}
        </p>
      </button>
      <span className="font-semibold text-red-600 shrink-0">{formatFCFAShort(d.montant)}</span>
      {!compact && d.orpheline && fournisseurs.length > 0 && (
        <select
          defaultValue=""
          onChange={(ev) => { onLink(id, ev.target.value); ev.target.value = ""; }}
          className="text-xs px-2 py-1 border rounded-lg dark:bg-gray-800 max-w-[140px]"
          title="Rattacher au fournisseur"
        >
          <option value="">Rattacher…</option>
          {fournisseurs.map((f) => (
            <option key={f.id || f._id} value={f.id || f._id}>{f.nom}</option>
          ))}
        </select>
      )}
      <button type="button" onClick={() => onPaye(id)} title="Marquer payée" className={linkAccent}>
        <CheckCircle className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => goToBudget(d.chantierId)} className="text-gray-400 hover:text-indigo-500">
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function EngagementRow({ e, onUpdate, compact }) {
  const id = e.id || e._id;
  const nextStatut = { DEVIS: "COMMANDE", COMMANDE: "LIVRE", LIVRE: "PAYE" }[e.statutRaw];

  return (
    <div className={`flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-700 py-2.5 text-sm`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{e.numero}</span>
          <span className={`font-medium ${textPrimary}`}>{e.objet}</span>
          <RetardBadge enRetard={e.enRetard} joursRestants={e.joursRestants} />
        </div>
        <p className={`text-xs ${textMuted}`}>
          {e.fournisseurNom} · {e.chantierNom || "—"} · {formatDate(e.dateEcheance)}
        </p>
      </div>
      <span className="font-semibold shrink-0">{formatFCFAShort(e.montantTTC)}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COLORS[e.statutRaw] || "bg-gray-100"}`}>{e.statut}</span>
      {!compact && nextStatut && (
        <button type="button" onClick={() => onUpdate(id, nextStatut)} className={`text-xs px-2 py-1 rounded border ${filterChipIdle}`}>
          → {nextStatut === "PAYE" ? "Payé" : nextStatut === "COMMANDE" ? "Commander" : "Livré"}
        </button>
      )}
      {e.statutRaw !== "PAYE" && (
        <button type="button" onClick={() => onUpdate(id, "PAYE")} title="Marquer payé" className={linkAccent}>
          <CheckCircle className="w-4 h-4" />
        </button>
      )}
      {e.chantierId && (
        <button type="button" onClick={() => goToBudget(e.chantierId)} className="text-gray-400 hover:text-indigo-500">
          <Wallet className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
