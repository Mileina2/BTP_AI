/**
 * En production derrière un reverse proxy (Render, Railway, Nginx),
 * refuse le trafic HTTP non sécurisé si FORCE_HTTPS=true.
 */
export function requireHttps(req, res, next) {
  if (process.env.NODE_ENV !== "production") return next();
  if (process.env.FORCE_HTTPS !== "true") return next();

  const proto = req.headers["x-forwarded-proto"];
  if (proto && proto !== "https") {
    return res.status(403).json({
      error: "Connexion HTTPS requise. Utilisez https:// pour accéder à l'API.",
    });
  }
  next();
}
