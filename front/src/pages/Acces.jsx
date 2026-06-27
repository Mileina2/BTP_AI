import { useEffect, useState } from "react";
import api from "../lib/api";
import { ROLE_LABELS } from "../config/navByRole";
import {
  pageTitle,
  pageSubtitle,
  card,
  cardInner,
  textPrimary,
  textSecondary,
  textMuted,
} from "../lib/uiClasses";
import {
  UsersRound,
  UserPlus,
  Link2,
  HardHat,
  LayoutGrid,
  History,
  Mail,
} from "lucide-react";

const ROLE_BADGE = {
  ENTREPRENEUR: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  CHEF_CHANTIER: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  CLIENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100";

export default function Acces() {
  const [team, setTeam] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [clients, setClients] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [chefForm, setChefForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    motDePasse: "",
    chantierId: "",
  });
  const [clientForm, setClientForm] = useState({
    clientId: "",
    email: "",
    motDePasse: "",
  });
  const [chefLoading, setChefLoading] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [chefSuccess, setChefSuccess] = useState("");
  const [clientSuccess, setClientSuccess] = useState("");
  const [formError, setFormError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [teamRes, chantierRes, clientRes, auditRes] = await Promise.all([
        api.get("/user/team"),
        api.get("/chantier"),
        api.get("/client"),
        api.get("/user/audit"),
      ]);
      setTeam(teamRes.data || []);
      setChantiers(chantierRes.data?.items || chantierRes.data || []);
      setClients(clientRes.data || []);
      setAuditLogs((auditRes.data || []).slice(0, 20));
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleChefChange = (e) => setChefForm({ ...chefForm, [e.target.name]: e.target.value });
  const handleClientChange = (e) => setClientForm({ ...clientForm, [e.target.name]: e.target.value });

  const submitChef = async (e) => {
    e.preventDefault();
    setChefLoading(true);
    setFormError("");
    setChefSuccess("");
    try {
      const payload = {
        nom: chefForm.nom.trim(),
        prenom: chefForm.prenom.trim(),
        email: chefForm.email.trim(),
        chantierId: chefForm.chantierId || undefined,
      };
      if (chefForm.motDePasse.trim()) payload.motDePasse = chefForm.motDePasse;
      const res = await api.post("/user/invite-chef", payload);
      const temp = res.data.motDePasseTemporaire;
      setChefSuccess(
        res.data.emailSent
          ? res.data.message || "Invitation envoyée par email au chef de chantier."
          : temp
            ? `${res.data.message} Mot de passe temporaire : ${temp}`
            : res.data.message || "Chef de chantier invité."
      );
      setChefForm({ nom: "", prenom: "", email: "", motDePasse: "", chantierId: "" });
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || "Invitation impossible");
    } finally {
      setChefLoading(false);
    }
  };

  const submitClient = async (e) => {
    e.preventDefault();
    setClientLoading(true);
    setFormError("");
    setClientSuccess("");
    try {
      const payload = {
        clientId: clientForm.clientId,
        email: clientForm.email.trim(),
      };
      if (clientForm.motDePasse.trim()) payload.motDePasse = clientForm.motDePasse;
      const res = await api.post("/user/link-client", payload);
      const temp = res.data.motDePasseTemporaire;
      setClientSuccess(
        res.data.emailSent
          ? res.data.message || "Invitation envoyée par email au propriétaire."
          : temp
            ? `${res.data.message} Mot de passe temporaire : ${temp}`
            : res.data.message || "Portail propriétaire activé."
      );
      setClientForm({ clientId: "", email: "", motDePasse: "" });
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || "Liaison impossible");
    } finally {
      setClientLoading(false);
    }
  };

  const onClientSelect = (clientId) => {
    const c = clients.find((cl) => (cl.id || cl._id) === clientId);
    setClientForm((prev) => ({
      ...prev,
      clientId,
      email: c?.email || prev.email,
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Accès & équipe</h2>
        <p className={pageSubtitle}>
          Inviter des chefs de chantier, activer le portail propriétaire et consulter l&apos;historique
        </p>
      </div>

      {loading ? (
        <p className={textMuted}>Chargement…</p>
      ) : error ? (
        <p className="text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <>
          <div className={`${card} p-5`}>
            <h3 className={`font-semibold flex items-center gap-2 mb-4 ${textPrimary}`}>
              <UsersRound className="w-5 h-5 text-blue-600" /> Membres de l&apos;équipe
            </h3>
            {team.length === 0 ? (
              <p className={`text-sm ${textMuted}`}>Aucun utilisateur enregistré.</p>
            ) : (
              <ul className="space-y-2">
                {team.map((u) => {
                  const id = u.id || u._id;
                  return (
                    <li key={id} className={`${cardInner} p-3 flex flex-wrap items-center justify-between gap-2`}>
                      <div>
                        <p className={`font-medium text-sm ${textPrimary}`}>
                          {[u.prenom, u.nom].filter(Boolean).join(" ") || u.email}
                        </p>
                        <p className={`text-xs ${textMuted} flex items-center gap-1 mt-0.5`}>
                          <Mail className="w-3 h-3" /> {u.email}
                        </p>
                        {u.chantiersAssigned?.length > 0 && (
                          <p className={`text-xs ${textMuted} mt-1`}>
                            Chantiers : {u.chantiersAssigned.map((c) => c.nom).join(", ")}
                          </p>
                        )}
                        {u.clientProfile && (
                          <p className={`text-xs ${textMuted} mt-1`}>Client lié : {u.clientProfile.nom}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] || ""}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <form onSubmit={submitChef} className={`${card} p-5 space-y-3`}>
              <h3 className={`font-semibold flex items-center gap-2 ${textPrimary}`}>
                <UserPlus className="w-5 h-5 text-amber-600" /> Inviter un chef de chantier
              </h3>
              <input
                name="nom"
                placeholder="Nom *"
                value={chefForm.nom}
                onChange={handleChefChange}
                required
                className={inputCls}
              />
              <input
                name="prenom"
                placeholder="Prénom *"
                value={chefForm.prenom}
                onChange={handleChefChange}
                required
                className={inputCls}
              />
              <input
                name="email"
                type="email"
                placeholder="Email *"
                value={chefForm.email}
                onChange={handleChefChange}
                required
                className={inputCls}
              />
              <input
                name="motDePasse"
                type="password"
                placeholder="Mot de passe (optionnel)"
                value={chefForm.motDePasse}
                onChange={handleChefChange}
                className={inputCls}
              />
              <select
                name="chantierId"
                value={chefForm.chantierId}
                onChange={handleChefChange}
                className={inputCls}
              >
                <option value="">Chantier à assigner (optionnel)</option>
                {chantiers.map((c) => {
                  const cid = c.id || c._id;
                  return (
                    <option key={cid} value={cid}>
                      {c.nom}
                    </option>
                  );
                })}
              </select>
              <button
                type="submit"
                disabled={chefLoading}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                <HardHat className="w-4 h-4" />
                {chefLoading ? "Envoi…" : "Inviter le chef"}
              </button>
              {chefSuccess && (
                <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                  {chefSuccess}
                </p>
              )}
            </form>

            <form onSubmit={submitClient} className={`${card} p-5 space-y-3`}>
              <h3 className={`font-semibold flex items-center gap-2 ${textPrimary}`}>
                <Link2 className="w-5 h-5 text-emerald-600" /> Lier le portail propriétaire
              </h3>
              <select
                name="clientId"
                value={clientForm.clientId}
                onChange={(e) => onClientSelect(e.target.value)}
                required
                className={inputCls}
              >
                <option value="">Client *</option>
                {clients.map((c) => {
                  const cid = c.id || c._id;
                  return (
                    <option key={cid} value={cid}>
                      {c.nom}
                    </option>
                  );
                })}
              </select>
              <input
                name="email"
                type="email"
                placeholder="Email de connexion *"
                value={clientForm.email}
                onChange={handleClientChange}
                required
                className={inputCls}
              />
              <input
                name="motDePasse"
                type="password"
                placeholder="Mot de passe (optionnel)"
                value={clientForm.motDePasse}
                onChange={handleClientChange}
                className={inputCls}
              />
              <button
                type="submit"
                disabled={clientLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                <LayoutGrid className="w-4 h-4" />
                {clientLoading ? "Liaison…" : "Activer le portail"}
              </button>
              {clientSuccess && (
                <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                  {clientSuccess}
                </p>
              )}
            </form>
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {formError}
            </p>
          )}

          <div className={`${card} p-5`}>
            <h3 className={`font-semibold flex items-center gap-2 mb-4 ${textPrimary}`}>
              <History className="w-5 h-5 text-slate-500" /> Journal d&apos;audit (20 derniers)
            </h3>
            {auditLogs.length === 0 ? (
              <p className={`text-sm ${textMuted}`}>Aucune activité enregistrée.</p>
            ) : (
              <ul className="space-y-2">
                {auditLogs.map((log) => (
                  <li key={log.id} className={`${cardInner} p-3 text-sm`}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className={`font-medium ${textPrimary}`}>{log.action}</span>
                      <span className={`text-xs ${textMuted}`}>{formatDate(log.createdAt)}</span>
                    </div>
                    <p className={`text-xs ${textSecondary} mt-1`}>
                      {log.user
                        ? `${log.user.prenom || ""} ${log.user.nom || ""}`.trim() || log.user.email
                        : "Système"}
                      {log.entity && ` · ${log.entity}`}
                      {log.details && ` · ${log.details}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
