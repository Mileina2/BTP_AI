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
  ShieldCheck,
  Plus,
  CheckCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  ArrowRight,
  ExternalLink,
  Calendar,
  History,
} from "lucide-react";

const TABS = [
  { id: "synthese", label: "Synthèse" },
  { id: "echeances", label: "Échéances" },
  { id: "historique", label: "Historique" },
];

const TYPE_OPTIONS = [
  { value: "CNPS", label: "CNPS" },
  { value: "DGI_TVA", label: "DGI / TVA" },
  { value: "ASSURANCE_RC", label: "Assurance RC" },
  { value: "ASSURANCE_DECENNALE", label: "Décennale" },
  { value: "RCCM", label: "RCCM" },
  { value: "RETENUE_GARANTIE", label: "Retenue garantie" },
  { value: "AUTRE", label: "Autre" },
];

const STATUT_STYLE = {
  EN_RETARD: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  FAIT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  A_VENIR: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
};

function goTo(page, { factureId, chantierId } = {}) {
  if (factureId) sessionStorage.setItem("btpia_nav_facture", factureId);
  if (chantierId) sessionStorage.setItem("btpia_nav_chantier", chantierId);
  window.location.hash = `/${page}`;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function EcheanceRow({ e, onDone, onDelete, highlight }) {
  const id = e.id || e._id;
  const canDone = e.statutRaw !== "FAIT";

  const openLink = () => {
    if (e.linkPage === "factures" && e.linkId) goTo("factures", { factureId: e.linkId });
    else if (e.linkPage === "budget" && e.linkId) goTo("budget", { chantierId: e.linkId });
    else if (e.linkPage === "entreprise") goTo("entreprise");
  };

  return (
    <tr
      id={`echeance-${id}`}
      className={`border-t border-gray-100 dark:border-gray-700 ${highlight ? "bg-amber-50 dark:bg-amber-900/20" : ""}`}
    >
      <td className={`p-3 text-xs ${textMuted} max-w-[120px]`}>{e.typeLabel}</td>
      <td className={`p-3 ${textPrimary}`}>
        <div className="flex items-start gap-2">
          <div>
            {e.libelle}
            {e.chantierNom && <span className={`block text-xs ${textMuted}`}>{e.chantierNom}</span>}
            {e.recurrenceMois && (
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400">Récurrent · {e.recurrenceMois} mois</span>
            )}
          </div>
          {e.linkPage && (
            <button type="button" onClick={openLink} title="Ouvrir la source" className="text-gray-400 hover:text-indigo-500 shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
      <td className={`p-3 ${textMuted}`}>
        {formatDate(e.dateEcheance)}
        {e.joursRestants != null && e.statutRaw === "A_VENIR" && (
          <span className={`block text-xs ${e.joursRestants <= 7 ? "text-amber-600 font-medium" : ""}`}>
            J-{e.joursRestants}
          </span>
        )}
      </td>
      <td className="p-3 text-right">{e.montantEstime ? formatFCFAShort(e.montantEstime) : "—"}</td>
      <td className="p-3">
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_STYLE[e.statutRaw] || STATUT_STYLE.A_VENIR}`}>
          {e.statut}
        </span>
      </td>
      <td className="p-3">
        <div className="flex gap-1 justify-end">
          {canDone && (
            <button
              type="button"
              onClick={() => onDone(id)}
              title="Marquer effectué"
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30"
            >
              <CheckCircle className="w-4 h-4" /> Fait
            </button>
          )}
          <button type="button" onClick={() => onDelete(id)} title="Supprimer" className="p-1 text-red-500 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Conformite() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("synthese");
  const [filtre, setFiltre] = useState("actives");
  const [highlightId, setHighlightId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "CNPS", libelle: "", dateEcheance: "", montantEstime: "", recurrenceMois: "" });

  const load = useCallback(() => {
    setLoading(true);
    return api
      .get("/conformite/overview")
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`echeance-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const t = setTimeout(() => setHighlightId(null), 3000);
      return () => clearTimeout(t);
    }
  }, [highlightId, tab, data]);

  const handleDone = async (id) => {
    await api.post(`/conformite/${id}/done`);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer cette échéance ?")) return;
    await api.delete(`/conformite/${id}`);
    load();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    await api.post("/conformite", {
      ...form,
      montantEstime: form.montantEstime ? Number(form.montantEstime) : undefined,
      recurrenceMois: form.recurrenceMois ? Number(form.recurrenceMois) : undefined,
    });
    setShowForm(false);
    setForm({ type: "CNPS", libelle: "", dateEcheance: "", montantEstime: "", recurrenceMois: "" });
    load();
  };

  const scrollToAlert = (id) => {
    setTab("echeances");
    setHighlightId(id);
  };

  const filteredList = useMemo(() => {
    let list = data?.echeances || [];
    if (filtre === "actives") list = list.filter((e) => e.statutRaw !== "FAIT");
    else if (filtre === "retard") list = list.filter((e) => e.statutRaw === "EN_RETARD");
    else if (filtre === "7j") list = list.filter((e) => e.statutRaw === "A_VENIR" && e.joursRestants <= 7);
    else if (filtre === "30j") list = list.filter((e) => e.statutRaw === "A_VENIR" && e.joursRestants <= 30);
    else if (filtre === "fait") list = list.filter((e) => e.statutRaw === "FAIT");
    return list;
  }, [data, filtre]);

  if (loading && !data) {
    return <div className={`p-12 text-center ${textMuted}`}>Chargement conformité…</div>;
  }

  const s = data?.stats || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Conformité & échéances</h2>
          <p className={pageSubtitle}>{data?.norme}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className={filterChipIdle} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
          <button
            type="button"
            onClick={() => downloadFile("/conformite/export/csv", `conformite_${new Date().toISOString().slice(0, 10)}.csv`)}
            className={filterChipIdle}
          >
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </button>
          <button type="button" onClick={() => setShowForm(true)} className={filterChipActive}>
            <Plus className="w-4 h-4" /> Ajouter
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
          className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-2 ${
            a.type === "critical"
              ? "bg-red-50 dark:bg-red-900/20 text-red-800 border border-red-200"
              : "bg-amber-50 dark:bg-amber-900/20 text-amber-900 border border-amber-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>{a.titre}</strong> — {a.message}
            </span>
          </div>
          {a.id && (
            <button type="button" onClick={() => scrollToAlert(a.id)} className={`shrink-0 text-xs ${linkAccent} flex items-center gap-1`}>
              Voir <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Actives", value: s.actives ?? s.total },
          { label: "En retard", value: s.enRetard, red: true },
          { label: "Sous 7 j", value: s.sous7j, amber: true },
          { label: "Sous 30 j", value: s.sous30j },
          { label: "Effectuées", value: s.fait, green: true },
          { label: "Montant actif", value: s.montantActif ? formatFCFAShort(s.montantActif) : "—" },
        ].map((k) => (
          <div key={k.label} className={cardInner}>
            <p className={kpiLabel}>{k.label}</p>
            <p
              className={`${kpiValue} ${
                k.red ? "text-red-600" : k.amber ? "text-amber-600" : k.green ? "text-emerald-600" : textPrimary
              }`}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {tab === "synthese" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={`${card} p-4`}>
            <h4 className={`font-medium mb-3 flex items-center gap-2 ${textPrimary}`}>
              <Calendar className="w-4 h-4 text-indigo-500" /> Prochaines échéances
            </h4>
            {(data?.prochaines || []).slice(0, 6).map((e) => (
              <div key={e.id || e._id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 text-sm">
                <div>
                  <p className={`font-medium ${textPrimary}`}>{e.libelle}</p>
                  <p className={`text-xs ${textMuted}`}>{e.typeLabel} · {formatDate(e.dateEcheance)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {e.statutRaw !== "FAIT" && (
                    <button type="button" onClick={() => handleDone(e.id || e._id)} className="text-emerald-600" title="Marquer fait">
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(data?.prochaines || []).length === 0 && <p className={`text-sm ${textMuted}`}>Aucune échéance active.</p>}
          </div>
          <div className={`${card} p-4`}>
            <h4 className={`font-medium mb-3 ${textPrimary}`}>Par type d'obligation</h4>
            <div className="space-y-2">
              {(data?.parType || [])
                .filter((p) => p.total > 0 || p.count > 0)
                .map((p) => (
                  <div key={p.type} className="flex items-center gap-3 text-sm">
                    <span className={`flex-1 ${textMuted} truncate`}>{p.label}</span>
                    <span className={`font-semibold ${p.count > 0 ? "text-amber-600" : "text-gray-400"}`}>{p.count}</span>
                    <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${Math.min(100, (p.count / Math.max(1, s.actives || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
            <button type="button" onClick={() => goTo("entreprise")} className={`mt-4 text-xs ${linkAccent}`}>
              Mettre à jour RCCM / assurances →
            </button>
          </div>
        </div>
      )}

      {tab === "echeances" && (
        <>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "actives", label: "Actives" },
              { id: "retard", label: "En retard" },
              { id: "7j", label: "Sous 7 j" },
              { id: "30j", label: "Sous 30 j" },
            ].map((f) => (
              <button key={f.id} type="button" onClick={() => setFiltre(f.id)} className={filtre === f.id ? filterChipActive : filterChipIdle}>
                {f.label}
              </button>
            ))}
          </div>
          <div className={`${card} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead className="bg-indigo-900 text-white">
                <tr>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Libellé</th>
                  <th className="p-3 text-left">Échéance</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3 text-left">Statut</th>
                  <th className="p-3 w-32" />
                </tr>
              </thead>
              <tbody>
                {filteredList.map((e) => (
                  <EcheanceRow
                    key={e.id || e._id}
                    e={e}
                    onDone={handleDone}
                    onDelete={handleDelete}
                    highlight={(e.id || e._id) === highlightId}
                  />
                ))}
              </tbody>
            </table>
            {filteredList.length === 0 && (
              <p className={`p-6 text-center text-sm ${textMuted}`}>Aucune échéance pour ce filtre.</p>
            )}
          </div>
        </>
      )}

      {tab === "historique" && (
        <div className={`${card} p-4`}>
          <h4 className={`font-medium mb-3 flex items-center gap-2 ${textPrimary}`}>
            <History className="w-4 h-4" /> Obligations effectuées
          </h4>
          {(data?.historique || []).length === 0 ? (
            <p className={`text-sm ${textMuted}`}>Aucune échéance marquée comme effectuée.</p>
          ) : (
            <ul className="space-y-2">
              {data.historique.map((e) => (
                <li key={e.id || e._id} className="flex justify-between text-sm py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className={textMuted}>{e.typeLabel} — {e.libelle}</span>
                  <span className="text-emerald-600 text-xs">Effectué</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form onSubmit={handleCreate} className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md space-y-3">
            <h3 className={`font-semibold flex items-center gap-2 ${textPrimary}`}>
              <ShieldCheck className="w-5 h-5" /> Nouvelle échéance
            </h3>
            <select value={form.type} onChange={(ev) => setForm({ ...form, type: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700">
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input required placeholder="Libellé *" value={form.libelle} onChange={(ev) => setForm({ ...form, libelle: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
            <input required type="date" value={form.dateEcheance} onChange={(ev) => setForm({ ...form, dateEcheance: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
            <input type="number" placeholder="Montant estimé (FCFA)" value={form.montantEstime} onChange={(ev) => setForm({ ...form, montantEstime: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
            <input type="number" min="1" max="12" placeholder="Récurrence (mois) — ex. 1 pour CNPS, 3 pour TVA" value={form.recurrenceMois} onChange={(ev) => setForm({ ...form, recurrenceMois: ev.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-sm">Annuler</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
