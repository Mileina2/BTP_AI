import { useEffect, useState } from "react";
import api from "../lib/api";
import { CheckCircle, XCircle } from "lucide-react";

export default function VerifyEmail({ token, onDone }) {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Validation en cours…");

  useEffect(() => {
    api
      .get(`/auth/verify/${token}`)
      .then((res) => {
        setStatus("ok");
        setMessage(res.data?.message || "Email validé.");
        setTimeout(onDone, 2500);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.error || "Lien de validation invalide ou expiré.");
      });
  }, [token, onDone]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        {status === "loading" && (
          <p className="text-gray-600 dark:text-gray-300">{message}</p>
        )}
        {status === "ok" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-green-600 dark:text-green-400">{message}</p>
            <p className="text-sm text-gray-500 mt-2">Redirection vers la connexion…</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400">{message}</p>
            <button
              type="button"
              onClick={onDone}
              className="mt-4 text-blue-600 hover:underline text-sm"
            >
              Retour à la connexion
            </button>
          </>
        )}
      </div>
    </div>
  );
}
