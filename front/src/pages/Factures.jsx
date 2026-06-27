import { useEffect, useState, useMemo } from "react";
import api, { downloadFile } from "../lib/api";
import FactureForm from "../components/FactureForm";
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
} from "../lib/uiClasses";
import {
  Receipt,
  Plus,
  Search,
  Trash2,
  FileDown,
  X,
  ChevronRight,
  User,
  Building2,
  Clock,
  AlertTriangle,
  Edit,
  TrendingUp,
  CheckCircle,
  Banknote,
  Send,
  Mail,
  RefreshCw,
  ArrowRight,
  PiggyBank,
} from "lucide-react";

const STATUTS = ["Tous", "Brouillon", "Envoyée", "Partiellement payée", "Payée", "Impayée", "Annulée"];

const statutBadge = {
  Brouillon: "bg-gray-100 text-gray-800 dark:bg-gray-700/60 dark:text-gray-200",
  Envoyée: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  "Partiellement payée": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Payée: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  Impayée: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  Annulée: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const MODES_PAIEMENT = ["Virement bancaire", "Espèces", "Mobile Money", "Chèque"];

function goToTresorerie() {
  window.location.hash = "/tresorerie";
}

function QuickPayBlock({ factureId, resteDu, onDone }) {
  const [open, setOpen] = useState(false);
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState("Virement bancaire");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  if (!resteDu || resteDu <= 0) return null;

  const submit = async (amount) => {
    const val = Math.round(Number(amount));
    if (!val || val <= 0) {
      setErr("Montant invalide");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      await api.post(`/facture/${factureId}/paiements`, {
        montant: val,
        modePaiement: mode,
      });
      setOpen(false);
      setMontant("");
      onDone?.();
    } catch (e) {
      setErr(e.response?.data?.error || "Paiement impossible");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setMontant(String(Math.round(resteDu)));
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
      >
        <Banknote className="w-3.5 h-3.5" /> Encaisser
      </button>
    );
  }

  return (
    <div className="w-full space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-700">
      <div className="flex flex-wrap gap-1.5 items-center">
        <input
          type="number"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          className="w-28 text-xs border rounded px-2 py-1 dark:bg-gray-700"
          placeholder="Montant"
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="text-xs border rounded px-2 py-1 dark:bg-gray-700"
        >
          {MODES_PAIEMENT.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <button type="button" disabled={loading} onClick={() => submit(montant)} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">
          {loading ? "…" : "Valider"}
        </button>
        <button type="button" disabled={loading} onClick={() => submit(resteDu)} className="text-xs px-2 py-1 rounded border">
          Solde
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs px-1 text-gray-400">
          ×
        </button>
      </div>
      <p className={`text-[10px] ${textMuted}`}>Reste dû : {formatFCFAShort(resteDu)}</p>
      {err && <p className="text-[10px] text-red-600">{err}</p>}
    </div>
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function FactureDetail({ id, onClose, onUpdated, onEdit }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailLoading, setEmailLoading] = useState(false);
  const [sendMsg, setSendMsg] = useState("");
  const [sendErr, setSendErr] = useState("");
  const [payForm, setPayForm] = useState({ montant: "", modePaiement: "Virement bancaire", reference: "" });
  const [payLoading, setPayLoading] = useState(false);
  const [avoirLoading, setAvoirLoading] = useState(false);

  const load = () =>
    api.get(`/facture/${id}/detail`).then((res) => setDetail(res.data));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  const handleStatutChange = async (newStatut) => {
    await api.put(`/facture/${id}`, { statut: newStatut });
    onUpdated();
    await load();
  };

  const handlePDF = () => downloadFile(`/facture/${id}/pdf`, `facture_${detail?.numero || id}.pdf`);

  const handleEmail = async () => {
    setEmailLoading(true);
    setSendMsg("");
    setSendErr("");
    try {
      const res = await api.post(`/facture/${id}/email`, {
        email: detail.client?.email || undefined,
      });
      setSendMsg(res.data.message || "Facture envoyée par email.");
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
      const res = await api.get(`/facture/${id}/whatsapp`);
      const url = res.data.url || res.data.whatsappUrl;
      if (!url) throw new Error("Lien WhatsApp indisponible");
      window.open(url, "_blank");
      setSendMsg(res.data.message || "WhatsApp ouvert — envoyez le message au client.");
    } catch (err) {
      setSendErr(err.response?.data?.error || err.message || "WhatsApp impossible");
    }
  };

  const handleValider = async () => {
    try {
      await api.post(`/facture/${id}/valider`);
      onUpdated();
      await load();
      setSendMsg("Facture validée et verrouillée.");
    } catch (err) {
      setSendErr(err.response?.data?.error || "Validation impossible");
    }
  };

  const handleAddPaiement = async (e) => {
    e.preventDefault();
    const montant = Number(payForm.montant);
    if (!montant || montant <= 0) {
      setSendErr("Montant invalide.");
      return;
    }
    setPayLoading(true);
    setSendErr("");
    try {
      const res = await api.post(`/facture/${id}/paiements`, {
        montant,
        modePaiement: payForm.modePaiement,
        reference: payForm.reference || undefined,
      });
      setDetail(res.data);
      setPayForm({ montant: "", modePaiement: payForm.modePaiement, reference: "" });
      setSendMsg("Paiement enregistré.");
      onUpdated();
    } catch (err) {
      setSendErr(err.response?.data?.error || "Paiement impossible");
    } finally {
      setPayLoading(false);
    }
  };

  const handleDeletePaiement = async (paiementId) => {
    if (!confirm("Supprimer cet encaissement ?")) return;
    try {
      const res = await api.delete(`/facture/${id}/paiements/${paiementId}`);
      setDetail(res.data);
      onUpdated();
    } catch (err) {
      setSendErr(err.response?.data?.error || "Suppression impossible");
    }
  };

  const handleAvoir = async () => {
    const motif = window.prompt("Motif de l'avoir (optionnel) :");
    if (motif === null) return;
    const reste = detail.finances?.resteDu ?? 0;
    const montantStr = window.prompt(
      `Montant TTC de l'avoir (reste dû : ${Math.round(reste)} FCFA)\nLaisser vide = avoir total du reste :`
    );
    if (montantStr === null) return;
    setAvoirLoading(true);
    setSendErr("");
    try {
      const body = { motif: motif || undefined };
      if (montantStr.trim()) body.montantTTC = Number(montantStr);
      const res = await api.post(`/facture/${id}/avoir`, body);
      setDetail(res.data.facture);
      setSendMsg(res.data.message || "Avoir émis.");
      onUpdated();
    } catch (err) {
      setSendErr(err.response?.data?.error || "Avoir impossible");
    } finally {
      setAvoirLoading(false);
    }
  };

  const handleAvoirPdf = (avoirId, numero) =>
    downloadFile(`/facture/avoir/${avoirId}/pdf`, `avoir_${numero}.pdf`);

  if (loading) return <div className={`p-8 text-center ${textMuted}`}>Chargement...</div>;
  if (!detail) return null;

  const e = detail.echeance || {};
  const f = detail.finances || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 p-5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statutBadge[detail.statut] || ""}`}>
                {detail.statut}
              </span>
              <span className={`text-xs font-mono ${textMuted}`}>{detail.numero}</span>
              {detail.typeFacture && detail.typeFacture !== "Facture intégrale" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                  {detail.typeFacture}
                </span>
              )}
              {detail.verrouillee && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                  Verrouillée
                </span>
              )}
              {e.enRetard && (
                <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {e.joursRetard}j de retard
                </span>
              )}
            </div>
            <h3 className={`text-xl font-bold mt-2 ${textPrimary}`}>Facture {detail.numero}</h3>
            <p className={`text-sm ${textMuted} mt-1 flex items-center gap-2 flex-wrap`}>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> {detail.client?.nom}
              </span>
              {detail.chantier?.nom && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> {detail.chantier.nom}
                </span>
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
                label: "Échéance",
                value: formatDate(e.dateEcheance),
                warn: e.enRetard,
              },
            ].map((k) => (
              <div key={k.label} className={cardInner}>
                <p className={kpiLabel}>{k.label}</p>
                <p
                  className={`font-bold ${k.warn ? "text-red-600 dark:text-red-400" : k.highlight ? "text-emerald-600 dark:text-emerald-400" : textPrimary}`}
                >
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          {(f.netAPayer != null || f.acompteDeduit > 0 || f.resteDu > 0 || f.montantVerse > 0) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Net à payer", value: formatFCFAShort(f.netAPayer) },
                { label: "Encaissé", value: formatFCFAShort(f.montantVerse || 0), highlight: true },
                { label: "Avoirs", value: formatFCFAShort(f.montantAvoir || 0) },
                {
                  label: "Reste dû",
                  value: formatFCFAShort(f.resteDu || 0),
                  warn: (f.resteDu || 0) > 0 && detail.statut !== "Payée",
                },
              ].map((k) => (
                <div key={k.label} className={cardInner}>
                  <p className={kpiLabel}>{k.label}</p>
                  <p
                    className={`font-bold ${k.warn ? "text-red-600 dark:text-red-400" : k.highlight ? "text-emerald-600 dark:text-emerald-400" : textPrimary}`}
                  >
                    {k.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {f.acompteDeduit > 0 && (
            <div className={cardInner}>
              <p className={`text-xs ${textMuted} mb-1`}>Acompte déduit</p>
              <p className={`text-sm font-medium ${textSecondary}`}>{formatFCFAShort(f.acompteDeduit)}</p>
            </div>
          )}

          {detail.description && (
            <div className={cardInner}>
              <p className={`text-xs ${textMuted} mb-1`}>Objet</p>
              <p className={`text-sm ${textSecondary}`}>{detail.description}</p>
            </div>
          )}

          {(detail.referenceDevis || detail.devis?.numero) && (
            <div className={cardInner}>
              <p className={`text-xs ${textMuted} mb-1`}>Référence devis</p>
              <p className={`text-sm ${textSecondary}`}>{detail.referenceDevis || detail.devis?.numero}</p>
            </div>
          )}

          {detail.modePaiement && (
            <div className={cardInner}>
              <p className={`text-xs ${textMuted} mb-1`}>Mode de paiement</p>
              <p className={`text-sm ${textSecondary}`}>{detail.modePaiement}</p>
            </div>
          )}

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

          {(detail.paiements?.length > 0 || (f.resteDu ?? 0) > 0.01) && detail.statut !== "Annulée" && (
            <div className={cardInner}>
              <h4 className={`font-medium text-sm mb-3 flex items-center gap-2 ${textSecondary}`}>
                <Banknote className="w-4 h-4" /> Encaissements
              </h4>
              {detail.paiements?.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {detail.paiements.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-600 pb-2"
                    >
                      <span className={textSecondary}>
                        {formatDate(p.datePaiement)} — {formatFCFAShort(p.montant)}
                        {p.modePaiement ? ` (${p.modePaiement})` : ""}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeletePaiement(p.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Supprimer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {(f.resteDu ?? 0) > 0.01 && (
                <form onSubmit={handleAddPaiement} className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className={`text-xs ${textMuted}`}>Montant</label>
                    <input
                      type="number"
                      min="1"
                      value={payForm.montant}
                      onChange={(ev) => setPayForm({ ...payForm, montant: ev.target.value })}
                      className="block w-32 mt-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700"
                      placeholder={Math.round(f.resteDu || 0)}
                    />
                  </div>
                  <div>
                    <label className={`text-xs ${textMuted}`}>Mode</label>
                    <select
                      value={payForm.modePaiement}
                      onChange={(ev) => setPayForm({ ...payForm, modePaiement: ev.target.value })}
                      className="block mt-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700"
                    >
                      {["Virement bancaire", "Espèces", "Chèque", "Mobile Money"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`text-xs ${textMuted}`}>Réf.</label>
                    <input
                      type="text"
                      value={payForm.reference}
                      onChange={(ev) => setPayForm({ ...payForm, reference: ev.target.value })}
                      className="block w-28 mt-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={payLoading}
                    className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {payLoading ? "…" : "Enregistrer"}
                  </button>
                </form>
              )}
            </div>
          )}

          {detail.avoirs?.length > 0 && (
            <div className={cardInner}>
              <h4 className={`font-medium text-sm mb-2 ${textSecondary}`}>Avoirs émis</h4>
              <ul className="space-y-2">
                {detail.avoirs.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className={textSecondary}>
                      {a.numero} — {formatFCFAShort(a.montantTTC)}
                      {a.motif ? ` · ${a.motif}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAvoirPdf(a.id, a.numero)}
                      className={`text-xs ${linkAccent}`}
                    >
                      PDF
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.conditions && (
            <div className={cardInner}>
              <p className={`text-xs ${textMuted} mb-1`}>Conditions</p>
              <p className={`text-sm ${textSecondary} whitespace-pre-line`}>{detail.conditions}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className={`text-sm font-medium ${textSecondary}`}>Statut</label>
            <select
              value={detail.statut}
              onChange={(ev) => handleStatutChange(ev.target.value)}
              className={`text-sm border border-gray-200 dark:border-gray-500 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 ${textPrimary}`}
            >
              {["Brouillon", "Envoyée", "Partiellement payée", "Payée", "Impayée", "Annulée"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {!detail.verrouillee && detail.statut === "Brouillon" && (
              <button
                type="button"
                onClick={handleValider}
                className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg"
              >
                Valider & verrouiller
              </button>
            )}
            {(f.resteDu ?? 0) > 0.01 && detail.statut !== "Annulée" && (
              <button
                type="button"
                onClick={handleAvoir}
                disabled={avoirLoading}
                className="text-sm px-3 py-1.5 border border-amber-500 text-amber-700 dark:text-amber-400 rounded-lg disabled:opacity-50"
              >
                {avoirLoading ? "…" : "Émettre un avoir"}
              </button>
            )}
            <div className="flex gap-2 ml-auto flex-wrap">
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
              <button
                onClick={handleWhatsApp}
                className="text-sm flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
              >
                <Send className="w-4 h-4" /> WhatsApp
              </button>
              <button onClick={() => onEdit(detail)} className={`text-sm ${linkAccent}`}>
                Modifier →
              </button>
            </div>
          </div>

          <p className={`text-xs ${textFaint}`}>
            Émise le {formatDate(detail.dateEmission || detail.date)}
            {e.dateEcheance && ` · Échéance le ${formatDate(e.dateEcheance)}`}
            {e.datePaiement && ` · Payée le ${formatDate(e.datePaiement)}`}
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

export default function Factures() {
  const [stats, setStats] = useState(null);
  const [factureList, setFactureList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editFacture, setEditFacture] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("Tous");
  const [relanceLoading, setRelanceLoading] = useState(false);
  const [relanceMsg, setRelanceMsg] = useState("");
  const [alertes, setAlertes] = useState([]);
  const [listMode, setListMode] = useState("tous");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/facture/overview");
      setStats(res.data.stats);
      setFactureList(res.data.items || []);
      setAlertes(res.data.alertes || []);
      setError("");
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await api.get("/facture");
        const items = fallback.data || [];
        setFactureList(items);
        setStats({
          total: items.length,
          brouillons: items.filter((f) => f.statut === "Brouillon").length,
          envoyees: items.filter((f) => f.statut === "Envoyée").length,
          payees: items.filter((f) => f.statut === "Payée").length,
          impayees: items.filter((f) => f.statut === "Impayée").length,
          encaisse: items.filter((f) => f.statut === "Payée").reduce((s, f) => s + (f.montantTTC || 0), 0),
          impayeMontant: items.filter((f) => f.statut === "Impayée").reduce((s, f) => s + (f.montantTTC || 0), 0),
          echeanceProche: 0,
          tauxEncaissement: 0,
        });
        setError("");
      } else {
        setError(err.response?.data?.error || "Erreur lors du chargement des factures");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (loading || !factureList.length) return;
    const id = sessionStorage.getItem("btpia_nav_facture");
    if (!id) return;
    sessionStorage.removeItem("btpia_nav_facture");
    if (factureList.some((f) => (f.id || f._id) === id)) setSelectedId(id);
  }, [loading, factureList]);

  const filtered = useMemo(() => {
    let list = factureList;
    if (filterStatut !== "Tous") list = list.filter((f) => f.statut === filterStatut);
    if (listMode === "encaisser") {
      list = list.filter(
        (f) => f.resteDu > 0 && !["Brouillon", "Annulée", "Payée"].includes(f.statut)
      );
    }
    if (listMode === "retard") list = list.filter((f) => f.enRetard);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.numero?.toLowerCase().includes(q) ||
          f.client?.toLowerCase().includes(q) ||
          f.chantier?.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [factureList, filterStatut, listMode, search]);

  const handleDelete = async (id) => {
    if (!confirm("Supprimer cette facture ?")) return;
    await api.delete(`/facture/${id}`);
    if (selectedId === id) setSelectedId(null);
    load();
  };

  const handleStatutChange = async (id, statut) => {
    await api.put(`/facture/${id}`, { statut });
    load();
  };

  const openEdit = async (f) => {
    const id = f._id || f.id;
    try {
      if (id && !f.lignes?.length) {
        const res = await api.get(`/facture/${id}/detail`);
        setEditFacture(res.data);
      } else {
        setEditFacture(f);
      }
    } catch {
      setEditFacture(f);
    }
    setShowForm(true);
    setSelectedId(null);
  };

  const handlePDF = (id, numero) => downloadFile(`/facture/${id}/pdf`, `facture_${numero || id}.pdf`);

  const handleEmail = async (id, clientEmail) => {
    try {
      const res = await api.post(`/facture/${id}/email`, clientEmail ? { email: clientEmail } : {});
      alert(res.data.message || "Facture envoyée par email.");
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Envoi email impossible");
    }
  };

  const handleWhatsApp = async (id) => {
    try {
      const res = await api.get(`/facture/${id}/whatsapp`);
      const url = res.data.url || res.data.whatsappUrl;
      if (!url) throw new Error("Lien WhatsApp indisponible");
      window.open(url, "_blank");
    } catch (err) {
      alert(err.response?.data?.error || "WhatsApp impossible");
    }
  };

  const handleRelances = async () => {
    if (!confirm("Envoyer des relances pour toutes les factures impayées ?")) return;
    setRelanceLoading(true);
    setRelanceMsg("");
    try {
      const res = await api.post("/facture/relances");
      const sent = res.data?.results?.filter((r) => r.status === "sent")?.length ?? 0;
      setRelanceMsg(res.data?.message || `${sent} relance(s) envoyée(s).`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Erreur lors des relances");
    } finally {
      setRelanceLoading(false);
    }
  };

  const handleExportComptable = () =>
    downloadFile("/facture/export/comptable", `export_comptable_${new Date().toISOString().slice(0, 10)}.csv`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Factures</h2>
          <p className={pageSubtitle}>Facturation clients, encaissements et suivi des échéances</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${filterChipIdle}`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
          <button
            type="button"
            onClick={goToTresorerie}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${filterChipIdle}`}
          >
            <PiggyBank className="w-4 h-4" /> Trésorerie
          </button>
          <button
            type="button"
            onClick={handleExportComptable}
            className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <FileDown className="w-4 h-4" />
            Export comptable
          </button>
          <button
            type="button"
            onClick={handleRelances}
            disabled={relanceLoading}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Send className="w-4 h-4" />
            {relanceLoading ? "Envoi…" : "Relancer impayées"}
          </button>
          <button
            onClick={() => {
              setEditFacture(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle facture
          </button>
        </div>
      </div>

      {relanceMsg && (
        <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
          {relanceMsg}
        </p>
      )}

      {alertes.map((a, i) => (
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
            <span><strong>{a.titre}</strong> — {a.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setListMode(a.type === "critical" ? "retard" : "encaisser")}
            className={`shrink-0 text-xs ${linkAccent} flex items-center gap-1`}
          >
            Voir <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      ))}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: "Total factures", value: stats.total, icon: Receipt },
            { label: "Brouillons", value: stats.brouillons },
            { label: "Envoyées", value: stats.envoyees },
            { label: "Payées", value: stats.payees, icon: CheckCircle },
            { label: "Partielles", value: stats.partial ?? 0, warn: (stats.partial ?? 0) > 0 },
            { label: "Impayées", value: stats.impayees, warn: stats.impayees > 0 },
            { label: "En retard", value: stats.enRetard ?? 0, warn: (stats.enRetard ?? 0) > 0 },
            { label: "Encaissé", value: formatFCFAShort(stats.encaisse), icon: Banknote },
            { label: "Créances", value: formatFCFAShort(stats.creancesTotal ?? stats.impayeMontant), warn: (stats.creancesTotal ?? stats.impayeMontant) > 0 },
            { label: "À encaisser", value: stats.aEncaisser ?? 0 },
            { label: "Taux encaissement", value: `${stats.tauxEncaissement}%`, icon: TrendingUp },
          ].map((k) => (
            <div key={k.label} className={`${card} p-4`}>
              <p className={kpiLabel}>{k.label}</p>
              <p className={`${kpiValue} ${k.warn ? "text-red-600 dark:text-red-400" : ""}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {[
          { id: "tous", label: "Toutes" },
          { id: "encaisser", label: "À encaisser" },
          { id: "retard", label: "En retard" },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setListMode(m.id)}
            className={listMode === m.id ? filterChipActive : filterChipIdle}
          >
            {m.label}
          </button>
        ))}
        <span className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1" />
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

      <FactureForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditFacture(null);
        }}
        facture={editFacture}
        onSaved={load}
      />

      {loading ? (
        <p className={textMuted}>Chargement...</p>
      ) : error ? (
        <p className="text-red-600 dark:text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 ${card}`}>
          <Receipt className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className={textMuted}>Aucune facture trouvée.</p>
          <button onClick={() => setShowForm(true)} className={`mt-3 text-sm ${linkAccent}`}>
            Créer votre première facture
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((f) => {
            const id = f._id || f.id;
            const enRetard = f.joursRetard != null && f.joursRetard > 0;
            const echeanceProche =
              !enRetard &&
              f.statut !== "Payée" &&
              f.statut !== "Annulée" &&
              f.dateEcheance &&
              f.joursRetard == null;

            return (
              <div key={id} className={`${card} hover:shadow-md transition overflow-hidden`}>
                <div className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statutBadge[f.statut] || ""}`}>
                          {f.statut}
                        </span>
                        <span className={`text-xs font-mono ${textFaint}`}>{f.numero}</span>
                      </div>
                      <h3 className={`font-semibold mt-2 truncate ${textPrimary}`}>{f.client}</h3>
                      {f.chantier && (
                        <p className={`text-sm ${textMuted} flex items-center gap-1`}>
                          <Building2 className="w-3 h-3" /> {f.chantier}
                        </p>
                      )}
                      <p className={`text-xs ${textFaint} mt-1 flex items-center gap-1`}>
                        <Clock className="w-3 h-3" /> {formatDate(f.date || f.dateEmission)}
                        {f.dateEcheance && (
                          <span className={enRetard ? "text-red-500" : ""}>
                            · Échéance {formatDate(f.dateEcheance)}
                          </span>
                        )}
                        {enRetard && (
                          <span className="text-red-500 font-medium">· {f.joursRetard}j de retard</span>
                        )}
                      </p>
                    </div>
                    {(enRetard || echeanceProche) && (
                      <AlertTriangle
                        className={`w-5 h-5 shrink-0 ${enRetard ? "text-red-500" : "text-amber-500"}`}
                      />
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className={cardInner}>
                      <p className={textMuted}>Montant TTC</p>
                      <p className={`${amountDefault} text-emerald-600 dark:text-emerald-400`}>
                        {formatFCFAShort(f.montantTTC)}
                      </p>
                    </div>
                    <div className={cardInner}>
                      <p className={textMuted}>{f.resteDu > 0 ? "Reste dû" : "Encaissé"}</p>
                      <p className={`${amountDefault} ${f.resteDu > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {f.resteDu > 0 ? formatFCFAShort(f.resteDu) : formatFCFAShort(f.montantVerse || f.montantTTC)}
                      </p>
                      {f.montantVerse > 0 && f.resteDu > 0 && (
                        <p className={`text-[10px] ${textMuted}`}>Versé {formatFCFAShort(f.montantVerse)}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`${cardFooter.replace("flex items-center justify-between", "space-y-2")}`}>
                  {!["Brouillon", "Annulée", "Payée"].includes(f.statut) && (
                    <QuickPayBlock factureId={id} resteDu={f.resteDu} onDone={load} />
                  )}
                  <select
                    value={f.statut}
                    onChange={(e) => handleStatutChange(id, e.target.value)}
                    className={`text-xs border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 ${textPrimary}`}
                  >
                    {["Brouillon", "Envoyée", "Partiellement payée", "Payée", "Impayée", "Annulée"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <button
                      onClick={() => handlePDF(id, f.numero)}
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
                    <button
                      onClick={() => openEdit(f)}
                      className="p-1 text-gray-600 dark:text-gray-300 hover:text-emerald-600"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setSelectedId(id)} className={`text-xs ${linkAccent} flex items-center gap-0.5`}>
                      Détails <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(id)}
                      className="p-1 text-red-600 dark:text-red-400"
                      title="Supprimer"
                    >
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
        <FactureDetail
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={load}
          onEdit={(d) => openEdit(d)}
        />
      )}
    </div>
  );
}
