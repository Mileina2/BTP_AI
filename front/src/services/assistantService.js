import api from "../api";

export async function askAssistant(question) {
  const { data } = await api.post("/assistant", { question });
  return data.reponse;
}
