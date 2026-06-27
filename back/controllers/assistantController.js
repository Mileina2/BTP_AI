import { isAssistantEnabled } from "../config/features.js";

let client = null;

async function getOpenAIClient() {
  if (!client) {
    const OpenAI = (await import("openai")).default;
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const askAssistant = async (req, res) => {
  if (!isAssistantEnabled()) {
    return res.status(503).json({
      error: "L'assistant IA est temporairement désactivé.",
      disabled: true,
    });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message manquant." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "Assistant IA non configuré (OPENAI_API_KEY manquante)." });
    }

    const openai = await getOpenAIClient();
    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: `Tu es l'assistant Chantier IA. Réponds clairement et professionnellement à : ${message}`,
    });

    res.json({
      response: response.output[0].content[0].text,
    });
  } catch (error) {
    console.error("❌ Erreur assistant :", error);
    res.status(500).json({ error: error.message || "Erreur serveur assistant" });
  }
};
