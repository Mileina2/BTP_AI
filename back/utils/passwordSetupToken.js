import crypto from "crypto";
import prisma from "../config/prisma.js";

const INVITE_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

export function getLoginUrl() {
  return process.env.FRONTEND_URL || "http://localhost:4173";
}

/** Lien valable 7 jours pour choisir un mot de passe (réutilise le flux /reset). */
export async function createPasswordSetupLink(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const expire = new Date(Date.now() + INVITE_TOKEN_MS);

  await prisma.user.update({
    where: { id: userId },
    data: { resetToken: hashed, resetTokenExpire: expire },
  });

  return `${getLoginUrl()}/#/reset/${token}`;
}
