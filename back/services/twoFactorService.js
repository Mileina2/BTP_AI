import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { getJwtSecret } from "../config/security.js";
import { sendTwoFactorEmail, isSmtpConfigured } from "../utils/emailService.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_TTL = "10m";

export function canUseTwoFactor(user) {
  return user && (user.role === "ENTREPRENEUR" || user.role === "ADMIN") && user.motDePasse;
}

function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code).trim()).digest("hex");
}

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function maskEmail(email) {
  const [local, domain] = String(email || "").split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export async function storeOtpForUser(userId, code) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorOtpHash: hashOtp(code),
      twoFactorOtpExpire: new Date(Date.now() + OTP_TTL_MS),
    },
  });
}

export async function verifyOtpForUser(userId, code) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorOtpHash || !user.twoFactorOtpExpire) return false;
  if (user.twoFactorOtpExpire < new Date()) return false;
  if (user.twoFactorOtpHash !== hashOtp(code)) return false;

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorOtpHash: null, twoFactorOtpExpire: null },
  });
  return true;
}

export async function sendOtpToUser(user, purpose) {
  if (!isSmtpConfigured()) {
    const err = new Error("L'envoi d'emails n'est pas configuré. Impossible d'utiliser la 2FA.");
    err.code = "SMTP_REQUIRED";
    throw err;
  }

  const code = generateOtp();
  await storeOtpForUser(user.id, code);
  await sendTwoFactorEmail(user.email, code, purpose);
  return { maskedEmail: maskEmail(user.email) };
}

export function createChallengeToken(userId) {
  return jwt.sign({ id: userId, typ: "2fa_challenge" }, getJwtSecret(), { expiresIn: CHALLENGE_TTL });
}

export function verifyChallengeToken(token) {
  const decoded = jwt.verify(token, getJwtSecret());
  if (decoded.typ !== "2fa_challenge" || !decoded.id) {
    throw new Error("Challenge invalide");
  }
  return decoded.id;
}

export async function clearOtp(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorOtpHash: null, twoFactorOtpExpire: null },
  });
}

export { maskEmail };
