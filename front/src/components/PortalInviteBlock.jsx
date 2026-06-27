import { useState } from "react";
import api from "../lib/api";
import { LayoutGrid, Mail, CheckCircle2 } from "lucide-react";
import { linkAccent, textMuted, textPrimary } from "../lib/uiClasses";

const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100";

export default function PortalInviteBlock({
  clientId,
  clientEmail,
  portalAccess,
  onSuccess,
}) {
  const [email, setEmail] = useState(clientEmail || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const payload = { clientId, email: email.trim() };
      if (password.trim()) payload.motDePasse = password.trim();
      const res = await api.post("/user/link-client", payload);
      const temp = res.data.motDePasseTemporaire;
      setMsg(
        res.data.emailSent
          ? res.data.message || "Invitation envoyée par email."
          : temp
            ? `${res.data.message} Mot de passe temporaire : ${temp}`
            : res.data.message || "Portail activé."
      );
      setPassword("");
      onSuccess?.();
    } catch (e) {
      setErr(e.response?.data?.error || "Activation impossible");
    } finally {
      setLoading(false);
    }
  };

  if (portalAccess?.active) {
    return (
      <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 space-y-2">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className={`font-medium text-sm ${textPrimary}`}>Portail propriétaire actif</p>
            <p className={`text-sm ${textMuted} flex items-center gap-1 mt-1`}>
              <Mail className="w-3.5 h-3.5" /> {portalAccess.email}
            </p>
            {portalAccess.nom && (
              <p className={`text-xs ${textMuted} mt-0.5`}>{portalAccess.nom}</p>
            )}
          </div>
        </div>
        <a href="#/acces" className={`text-sm ${linkAccent}`}>Gérer les accès →</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 space-y-3">
      <div className="flex items-center gap-2">
        <LayoutGrid className="w-5 h-5 text-emerald-600" />
        <h4 className={`font-medium text-sm ${textPrimary}`}>Activer le portail propriétaire</h4>
      </div>
      <p className={`text-xs ${textMuted}`}>
        Le propriétaire recevra un email avec un lien pour choisir son mot de passe et accéder à « Mon chantier ».
      </p>
      <input
        type="email"
        required
        placeholder="Email de connexion *"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputCls}
      />
      <input
        type="password"
        placeholder="Mot de passe (optionnel)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputCls}
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
      >
        {loading ? "Envoi…" : "Envoyer l'invitation"}
      </button>
      {msg && (
        <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
          {msg}
        </p>
      )}
      {err && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {err}
        </p>
      )}
    </form>
  );
}
