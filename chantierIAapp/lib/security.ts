import { API_URL } from "./config";

/** En production build, l'API doit être en HTTPS */
export function assertApiSecurity() {
  if (!__DEV__ && API_URL.startsWith("http://")) {
    console.warn(
      "[Sécurité] API en HTTP détectée en build production. Utilisez https:// dans app.json → extra.apiUrl"
    );
  }
}

assertApiSecurity();
