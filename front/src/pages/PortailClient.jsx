import { useEffect, useState } from "react";

import api, { downloadFile } from "../lib/api";
import SignaturePad from "../components/SignaturePad";

import { formatFCFAShort } from "../lib/format";

import {

  pageTitle,

  pageSubtitle,

  card,

  cardInner,

  textPrimary,

  textMuted,

  btnGhost,

  actionBtnGreen,

  actionBtnBlue,

  kpiValue,

  kpiLabel,

} from "../lib/uiClasses";

import {

  Building2,

  Calendar,

  MapPin,

  MessageSquare,

  FolderOpen,

  ExternalLink,

  FileText,

  Receipt,

  FileDown,

  CheckCircle,

  X,

} from "lucide-react";



function formatDate(d) {

  if (!d) return "—";

  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

}



function ProgressBar({ value }) {

  const pct = Math.min(100, Math.max(0, value));

  return (

    <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">

      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />

    </div>

  );

}



const devisBadge = {

  "En attente": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",

  "Envoyé": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",

  "Accepté": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",

  "Refusé": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",

};



const factureBadge = {

  Brouillon: "bg-gray-100 text-gray-800 dark:bg-gray-700/60 dark:text-gray-200",

  Envoyée: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",

  Payée: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",

  Impayée: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",

  Annulée: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",

};



export default function PortailClient() {

  const [chantiers, setChantiers] = useState([]);

  const [selectedId, setSelectedId] = useState(null);

  const [detail, setDetail] = useState(null);

  const [timeline, setTimeline] = useState([]);

  const [documents, setDocuments] = useState([]);

  const [portalStats, setPortalStats] = useState(null);

  const [portalDevis, setPortalDevis] = useState([]);

  const [portalFactures, setPortalFactures] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [acceptingId, setAcceptingId] = useState(null);

  const [signatureNom, setSignatureNom] = useState("");

  const [clientSignature, setClientSignature] = useState("");

  const [acceptMsg, setAcceptMsg] = useState("");

  const [refusingId, setRefusingId] = useState(null);

  const [refuseMotif, setRefuseMotif] = useState("");



  useEffect(() => {

    Promise.all([

      api.get("/chantier"),

      api.get("/portal/stats").catch(() => ({ data: null })),

      api.get("/portal/devis").catch(() => ({ data: [] })),

      api.get("/portal/factures").catch(() => ({ data: [] })),

    ])

      .then(([chantierRes, statsRes, devisRes, facturesRes]) => {

        const items = chantierRes.data.items || [];

        setChantiers(items);

        if (items.length) setSelectedId(items[0].id || items[0]._id);

        setPortalStats(statsRes.data);

        setPortalDevis(devisRes.data || []);

        setPortalFactures(facturesRes.data || []);

      })

      .catch(() => setError("Impossible de charger vos chantiers"))

      .finally(() => setLoading(false));

  }, []);



  useEffect(() => {

    if (!selectedId) return;

    setDetail(null);

    Promise.all([

      api.get(`/chantier/${selectedId}/detail`),

      api.get(`/chantier/${selectedId}/timeline`),

      api.get(`/chantier/${selectedId}/documents`),

    ])

      .then(([dRes, tRes, docRes]) => {

        setDetail(dRes.data);

        setTimeline(tRes.data.items || []);

        setDocuments(docRes.data.items || []);

      })

      .catch(() => setError("Erreur de chargement du chantier"));

  }, [selectedId]);



  const handleAcceptDevis = async (devisId) => {

    const nom = signatureNom.trim();

    if (!nom) {

      alert("Veuillez saisir votre nom pour accepter le devis.");

      return;

    }

    setAcceptingId(devisId);

    setAcceptMsg("");

    try {

      const res = await api.post(`/portal/devis/${devisId}/accepter`, { signatureNom: nom, signatureData: clientSignature || undefined });

      setAcceptMsg(res.data.message || "Devis accepté.");

      const devisRes = await api.get("/portal/devis");

      setPortalDevis(devisRes.data || []);

      setAcceptingId(null);

      setClientSignature("");

    } catch (err) {

      alert(err.response?.data?.error || "Acceptation impossible");

      setAcceptingId(null);

    }

  };



  const handleRefuseDevis = async (devisId) => {

    if (!confirm("Refuser ce devis ? L'entrepreneur sera notifié par email.")) return;

    setRefusingId(devisId);

    setAcceptMsg("");

    try {

      const res = await api.post(`/portal/devis/${devisId}/refuser`, {

        motif: refuseMotif.trim() || undefined,

      });

      setAcceptMsg(res.data.message || "Devis refusé.");

      const devisRes = await api.get("/portal/devis");

      setPortalDevis(devisRes.data || []);

      setRefusingId(null);

      setRefuseMotif("");

    } catch (err) {

      alert(err.response?.data?.error || "Refus impossible");

      setRefusingId(null);

    }

  };



  const refreshPortalFinance = async () => {

    const [devisRes, facturesRes] = await Promise.all([

      api.get("/portal/devis"),

      api.get("/portal/factures"),

    ]);

    setPortalDevis(devisRes.data || []);

    setPortalFactures(facturesRes.data || []);

  };



  if (loading) return <p className={textMuted}>Chargement…</p>;

  if (error) return <p className="text-red-600">{error}</p>;



  if (!chantiers.length) {

    return (

      <div className="text-center py-16">

        <Building2 className="w-12 h-12 mx-auto text-slate-400 mb-4" />

        <h2 className={pageTitle}>Portail propriétaire</h2>

        <p className={textMuted}>Aucun chantier associé à votre compte pour le moment.</p>

      </div>

    );

  }



  const avancement =

    portalStats?.moyenneAvancement ?? detail?.indicateurs?.avancementPhysique ?? 0;



  return (

    <div className="space-y-6 max-w-4xl">

      <div>

        <h2 className={pageTitle}>Mon chantier</h2>

        <p className={pageSubtitle}>Suivi d&apos;avancement, devis, factures et documents partagés</p>

      </div>



      {portalStats && (

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          <div className={`${card} p-4`}>

            <p className={kpiLabel}>Chantiers</p>

            <p className={kpiValue}>{portalStats.chantiers?.length ?? chantiers.length}</p>

          </div>

          <div className={`${card} p-4`}>

            <p className={kpiLabel}>Avancement moyen</p>

            <p className={kpiValue}>{avancement}%</p>

          </div>

          <div className={`${card} p-4`}>

            <p className={kpiLabel}>Devis</p>

            <p className={kpiValue}>{portalDevis.length}</p>

          </div>

          <div className={`${card} p-4`}>

            <p className={kpiLabel}>Factures</p>

            <p className={kpiValue}>{portalFactures.length}</p>

          </div>

        </div>

      )}



      {acceptMsg && (

        <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">

          {acceptMsg}

        </p>

      )}



      <div className={`${card} p-5`}>

        <h3 className={`font-semibold flex items-center gap-2 mb-4 ${textPrimary}`}>

          <FileText className="w-5 h-5 text-blue-600" /> Mes devis

        </h3>

        {portalDevis.length === 0 ? (

          <p className={`text-sm ${textMuted}`}>Aucun devis disponible.</p>

        ) : (

          <ul className="space-y-3">

            {portalDevis.map((d) => {

              const id = d.id || d._id;

              const canAccept = d.statut === "Envoyé" || d.statut === "En attente";

              return (

                <li key={id} className={`${cardInner} p-4`}>

                  <div className="flex flex-wrap justify-between gap-2 items-start">

                    <div>

                      <div className="flex items-center gap-2 flex-wrap">

                        <span className={`text-xs px-2 py-0.5 rounded-full ${devisBadge[d.statut] || ""}`}>

                          {d.statut}

                        </span>

                        <span className={`text-xs font-mono ${textMuted}`}>{d.numero}</span>

                      </div>

                      {d.chantier && <p className={`text-sm ${textMuted} mt-1`}>{d.chantier}</p>}

                      <p className={`font-semibold mt-1 ${textPrimary}`}>

                        {formatFCFAShort(d.montantTTC)} TTC

                      </p>

                      <p className={`text-xs ${textMuted}`}>{formatDate(d.dateEmission)}</p>

                    </div>

                    <div className="flex flex-wrap gap-2">

                      <button

                        type="button"

                        onClick={() => downloadFile(`/portal/devis/${id}/pdf`, `devis_${d.numero || id}.pdf`)}

                        className={actionBtnBlue}

                      >

                        <FileDown className="w-3.5 h-3.5" /> PDF

                      </button>

                      {canAccept && acceptingId !== id && refusingId !== id && (

                        <button

                          type="button"

                          onClick={() => setAcceptingId(id)}

                          className={actionBtnGreen}

                        >

                          <CheckCircle className="w-3.5 h-3.5" /> Accepter

                        </button>

                      )}

                      {canAccept && acceptingId !== id && refusingId !== id && (

                        <button

                          type="button"

                          onClick={() => setRefusingId(id)}

                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50"

                        >

                          <X className="w-3.5 h-3.5" /> Refuser

                        </button>

                      )}

                    </div>

                  </div>

                  {acceptingId === id && (

                    <div className="mt-3 space-y-3 border-t border-gray-200 dark:border-gray-600 pt-3">

                      <input

                        type="text"

                        placeholder="Votre nom (signature)"

                        value={signatureNom}

                        onChange={(e) => setSignatureNom(e.target.value)}

                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"

                      />

                      <div>

                        <p className={`text-xs mb-1 ${textMuted}`}>Signature « Bon pour accord »</p>

                        <SignaturePad value={clientSignature} onChange={setClientSignature} />

                      </div>

                      <div className="flex flex-wrap gap-2">

                      <button

                        type="button"

                        onClick={() => handleAcceptDevis(id)}

                        className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"

                      >

                        Confirmer

                      </button>

                      <button

                        type="button"

                        onClick={() => { setAcceptingId(null); setClientSignature(""); }}

                        className={`text-sm ${btnGhost}`}

                      >

                        Annuler

                      </button>

                      </div>

                    </div>

                  )}

                  {refusingId === id && (

                    <div className="mt-3 flex flex-wrap gap-2 items-end border-t border-gray-200 dark:border-gray-600 pt-3">

                      <input

                        type="text"

                        placeholder="Motif du refus (optionnel)"

                        value={refuseMotif}

                        onChange={(e) => setRefuseMotif(e.target.value)}

                        className="flex-1 min-w-[180px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"

                      />

                      <button

                        type="button"

                        onClick={() => handleRefuseDevis(id)}

                        className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"

                      >

                        Confirmer le refus

                      </button>

                      <button

                        type="button"

                        onClick={() => { setRefusingId(null); setRefuseMotif(""); }}

                        className={`text-sm ${btnGhost}`}

                      >

                        Annuler

                      </button>

                    </div>

                  )}

                </li>

              );

            })}

          </ul>

        )}

      </div>



      <div className={`${card} p-5`}>

        <h3 className={`font-semibold flex items-center gap-2 mb-4 ${textPrimary}`}>

          <Receipt className="w-5 h-5 text-emerald-600" /> Mes factures

        </h3>

        {portalFactures.length === 0 ? (

          <p className={`text-sm ${textMuted}`}>Aucune facture disponible.</p>

        ) : (

          <ul className="space-y-3">

            {portalFactures.map((f) => {

              const id = f.id || f._id;

              return (

                <li key={id} className={`${cardInner} p-4 flex flex-wrap justify-between gap-2 items-center`}>

                  <div>

                    <div className="flex items-center gap-2 flex-wrap">

                      <span className={`text-xs px-2 py-0.5 rounded-full ${factureBadge[f.statut] || ""}`}>

                        {f.statut}

                      </span>

                      <span className={`text-xs font-mono ${textMuted}`}>{f.numero}</span>

                    </div>

                    {f.chantier && <p className={`text-sm ${textMuted} mt-1`}>{f.chantier}</p>}

                    <p className={`font-semibold mt-1 ${textPrimary}`}>

                      {formatFCFAShort(f.montantTTC)} TTC

                    </p>

                    <p className={`text-xs ${textMuted}`}>

                      {formatDate(f.dateEmission)}

                      {f.dateEcheance && ` · Échéance ${formatDate(f.dateEcheance)}`}

                    </p>

                  </div>

                  <button

                    type="button"

                    onClick={() => downloadFile(`/portal/factures/${id}/pdf`, `facture_${f.numero || id}.pdf`)}

                    className={actionBtnBlue}

                  >

                    <FileDown className="w-3.5 h-3.5" /> PDF

                  </button>

                </li>

              );

            })}

          </ul>

        )}

        <button type="button" onClick={refreshPortalFinance} className={`mt-3 text-xs ${btnGhost}`}>

          Actualiser devis & factures

        </button>

      </div>



      {chantiers.length > 1 && (

        <div className="flex flex-wrap gap-2">

          {chantiers.map((c) => {

            const id = c.id || c._id;

            return (

              <button

                key={id}

                type="button"

                onClick={() => setSelectedId(id)}

                className={`px-3 py-1.5 rounded-lg text-sm ${

                  selectedId === id ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800"

                }`}

              >

                {c.nom}

              </button>

            );

          })}

        </div>

      )}



      {detail && (

        <div className={`${card} p-6 space-y-6`}>

          <div>

            <h3 className="text-xl font-semibold">{detail.nom}</h3>

            <p className={`text-sm ${textMuted} mt-1 flex items-center gap-2`}>

              <MapPin className="w-4 h-4" />

              {detail.ville || detail.adresse || "—"}

            </p>

            <p className={`text-sm ${textMuted} flex items-center gap-2 mt-1`}>

              <Calendar className="w-4 h-4" />

              {formatDate(detail.dateDebut)}

              {detail.dateFin ? ` → ${formatDate(detail.dateFin)}` : ""}

            </p>

            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">

              {detail.statut}

            </span>

          </div>



          <div>

            <div className="flex justify-between text-sm mb-2">

              <span className={textMuted}>Avancement physique</span>

              <span className="font-semibold">{detail.indicateurs?.avancementPhysique ?? 0}%</span>

            </div>

            <ProgressBar value={detail.indicateurs?.avancementPhysique ?? 0} />

          </div>



          {detail.description && (

            <p className={`text-sm ${textPrimary}`}>{detail.description}</p>

          )}



          {detail.rapports?.length > 0 && (

            <div>

              <h4 className="font-medium mb-3 flex items-center gap-2">

                <MessageSquare className="w-4 h-4" /> Rapports récents

              </h4>

              <ul className="space-y-2">

                {detail.rapports.map((r) => (

                  <li key={r.id} className={`${cardInner} p-3 text-sm`}>

                    <p className="font-medium">{formatDate(r.date)} — {r.avancement}%</p>

                    <p className={textMuted}>{r.travaux}</p>

                  </li>

                ))}

              </ul>

            </div>

          )}



          <div>

            <h4 className="font-medium mb-3 flex items-center gap-2">

              <MessageSquare className="w-4 h-4" /> Journal partagé

            </h4>

            {timeline.length === 0 ? (

              <p className={`text-sm ${textMuted}`}>Aucune note partagée pour le moment.</p>

            ) : (

              <ul className="space-y-2">

                {timeline.map((e) => (

                  <li key={e.id || e._id} className={`${cardInner} p-3 text-sm`}>

                    <p className="font-medium">{e.titre}</p>

                    <p className={`text-xs ${textMuted}`}>{e.auteur} · {formatDate(e.date)}</p>

                    {e.description && <p className="mt-1">{e.description}</p>}

                  </li>

                ))}

              </ul>

            )}

          </div>



          <div>

            <h4 className="font-medium mb-3 flex items-center gap-2">

              <FolderOpen className="w-4 h-4" /> Photos & documents

            </h4>

            {documents.length === 0 ? (

              <p className={`text-sm ${textMuted}`}>Aucun document partagé.</p>

            ) : (

              <ul className="grid sm:grid-cols-2 gap-2">

                {documents.map((doc) => (

                  <li key={doc.id || doc._id} className={`${cardInner} p-3 flex items-center justify-between gap-2`}>

                    <span className="text-sm truncate">{doc.nom}</span>

                    <a

                      href={doc.url}

                      target="_blank"

                      rel="noopener noreferrer"

                      className={btnGhost}

                    >

                      <ExternalLink className="w-4 h-4" />

                    </a>

                  </li>

                ))}

              </ul>

            )}

          </div>

        </div>

      )}

    </div>

  );

}


