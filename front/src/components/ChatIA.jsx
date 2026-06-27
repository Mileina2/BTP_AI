// ===============================================
// 💬 ChatIA.jsx — composant d’assistant intégré
// ===============================================

import { useState } from "react";
import { Send, Bot, User, Loader2, X } from "lucide-react";
import api from "../lib/api";

export default function ChatIA() {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Bonjour 👋 Je suis ton assistant Chantier IA. Que veux-tu savoir ?" },
  ]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { from: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/assistant", { message: input });
      const reply = res.data.response || "Je n’ai pas compris la question.";
      setMessages((prev) => [...prev, { from: "bot", text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "⚠️ Erreur de communication avec l’IA." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Bouton flottant */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {/* Fenêtre du chat */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-[480px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* En-tête */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <h3 className="font-semibold text-sm">Assistant Chantier IA</h3>
            </div>
            <button onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Zone de chat */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 ${
                  msg.from === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.from === "bot" && (
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-xl max-w-[80%] text-sm text-gray-800 dark:text-gray-100">
                    {msg.text}
                  </div>
                )}
                {msg.from === "user" && (
                  <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-xl max-w-[80%] text-sm text-gray-900 dark:text-gray-100">
                    {msg.text}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin w-4 h-4" /> L’assistant réfléchit...
              </div>
            )}
          </div>

          {/* Zone d’entrée */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                rows={1}
                placeholder="Écris ton message..."
                className="flex-1 resize-none text-sm p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
