import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_URL } from "./config";
import { getSecureItem, setSecureItem } from "./secureStorage";
import "./security";

const TOKEN_KEY = "btpia_token";
const REFRESH_KEY = "btpia_refresh";

export async function getToken(): Promise<string | null> {
  return getSecureItem(TOKEN_KEY);
}

async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(REFRESH_KEY);
}

export async function setTokens(access: string | null, refresh?: string | null): Promise<void> {
  await setSecureItem(TOKEN_KEY, access);
  if (refresh !== undefined) {
    await setSecureItem(REFRESH_KEY, refresh);
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return !!(await getToken());
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = await getRefreshToken();
  if (!refresh) throw new Error("Pas de refresh token");

  const res = await axios.post<{ token: string; refreshToken: string }>(`${API_URL}/auth/refresh`, {
    refreshToken: refresh,
  });
  await setTokens(res.data.token, res.data.refreshToken);
  return res.data.token;
}

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    const original = error.config;
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/google");

    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        await setTokens(null, null);
      }
    }

    if (status === 401 && !url.includes("/auth/")) {
      await setTokens(null, null);
    }
    return Promise.reject(error);
  }
);

export type AuthUser = {
  id: string;
  nom?: string;
  prenom?: string;
  email?: string;
  role?: string;
  twoFactorEnabled?: boolean;
  organization?: { nom?: string; devise?: string };
};

export type LoginResult =
  | { requires2FA: true; challengeToken: string; message?: string; maskedEmail?: string }
  | { requires2FA: false; user: AuthUser };

export async function login(email: string, motDePasse: string): Promise<LoginResult> {
  const res = await api.post<{
    token?: string;
    refreshToken?: string;
    user?: AuthUser;
    requires2FA?: boolean;
    challengeToken?: string;
    message?: string;
    maskedEmail?: string;
  }>("/auth/login", { email, motDePasse });

  if (res.data.requires2FA && res.data.challengeToken) {
    return {
      requires2FA: true,
      challengeToken: res.data.challengeToken,
      message: res.data.message,
      maskedEmail: res.data.maskedEmail,
    };
  }

  await setTokens(res.data.token!, res.data.refreshToken);
  return { requires2FA: false, user: res.data.user! };
}

export async function verify2FACode(challengeToken: string, code: string): Promise<AuthUser> {
  const res = await api.post<{ token: string; refreshToken: string; user: AuthUser }>("/auth/2fa/verify", {
    challengeToken,
    code,
  });
  await setTokens(res.data.token, res.data.refreshToken);
  return res.data.user;
}

export async function resend2FACode(challengeToken: string) {
  const res = await api.post<{ message?: string }>("/auth/2fa/resend", { challengeToken });
  return res.data;
}

export async function fetchProfile(): Promise<AuthUser> {
  const res = await api.get<AuthUser>("/auth/profil");
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    const token = await getToken();
    if (token) await api.post("/auth/logout");
  } catch {
    /* ignore */
  }
  await setTokens(null, null);
  if (!__DEV__) {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
    } catch {
      /* migration ancien stockage */
    }
  }
}

export default api;
