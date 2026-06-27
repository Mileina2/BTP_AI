import { GoogleLogin } from "@react-oauth/google";
import api, { setSessionToken } from "../lib/api";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton({
  onSuccess,
  onError,
  disabled,
  nomEntreprise,
  villeEntreprise,
  paysEntreprise,
}) {
  if (!CLIENT_ID) return null;

  const handleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      onError?.("Réponse Google incomplète.");
      return;
    }
    try {
      const res = await api.post("/auth/google", {
        idToken: credentialResponse.credential,
        nomEntreprise,
        villeEntreprise,
        paysEntreprise,
      });
      if (res.data?.token) {
        setSessionToken(res.data.token, res.data.refreshToken);
        onSuccess();
      } else {
        onError?.("Connexion Google échouée.");
      }
    } catch (err) {
      onError?.(
        err.response?.data?.error || "Connexion Google échouée. Réessayez."
      );
    }
  };

  return (
    <div className={`flex justify-center ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError?.("Connexion Google annulée.")}
        useOneTap={false}
        theme="outline"
        size="large"
        text="continue_with"
        locale="fr"
      />
    </div>
  );
}

export function isGoogleAuthEnabled() {
  return Boolean(CLIENT_ID);
}
