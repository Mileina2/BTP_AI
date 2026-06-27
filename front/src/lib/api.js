// src/lib/api.js
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "token";
const REFRESH_KEY = "refreshToken";

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_KEY);
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

let refreshPromise = null;

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("Pas de refresh token");

  const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh });
  setSessionToken(res.data.token, res.data.refreshToken);
  return res.data.token;
}

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    const original = error.config;
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/2fa/") ||
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
        clearToken();
        window.dispatchEvent(new CustomEvent("auth:logout"));
        return Promise.reject(error);
      }
    }

    if (status === 401 && !isAuthRoute) {
      const hadToken = getToken();
      clearToken();
      if (hadToken) {
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
    }

    if (status === 403 && error.response?.data?.needsVerification) {
      clearToken();
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
    return Promise.reject(error);
  }
);

export async function uploadFile(endpoint, file, fields = {}) {
  const token = getToken();
  if (!token) throw new Error("Token manquant. Veuillez vous reconnecter.");

  const formData = new FormData();
  formData.append("file", file);
  Object.entries(fields).forEach(([key, value]) => {
    if (value != null && value !== "") formData.append(key, value);
  });

  const response = await axios.post(`${BASE_URL}${endpoint}`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
    timeout: file.type?.startsWith("video/") ? 180000 : 60000,
  });
  return response;
}

export async function downloadFile(endpoint, filename = "export.pdf") {
  try {
    const token = getToken();
    if (!token) throw new Error("Token manquant. Veuillez vous reconnecter.");

    const url = `${BASE_URL}${endpoint}`;
    const response = await axios.get(url, {
      responseType: "blob",
      headers: { Authorization: `Bearer ${token}` },
    });

    const contentType = response.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      const text = await response.data.text();
      const err = JSON.parse(text);
      throw new Error(err.error || "Erreur lors du téléchargement");
    }

    const blob = new Blob([response.data], { type: contentType || "application/pdf" });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("❌ Erreur de téléchargement :", error);
    alert(error.message || "Erreur lors du téléchargement du fichier.");
  }
}

export function setSessionToken(token, refreshToken) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  } else {
    clearToken();
  }
}

export function isAuthenticated() {
  return !!getToken();
}

export async function logout() {
  try {
    const token = getToken();
    if (token) {
      await api.post("/auth/logout");
    }
  } catch {
    /* ignore — session locale effacée de toute façon */
  }
  clearToken();
  window.dispatchEvent(new CustomEvent("auth:logout"));
}

export default api;
