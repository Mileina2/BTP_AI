import api from "../api";

export async function login(email, motDePasse) {
  const { data } = await api.post("/auth/login", { email, motDePasse });
  localStorage.setItem("token", data.token);
  return data.user;
}

export async function register(nom, email, motDePasse) {
  const { data } = await api.post("/auth/register", { nom, email, motDePasse });
  return data;
}
