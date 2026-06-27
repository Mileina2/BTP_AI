import axios from "axios";

// ===============================
// 🌐 CONFIGURATION GLOBALE AXIOS
// ===============================
const API_URL = "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  console.log("🔑 Token envoyé par Axios:", token);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});


// ===============================
// 🔐 INTERCEPTEUR : TOKEN JWT
// ===============================
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn("⚠️ Aucun token trouvé dans localStorage");
  }
  return config;
});

// ===============================
// 📦 TÉLÉCHARGEMENT DE FICHIERS (PDF, EXCEL, ETC.)
// ===============================
export const downloadFile = async (url, filename) => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Aucun token trouvé. Veuillez vous reconnecter.");
    }

    const response = await axios.get(`${API_URL}${url}`, {
      responseType: "blob",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Vérifie si la réponse est bien un PDF
    if (response.status !== 200) {
      throw new Error(`Erreur serveur (${response.status})`);
    }

    const blob = new Blob([response.data], { type: response.data.type || "application/pdf" });
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("❌ Erreur lors du téléchargement :", error);
    alert("Erreur lors du téléchargement du fichier. Veuillez vous reconnecter.");
  }
};

// ===============================
// 🧩 EXPORT DU CLIENT AXIOS
// ===============================
export default api;
