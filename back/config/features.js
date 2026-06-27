/** Fonctionnalités activables via back/.env */
export function isAssistantEnabled() {
  return process.env.ASSISTANT_ENABLED === "true";
}
