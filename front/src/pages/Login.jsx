import { useState } from "react";
import api, { setSessionToken, logout } from "../lib/api";
import { LOGIN_PROFILES, getLoginProfile, SHOW_DEMO_LOGIN } from "../config/loginProfiles";
import GoogleSignInButton, { isGoogleAuthEnabled } from "../components/GoogleSignInButton";
import { btnPrimaryFull, btnOutlineBrand } from "../lib/brand";
import { Building2, HardHat, LayoutGrid, LogIn, Mail, UserPlus } from "lucide-react";

const PROFILE_ICONS = {
  ENTREPRENEUR: Building2,
  CHEF_CHANTIER: HardHat,
  CLIENT: LayoutGrid,
};

const EMPTY_REGISTER = {
  nom: "",
  prenom: "",
  email: "",
  motDePasse: "",
  telephone: "",
  nomEntreprise: "",
  adresseEntreprise: "",
  villeEntreprise: "",
  paysEntreprise: "Côte d'Ivoire",
};

export default function Login({ onLogin }) {
  const [profileRole, setProfileRole] = useState("ENTREPRENEUR");
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    ...EMPTY_REGISTER,
    email: SHOW_DEMO_LOGIN ? LOGIN_PROFILES[0].demoEmail : "",
    motDePasse: SHOW_DEMO_LOGIN ? LOGIN_PROFILES[0].demoPassword : "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [verifyInfo, setVerifyInfo] = useState("");
  const [devVerifyUrl, setDevVerifyUrl] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [twoFARequired, setTwoFARequired] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [twoFAInfo, setTwoFAInfo] = useState("");

  const profile = getLoginProfile(profileRole);
  const ProfileIcon = PROFILE_ICONS[profileRole] || Building2;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const selectProfile = (role) => {
    setProfileRole(role);
    setError("");
    const p = getLoginProfile(role);
    if (!isRegister && SHOW_DEMO_LOGIN) {
      setForm((prev) => ({
        ...prev,
        email: p.demoEmail,
        motDePasse: p.demoPassword,
      }));
    }
    if (role !== "ENTREPRENEUR") setIsRegister(false);
  };

  const fillDemo = () => {
    setForm((prev) => ({
      ...prev,
      email: profile.demoEmail,
      motDePasse: profile.demoPassword,
    }));
  };

  const handleResendVerification = async () => {
    const email = pendingEmail || form.email?.trim();
    if (!email) return;
    setResendLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/verify/resend", { email });
      setVerifyInfo(
        res.data?.message ||
          "Si un compte en attente existe, un nouvel email de validation a été envoyé."
      );
      if (res.data?.devVerifyUrl) {
        setDevVerifyUrl(res.data.devVerifyUrl);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Impossible de renvoyer l'email.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotSuccess("");
    setError("");
    setForgotLoading(true);
    try {
      const res = await api.post("/auth/motdepasse/reset", { email: forgotEmail.trim() });
      setForgotSuccess(
        res.data?.message ||
          "Si un compte existe avec cet email, vous recevrez un lien dans quelques minutes. Vérifiez aussi les spams."
      );
    } catch (err) {
      setError(err.response?.data?.error || "Impossible d'envoyer la demande de réinitialisation");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setPendingVerification(false);
    setVerifyInfo("");

    try {
      if (isRegister && profile.allowRegister) {
        logout();
        const res = await api.post("/auth/register", form);
        setPendingVerification(true);
        setPendingEmail(form.email.trim().toLowerCase());
        setIsRegister(false);
        setVerifyInfo(
          res.data?.message || "Compte créé. Vérifiez votre boîte mail pour activer le compte."
        );
        setDevVerifyUrl(res.data?.devVerifyUrl || "");
      } else {
        const res = await api.post("/auth/login", {
          email: form.email,
          motDePasse: form.motDePasse,
        });
        if (res.data?.requires2FA) {
          setTwoFARequired(true);
          setChallengeToken(res.data.challengeToken);
          setTwoFAInfo(res.data.message || "Code envoyé par email.");
          setOtpCode("");
          return;
        }
        if (res.data?.token) {
          setSessionToken(res.data.token, res.data.refreshToken);
          onLogin();
        } else {
          throw new Error("Aucun token reçu du serveur");
        }
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsVerification) {
        setPendingVerification(true);
        setPendingEmail(data.email || form.email);
        setError(data.error || "Confirmez votre email avant de vous connecter.");
      } else {
        setError(data?.error || data?.message || "Erreur de connexion ou d'inscription");
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/2fa/verify", {
        challengeToken,
        code: otpCode.trim(),
      });
      setSessionToken(res.data.token, res.data.refreshToken);
      onLogin();
    } catch (err) {
      setError(err.response?.data?.error || "Code invalide ou expiré");
    } finally {
      setLoading(false);
    }
  };

  const handle2FAResend = async () => {
    setError("");
    setResendLoading(true);
    try {
      const res = await api.post("/auth/2fa/resend", { challengeToken });
      setTwoFAInfo(res.data?.message || "Nouveau code envoyé.");
    } catch (err) {
      setError(err.response?.data?.error || "Impossible de renvoyer le code");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center login-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.png"
            alt="BTP IA"
            className="w-28 h-28 rounded-2xl object-contain shadow-brand bg-white p-1 mb-4"
          />
          <h1 className="text-2xl font-bold text-brand-ink dark:text-white tracking-tight">BTP IA</h1>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mt-1">BTP · Afrique</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Choisissez votre type de connexion
          </p>
        </div>

        {/* Sélecteur de profil */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {LOGIN_PROFILES.map((p) => {
            const Icon = PROFILE_ICONS[p.role] || Building2;
            const active = profileRole === p.role;
            return (
              <button
                key={p.role}
                type="button"
                onClick={() => selectProfile(p.role)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition ${
                  active
                    ? "border-brand-yellow bg-brand-yellow text-brand-ink shadow-brand font-semibold"
                    : "border-gray-200 dark:border-brand-slate bg-white dark:bg-brand-charcoal text-gray-700 dark:text-gray-200 hover:border-brand-yellow/60"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-xs font-semibold leading-tight">{p.label}</span>
              </button>
            );
          })}
        </div>

        <form
          onSubmit={showForgot ? handleForgotSubmit : handleSubmit}
          className="card-brand p-6 sm:p-8 shadow-lg"
        >
          {pendingVerification && !showForgot ? (
            <div className="text-center py-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-4">
                <Mail className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
                Activez votre compte
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{verifyInfo}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Email : <strong>{pendingEmail}</strong>
              </p>
              {devVerifyUrl ? (
                <div className="mb-4 p-3 rounded-lg bg-brand-yellow-muted dark:bg-brand-yellow/10 border border-brand-yellow/30">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                    Mode test local — activez votre compte avec ce lien :
                  </p>
                  <a
                    href={devVerifyUrl}
                    className="text-sm text-amber-900 dark:text-brand-yellow font-medium hover:underline break-all"
                  >
                    Valider mon email
                  </a>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Consultez votre boîte mail (et les spams). La connexion sera possible après validation.
                </p>
              )}
              {error && (
                <p className="text-red-500 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendLoading}
                className={`w-full mb-3 ${btnOutlineBrand}`}
              >
                {resendLoading ? "Envoi…" : "Renvoyer l'email de validation"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingVerification(false);
                  setDevVerifyUrl("");
                  setVerifyInfo("");
                  setError("");
                }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
          <>
          <div className="flex items-start gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="p-2 rounded-lg bg-brand-yellow-muted dark:bg-brand-yellow/10 text-brand-ink dark:text-brand-yellow">
              <ProfileIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {showForgot
                  ? "Mot de passe oublié"
                  : isRegister
                    ? "Créer une entreprise"
                    : profile.label}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {showForgot
                  ? "Saisissez votre email pour recevoir un lien de réinitialisation"
                  : isRegister
                    ? "Inscription entrepreneur — nouvelle organisation"
                    : profile.description}
              </p>
            </div>
          </div>

          {showForgot ? (
            <>
              <input
                type="email"
                placeholder="Email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full mb-3 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100"
              />
              {forgotSuccess && (
                <p className="text-green-600 dark:text-green-400 text-sm mb-3 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                  {forgotSuccess}
                </p>
              )}
            </>
          ) : twoFARequired ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{twoFAInfo}</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Code à 6 chiffres"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                required
                className="w-full mb-3 px-3 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100 text-center text-xl tracking-[0.4em]"
              />
              <button
                type="button"
                onClick={handle2FAVerify}
                disabled={loading || otpCode.length !== 6}
                className={`w-full ${btnPrimaryFull} disabled:opacity-60 mb-2`}
              >
                {loading ? "Vérification…" : "Valider le code"}
              </button>
              <button
                type="button"
                onClick={handle2FAResend}
                disabled={resendLoading}
                className="w-full text-sm text-amber-800 dark:text-brand-yellow hover:underline mb-2"
              >
                {resendLoading ? "Envoi…" : "Renvoyer le code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTwoFARequired(false);
                  setChallengeToken("");
                  setOtpCode("");
                }}
                className="w-full text-sm text-gray-500 hover:underline"
              >
                Retour à la connexion
              </button>
            </>
          ) : (
            <>
          {isRegister && (
            <>
              <input
                type="text"
                name="nom"
                placeholder="Nom"
                value={form.nom}
                onChange={handleChange}
                required
                className="w-full mb-3 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                name="prenom"
                placeholder="Prénom"
                value={form.prenom}
                onChange={handleChange}
                required
                className="w-full mb-3 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100"
              />
              <input
                type="tel"
                name="telephone"
                placeholder="Téléphone"
                value={form.telephone}
                onChange={handleChange}
                className="w-full mb-3 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                name="nomEntreprise"
                placeholder="Nom de l'entreprise"
                value={form.nomEntreprise}
                onChange={handleChange}
                className="w-full mb-3 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                name="villeEntreprise"
                placeholder="Ville"
                value={form.villeEntreprise}
                onChange={handleChange}
                className="w-full mb-3 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100"
              />
            </>
          )}

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
            className="w-full mb-3 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100"
          />

          <input
            type="password"
            name="motDePasse"
            placeholder="Mot de passe"
            value={form.motDePasse}
            onChange={handleChange}
            required
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="w-full mb-3 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100"
          />

          {!isRegister && SHOW_DEMO_LOGIN && (
            <button
              type="button"
              onClick={fillDemo}
              className="w-full mb-3 text-xs text-amber-900 dark:text-brand-yellow hover:underline font-medium"
            >
              Remplir avec le compte démo {profile.label}
            </button>
          )}
            </>
          )}

          {error && (
            <p className="text-red-500 text-sm mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || forgotLoading || twoFARequired}
            className={`w-full ${btnPrimaryFull} disabled:opacity-60`}
          >
            {showForgot ? (
              <>
                <LogIn className="w-4 h-4" />
                {forgotLoading ? "Envoi…" : "Envoyer le lien"}
              </>
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" />
                {loading ? "Création…" : "Créer mon entreprise"}
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                {loading ? "Connexion…" : "Se connecter"}
              </>
            )}
          </button>

          {!showForgot && profileRole === "ENTREPRENEUR" && isGoogleAuthEnabled() && (
            <div className="mt-4">
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-gray-800 px-2 text-gray-500">ou</span>
                </div>
              </div>
              <GoogleSignInButton
                disabled={loading}
                nomEntreprise={form.nomEntreprise}
                villeEntreprise={form.villeEntreprise}
                paysEntreprise={form.paysEntreprise}
                onSuccess={onLogin}
                onError={(msg) => setError(msg)}
              />
              <p className="text-xs text-center text-gray-500 mt-2">
                {isRegister ? "Inscription" : "Connexion"} avec Google (entrepreneur)
              </p>
            </div>
          )}

          {!showForgot && !isRegister && (
            <button
              type="button"
              onClick={() => {
                setShowForgot(true);
                setForgotEmail(form.email);
                setError("");
                setForgotSuccess("");
              }}
              className="w-full mt-3 text-sm text-amber-900 dark:text-brand-yellow hover:underline font-medium"
            >
              Mot de passe oublié ?
            </button>
          )}

          {showForgot && (
            <button
              type="button"
              onClick={() => {
                setShowForgot(false);
                setForgotSuccess("");
                setError("");
              }}
              className="w-full mt-4 text-sm text-center text-amber-900 dark:text-brand-yellow hover:underline font-medium"
            >
              Retour à la connexion
            </button>
          )}

          {!showForgot && profile.allowRegister && (
            <p
              className="mt-4 text-sm text-center text-amber-900 dark:text-brand-yellow hover:underline cursor-pointer font-medium"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
                if (!isRegister) {
                  setForm({ ...EMPTY_REGISTER });
                } else if (SHOW_DEMO_LOGIN) {
                  fillDemo();
                }
              }}
            >
              {isRegister
                ? "Déjà un compte ? Connexion"
                : "Nouvelle entreprise ? Créer un compte entrepreneur"}
            </p>
          )}

          {!showForgot && !profile.allowRegister && !isRegister && (
            <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
              Compte fourni par votre entreprise BTP. Contactez l&apos;entrepreneur si vous n&apos;avez pas vos identifiants.
            </p>
          )}
          </>
          )}
        </form>
      </div>
    </div>
  );
}
