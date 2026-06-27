import { useState } from "react";
import api from "../lib/api";
import { LogIn } from "lucide-react";

export default function ResetPassword({ token, onDone }) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (pwd !== confirm) return setError("Les mots de passe ne correspondent pas.");
    setLoading(true);
    try {
      await api.post(`/auth/motdepasse/reset/${token}`, { nouveauMotDePasse: pwd });
      setOk(true);
      setTimeout(onDone, 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Lien invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <form onSubmit={submit} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Choisissez votre mot de passe</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Définissez un mot de passe personnel pour accéder à BTP IA.
        </p>
        {ok ? (
          <p className="text-green-600">Mot de passe mis à jour. Redirection…</p>
        ) : (
          <>
            <input
              type="password"
              placeholder="Nouveau mot de passe (8+ caractères)"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              required
              minLength={8}
              className="w-full mb-3 px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-600"
            />
            <input
              type="password"
              placeholder="Confirmer"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full mb-3 px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-600"
            />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg"
            >
              <LogIn className="w-4 h-4" />
              {loading ? "Enregistrement…" : "Réinitialiser"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
