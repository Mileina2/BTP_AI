import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/prisma.js";
import { getJwtSecret } from "../config/security.js";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function durationToMs(str) {
  const m = String(str || "").match(/^(\d+)([smhd])$/i);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u === "s") return n * 1000;
  if (u === "m") return n * 60 * 1000;
  if (u === "h") return n * 60 * 60 * 1000;
  return n * 24 * 60 * 60 * 1000;
}

export async function createSessionTokens(user) {
  const accessToken = jwt.sign({ id: user.id }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const refreshTokenExpire = new Date(Date.now() + durationToMs(REFRESH_EXPIRES_IN));

  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokenHash: hashToken(refreshToken),
      refreshTokenExpire,
    },
  });

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(refreshTokenPlain) {
  if (!refreshTokenPlain) {
    const err = new Error("Refresh token manquant");
    err.code = "INVALID_REFRESH";
    throw err;
  }

  const user = await prisma.user.findFirst({
    where: {
      refreshTokenHash: hashToken(refreshTokenPlain),
      refreshTokenExpire: { gt: new Date() },
      statut: "ACTIF",
    },
    include: { organization: true },
  });

  if (!user) {
    const err = new Error("Session expirée");
    err.code = "INVALID_REFRESH";
    throw err;
  }

  const tokens = await createSessionTokens(user);
  return { ...tokens, user };
}

export async function revokeRefreshToken(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null, refreshTokenExpire: null },
  });
}
