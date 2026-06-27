import { useEffect, useState, useMemo } from "react";
import api from "../lib/api";
import ClientForm from "../components/ClientForm";
import PortalInviteBlock from "../components/PortalInviteBlock";
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
  btnGhost,
  amountGreen,
  amountRed,
  amountDefault,
  filterChipActive,
  filterChipIdle,
} from "../lib/uiClasses";
import {
  Users,
  Plus,
  Search,
  Building2,
  FileText,
  Receipt,
  Phone,
  Mail,
  MapPin,
  X,
  ChevronRight,
  Crown,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

const STATUTS = ["Tous", "Prospect", "Actif", "VIP", "Inactif"];
const TYPES = ["Tous", "Particulier", "Entreprise"];

const statutBadge = {
  Prospect: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Actif: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  VIP: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  Inactif: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const devisBadge = {
  "En attente": "text-amber-600 dark:text-amber-400",
  "Envoyé": "text-blue-600 dark:text-blue-400",
  "Accepté": "text-green-600 dark:text-green-400",
  "Refusé": "text-red-600 dark:text-red-400",
};

const factureBadge = {
  Brouillon: "text-gray-500 dark:text-gray-400",
  Envoyée: "text-blue-600 dark:text-blue-400",
  Payée: "text-green-600 dark:text-green-400",
  Impayée: "text-red-600 dark:text-red-400",
  Annulée: "text-gray-400 dark:text-gray-500",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function ClientDetail({ id, onClose, onUpdated, onEdit }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshDetail = () => {
    return api.get(`/client/${id}/detail`).then((res) => setDetail(res.data));
  };

  useEffect(() => {
    refreshDetail().finally(() => setLoading(false));
  }, [id]);

  const handleStatutChange = async (newStatut) => {
    await api.put(`/client/${id}`, { statutRelation: newStatut });
    onUpdated();
    await refreshDetail();
  };

  const handlePortalSuccess = async () => {
    onUpdated();
    await refreshDetail();
  };

  if (loading) return <div className={`p-8 text-center ${textMuted}`}>Chargement...</div>;
  if (!detail) return null;

  const f = detail.finances || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statutBadge[detail.statutRelation] || ""}`}>
                {detail.statutRelation}
              </span>
              <span className={`text-xs ${textMuted}`}>{detail.type}</span>
              {detail.statutRelation === "VIP" && <Crown className="w-4 h-4 text-purple-500" />}
            </div>
            <h3 className={`text-xl font-bold mt-2 ${textPrimary}`}>{detail.nom}</h3>
            <div className={`flex flex-wrap gap-3 mt-2 text-sm ${textMuted}`}>
              {detail.telephone && (
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {detail.telephone}</span>
              )}
              {detail.email && (
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {detail.email}</span>
              )}
              {detail.pays && (
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {detail.pays}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Finances */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "CA facturé", value: formatFCFAShort(f.factureTotal) },
              { label: "Encaissé", value: formatFCFAShort(f.facturePayee), ok: true },
              { label: "Impayés", value: formatFCFAShort(f.factureImpayee), warn: f.factureImpayee > 0 },
              { label: "Pipeline devis", value: formatFCFAShort(f.pipelineDevis) },
            ].map((k) => (
              <div key={k.label} className={cardInner}>
                <p className={kpiLabel}>{k.label}</p>
                <p className={`font-bold ${k.warn ? amountRed : k.ok ? amountGreen : amountDefault}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Compteurs */}
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800/50">
              <Building2 className="w-5 h-5 mx-auto text-blue-500 dark:text-blue-400 mb-1" />
              <p className={`font-bold ${textPrimary}`}>{detail.counts?.chantiers ?? 0}</p>
              <p className={`${textMuted} text-xs`}>Chantiers</p>
            </div>
            <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800/50">
              <FileText className="w-5 h-5 mx-auto text-purple-500 dark:text-purple-400 mb-1" />
              <p className={`font-bold ${textPrimary}`}>{detail.counts?.devis ?? 0}</p>
              <p className={`${textMuted} text-xs`}>Devis</p>
            </div>
            <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800/50">
              <Receipt className="w-5 h-5 mx-auto text-green-500 dark:text-green-400 mb-1" />
              <p className={`font-bold ${textPrimary}`}>{detail.counts?.factures ?? 0}</p>
              <p className={`${textMuted} text-xs`}>Factures</p>
            </div>
          </div>

          {/* Statut */}
          <div className="flex flex-wrap items-center gap-3">
            <label className={`text-sm font-medium ${textSecondary}`}>Statut relationnel</label>
            <select
              value={detail.statutRelation}
              onChange={(e) => handleStatutChange(e.target.value)}
              className={`text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 ${textPrimary}`}
            >
              {["Prospect", "Actif", "VIP", "Inactif"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => onEdit(detail)}
              className={`text-sm ${linkAccent} ml-auto`}
            >
              Modifier la fiche →
            </button>
          </div>

          <PortalInviteBlock
            clientId={detail.id || detail._id}
            clientEmail={detail.email}
            portalAccess={detail.portalAccess}
            onSuccess={handlePortalSuccess}
          />

          {/* Chantiers */}
          {detail.chantiers?.length > 0 && (
            <div>
              <h4 className={`font-medium text-sm mb-2 ${textSecondary}`}>Chantiers liés</h4>
              <div className="space-y-2">
                {detail.chantiers.map((ch) => (
                  <div key={ch.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-200 dark:border-gray-600 last:border-0">
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{ch.nom}</p>
                      <p className={`text-xs ${textFaint}`}>{ch.statut} · {ch.ville || "—"}</p>
                    </div>
                    <div className={`text-right text-xs ${textSecondary}`}>
                      <p>{formatFCFAShort(ch.depenses)} / {formatFCFAShort(ch.budget)}</p>
                      <p className={ch.ratioBudget > 80 ? "text-amber-600 dark:text-amber-400" : textFaint}>{ch.ratioBudget}% budget</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Devis récents */}
          {detail.devisRecents?.length > 0 && (
            <div>
              <h4 className={`font-medium text-sm mb-2 ${textSecondary}`}>Devis récents</h4>
              {detail.devisRecents.map((d) => (
                <div key={d.id} className={`flex justify-between text-sm py-1.5 border-b border-gray-200 dark:border-gray-600 ${textSecondary}`}>
                  <span>{d.numero} <span className={devisBadge[d.statut] || textMuted}>({d.statut})</span></span>
                  <span className={amountDefault}>{formatFCFAShort(d.montantTTC)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Factures récentes */}
          {detail.facturesRecentes?.length > 0 && (
            <div>
              <h4 className={`font-medium text-sm mb-2 ${textSecondary}`}>Factures récentes</h4>
              {detail.facturesRecentes.map((fa) => (
                <div key={fa.id} className={`flex justify-between text-sm py-1.5 border-b border-gray-200 dark:border-gray-600 ${textSecondary}`}>
                  <span>
                    {fa.numero}
                    <span className={`ml-1 ${factureBadge[fa.statut] || textMuted}`}>({fa.statut})</span>
                  </span>
                  <span className={amountDefault}>{formatFCFAShort(fa.montantTTC)}</span>
                </div>
              ))}
            </div>
          )}

          {detail.notes && (
            <div className={`p-3 rounded-lg ${cardInner} text-sm`}>
              <p className={`text-xs ${textMuted} mb-1`}>Notes</p>
              <p className={textSecondary}>{detail.notes}</p>
            </div>
          )}

          <div className="flex gap-3 text-sm">
            <a href="#/devis" className={linkAccent}>Devis →</a>
            <a href="#/factures" className={linkAccent}>Factures →</a>
            <a href="#/chantier" className={linkAccent}>Chantiers →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Clients() {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("Tous");
  const [filterType, setFilterType] = useState("Tous");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/client/overview");
      setStats(res.data.stats);
      setClients(res.data.items || []);
      setError("");
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        setError("Session expirée. Reconnectez-vous.");
        return;
      }
      // Repli si la route overview n'est pas disponible (ancien back)
      if (status === 404) {
        try {
          const res = await api.get("/client");
          const items = res.data || [];
          setClients(items);
          setStats({
            total: items.length,
            actifs: items.filter((c) => c.statutRelation === "Actif").length,
            prospects: items.filter((c) => c.statutRelation === "Prospect").length,
            vip: items.filter((c) => c.statutRelation === "VIP").length,
            inactifs: items.filter((c) => c.statutRelation === "Inactif").length,
            caFacture: 0,
            caEncaisse: 0,
            impayes: 0,
            pipelineDevis: 0,
          });
          setError("");
          return;
        } catch {
          /* continue to generic error */
        }
      }
      setError(err.response?.data?.error || "Erreur lors du chargement des clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = clients;
    if (filterStatut !== "Tous") list = list.filter((c) => c.statutRelation === filterStatut);
    if (filterType !== "Tous") list = list.filter((c) => c.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.nom?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.telephone?.includes(q) ||
          c.pays?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [clients, filterStatut, filterType, search]);

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce client et toutes ses données liées ?")) return;
    await api.delete(`/client/${id}`);
    if (selectedId === id) setSelectedId(null);
    load();
  };

  const openEdit = (client) => {
    setEditClient(client);
    setShowForm(true);
    setSelectedId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Clients</h2>
          <p className={pageSubtitle}>Relation client, pipeline commercial et suivi financier</p>
        </div>
        <button
          onClick={() => {
            setEditClient(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau client
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Total clients", value: stats.total, icon: Users },
            { label: "Actifs", value: stats.actifs },
            { label: "Prospects", value: stats.prospects },
            { label: "VIP", value: stats.vip },
            { label: "CA facturé", value: formatFCFAShort(stats.caFacture) },
            { label: "Impayés", value: formatFCFAShort(stats.impayes), warn: stats.impayes > 0 },
            { label: "Pipeline devis", value: formatFCFAShort(stats.pipelineDevis), icon: TrendingUp },
          ].map((k) => (
            <div key={k.label} className={`${card} p-4`}>
              <p className={kpiLabel}>{k.label}</p>
              <p className={`${kpiValue} ${k.warn ? "text-red-600 dark:text-red-400" : ""}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

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
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1 hidden sm:block" />
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              filterType === t
                ? "bg-slate-700 text-white dark:bg-slate-500"
                : filterChipIdle
            }`}
          >
            {t}
          </button>
        ))}
        <div className="w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm sm:ml-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher nom, email, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={searchInput}
            />
          </div>
        </div>
      </div>

      <ClientForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditClient(null);
        }}
        onSaved={load}
        client={editClient}
      />

      {/* Liste */}
      {loading ? (
        <p className={textMuted}>Chargement...</p>
      ) : error ? (
        <p className="text-red-600 dark:text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 ${card}`}>
          <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className={textMuted}>Aucun client trouvé.</p>
          <button onClick={() => setShowForm(true)} className={`mt-3 text-sm ${linkAccent}`}>
            Créer votre premier client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const id = c._id || c.id;
            const fin = c.finances || {};
            const hasImpayes = fin.factureImpayee > 0;
            return (
              <div key={id} className={`${card} hover:shadow-md transition overflow-hidden`}>
                <div className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statutBadge[c.statutRelation] || ""}`}>
                          {c.statutRelation}
                        </span>
                        {c.statutRelation === "VIP" && <Crown className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />}
                      </div>
                      <h3 className={`font-semibold mt-2 truncate ${textPrimary}`}>{c.nom}</h3>
                      <p className={`text-sm ${textMuted}`}>{c.type}</p>
                      <p className={`text-xs ${textFaint} flex items-center gap-1 mt-1`}>
                        <Phone className="w-3 h-3" /> {c.telephone}
                      </p>
                      {c.pays && (
                        <p className={`text-xs ${textFaint} flex items-center gap-1`}>
                          <MapPin className="w-3 h-3" /> {c.pays}
                        </p>
                      )}
                    </div>
                    {hasImpayes && (
                      <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 dark:text-red-400" title="Impayés" />
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className={cardInner}>
                      <p className={textMuted}>Encaissé</p>
                      <p className={amountGreen}>{formatFCFAShort(fin.facturePayee)}</p>
                    </div>
                    <div className={cardInner}>
                      <p className={textMuted}>Pipeline</p>
                      <p className={amountDefault}>{formatFCFAShort(fin.pipelineDevis)}</p>
                    </div>
                  </div>

                  {c.counts && (
                    <div className={`flex gap-3 mt-3 text-xs ${textMuted}`}>
                      {c.counts.chantiers > 0 && <span>{c.counts.chantiers} chantiers</span>}
                      {c.counts.devis > 0 && <span>{c.counts.devis} devis</span>}
                      {c.counts.factures > 0 && <span>{c.counts.factures} factures</span>}
                    </div>
                  )}
                </div>

                <div className={cardFooter}>
                  <button onClick={() => openEdit(c)} className={btnGhost}>
                    Modifier
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedId(id)}
                      className={`text-xs ${linkAccent} flex items-center gap-0.5`}
                    >
                      Détails <ChevronRight className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedId && (
        <ClientDetail
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={load}
          onEdit={(c) => openEdit(c)}
        />
      )}
    </div>
  );
}
