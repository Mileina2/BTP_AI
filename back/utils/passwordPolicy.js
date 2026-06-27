/**
 * Politique mot de passe — niveau ERP / données financières.
 * Min 12 car., majuscule, minuscule, chiffre.
 */
export function validatePassword(password) {
  const pwd = String(password || "");
  if (pwd.length < 12) {
    return "Le mot de passe doit contenir au moins 12 caractères.";
  }
  if (pwd.length > 128) {
    return "Le mot de passe est trop long.";
  }
  if (!/[a-z]/.test(pwd)) {
    return "Le mot de passe doit contenir au moins une minuscule.";
  }
  if (!/[A-Z]/.test(pwd)) {
    return "Le mot de passe doit contenir au moins une majuscule.";
  }
  if (!/[0-9]/.test(pwd)) {
    return "Le mot de passe doit contenir au moins un chiffre.";
  }
  return null;
}
