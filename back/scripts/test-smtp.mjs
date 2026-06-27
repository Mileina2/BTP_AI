/**
 * Test envoi email Brevo. Usage: node scripts/test-smtp.mjs votre@email.com
 */
import "dotenv/config";
import { isSmtpConfigured, sendEmail } from "../utils/emailService.js";

const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/test-smtp.mjs votre@email.com");
  process.exit(1);
}

if (!isSmtpConfigured()) {
  console.error("❌ SMTP non configuré. Remplissez dans back/.env :");
  console.error("   SMTP_USER, SMTP_PASS, SMTP_FROM");
  process.exit(1);
}

console.log("Envoi test vers", to, "...");
const result = await sendEmail({
  to,
  subject: "Test BTP IA — email OK",
  text: "Si vous lisez ce message, Brevo est bien configuré.",
  html: "<p>Si vous lisez ce message, <strong>Brevo est bien configuré</strong>.</p>",
});

if (result.sent) {
  console.log("✅ Email envoyé — vérifiez votre boîte mail (et les spams).");
} else {
  console.error("❌ Échec :", result.error || "inconnu");
  process.exit(1);
}
