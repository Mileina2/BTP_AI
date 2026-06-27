import express from "express";
import {
  register,
  login,
  googleAuth,
  verifyEmail,
  resendVerificationEmail,
  demanderResetMotDePasse,
  resetMotDePasse,
  getMonProfil,
  updateProfil,
  deleteProfil,
  desactiverProfil,
  refreshSession,
  logoutSession,
  verify2FALogin,
  resend2FALogin,
  requestEnable2FA,
  confirmEnable2FA,
  requestDisable2FA,
  confirmDisable2FA,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authRateLimiter, strictAuthRateLimiter } from "../middleware/rateLimitMiddleware.js";
import { validateLoginBody, validateRegisterBody } from "../middleware/validateInput.js";

const router = express.Router();

router.post("/register", authRateLimiter, validateRegisterBody, register);
router.post("/login", strictAuthRateLimiter, validateLoginBody, login);
router.post("/refresh", authRateLimiter, refreshSession);
router.post("/2fa/verify", strictAuthRateLimiter, verify2FALogin);
router.post("/2fa/resend", authRateLimiter, resend2FALogin);
router.post("/google", strictAuthRateLimiter, googleAuth);
router.get("/verify/:token", verifyEmail);
router.post("/verify/resend", authRateLimiter, resendVerificationEmail);
router.post("/motdepasse/reset", strictAuthRateLimiter, demanderResetMotDePasse);
router.post("/motdepasse/reset/:token", authRateLimiter, resetMotDePasse);

router.post("/logout", protect, logoutSession);
router.post("/2fa/enable", protect, requestEnable2FA);
router.post("/2fa/enable/confirm", protect, confirmEnable2FA);
router.post("/2fa/disable", protect, requestDisable2FA);
router.post("/2fa/disable/confirm", protect, confirmDisable2FA);
router.get("/profil", protect, getMonProfil);
router.put("/profil", protect, updateProfil);
router.patch("/profil/desactiver", protect, desactiverProfil);
router.delete("/profil", protect, deleteProfil);

export default router;
