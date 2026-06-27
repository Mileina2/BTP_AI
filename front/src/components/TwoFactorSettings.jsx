import { useEffect, useState } from "react";
import api from "../lib/api";
import { ShieldCheck, ShieldOff, Mail } from "lucide-react";
import { btnPrimary, btnOutlineBrand } from "../lib/brand";
import { card } from "../lib/uiClasses";

export default function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/auth/profil")
      .then((res) => setEnabled(Boolean(res.data?.twoFactorEnabled)))
      .catch(() => setError("Impossible de charger le statut 2FA"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const startEnable = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api.post("/auth/2fa/enable");
      setMessage(res.data?.message || "Code envoyé par email.");
      setStep("confirm-enable");
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'activation");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/2fa/enable/confirm", { code: code.trim() });
      setEnabled(true);
      setStep("idle");
      setCode("");
      setMessage("Double authentification activée.");
    } catch (err) {
      setError(err.response?.data?.error || "Code invalide");
    } finally {
      setBusy(false);
    }
  };

  const startDisable = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api.post("/auth/2fa/disable", { motDePasse: password });
      setMessage(res.data?.message || "Code envoyé par email.");
      setStep("confirm-disable");
    } catch (err) {
      setError(err.response?.data?.error || "Mot de passe incorrect");
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/2fa/disable/confirm", { code: code.trim() });
      setEnabled(false);
      setStep("idle");
      setCode("");
      setPassword("");
      setMessage("Double authentification désactivée.");
    } catch (err) {
      setError(err.response?.data?.error || "Code invalide");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={`${card} p-5 text-sm text-gray-500`}>Chargement sécurité…</div>
    );
  }

  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-brand-yellow-muted dark:bg-brand-slate">
          {enabled ? (
            <ShieldCheck className="w-5 h-5 text-green-700 dark:text-green-400" />
          ) : (
            <ShieldOff className="w-5 h-5 text-gray-500" />
          )}
        </div>
        <div>
          <h3 className="font-bold text-brand-ink dark:text-gray-100">Double authentification (2FA)</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Code à 6 chiffres envoyé par email à chaque connexion. Recommandé pour les comptes entrepreneur.
          </p>
          <p className="text-xs mt-2 font-semibold text-amber-800 dark:text-brand-yellow">
            Statut : {enabled ? "Activée" : "Désactivée"}
          </p>
        </div>
      </div>

      {message && (
        <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg flex items-center gap-2">
          <Mail className="w-4 h-4 shrink-0" /> {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
      )}

      {step === "idle" && !enabled && (
        <button type="button" onClick={startEnable} disabled={busy} className={btnPrimary}>
          Activer la 2FA par email
        </button>
      )}

      {step === "confirm-enable" && (
        <div className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Code à 6 chiffres"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full px-3 py-2.5 border rounded-lg dark:bg-gray-900 dark:border-gray-600 tracking-widest text-center text-lg"
          />
          <button type="button" onClick={confirmEnable} disabled={busy || code.length !== 6} className={btnPrimary}>
            Confirmer l&apos;activation
          </button>
          <button type="button" onClick={() => { setStep("idle"); setCode(""); }} className={btnOutlineBrand}>
            Annuler
          </button>
        </div>
      )}

      {step === "idle" && enabled && (
        <div className="space-y-3">
          <input
            type="password"
            placeholder="Mot de passe actuel"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 border rounded-lg dark:bg-gray-900 dark:border-gray-600"
          />
          <button type="button" onClick={startDisable} disabled={busy || !password} className={btnOutlineBrand}>
            Désactiver la 2FA
          </button>
        </div>
      )}

      {step === "confirm-disable" && (
        <div className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Code à 6 chiffres"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full px-3 py-2.5 border rounded-lg dark:bg-gray-900 dark:border-gray-600 tracking-widest text-center text-lg"
          />
          <button type="button" onClick={confirmDisable} disabled={busy || code.length !== 6} className={btnOutlineBrand}>
            Confirmer la désactivation
          </button>
        </div>
      )}
    </div>
  );
}
