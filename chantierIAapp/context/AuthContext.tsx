import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, {
  AuthUser,
  LoginResult,
  fetchProfile,
  isAuthenticated as checkAuth,
  login as apiLogin,
  verify2FACode,
  resend2FACode,
  logout as apiLogout,
} from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, motDePasse: string) => Promise<LoginResult>;
  verify2FA: (challengeToken: string, code: string) => Promise<void>;
  resend2FA: (challengeToken: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const authed = await checkAuth();
    if (!authed) {
      setUser(null);
      return;
    }
    const profile = await fetchProfile();
    setUser(profile);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refreshProfile();
      } catch {
        setUser(null);
        await apiLogout();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, motDePasse: string) => {
    const result = await apiLogin(email, motDePasse);
    if (!result.requires2FA) {
      setUser(result.user);
    }
    return result;
  }, []);

  const verify2FA = useCallback(async (challengeToken: string, code: string) => {
    const user = await verify2FACode(challengeToken, code);
    setUser(user);
  }, []);

  const resend2FA = useCallback(async (challengeToken: string) => {
    const data = await resend2FACode(challengeToken);
    return data.message;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, verify2FA, resend2FA, logout, refreshProfile }),
    [user, loading, login, verify2FA, resend2FA, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Hook pour écrans avec chargement API */
export function useApiGet<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    api
      .get<T>(path)
      .then((res) => {
        setData(res.data);
        setError("");
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Erreur de chargement");
      })
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload, ...deps]);

  return { data, loading, error, reload };
}
