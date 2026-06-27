/** Normalise un numéro local (ex. CI) pour wa.me */
export function normalizePhoneForWhatsApp(telephone, defaultCountryCode = "225") {
  let digits = telephone?.replace(/\D/g, "") || "";
  if (!digits) return null;
  if (digits.startsWith("0")) digits = defaultCountryCode + digits.slice(1);
  if (digits.length <= 10 && !digits.startsWith(defaultCountryCode)) {
    digits = defaultCountryCode + digits.replace(/^0+/, "");
  }
  return digits;
}

export function buildWhatsAppUrl(telephone, message) {
  const tel = normalizePhoneForWhatsApp(telephone);
  if (!tel) return null;
  return `https://wa.me/${tel}?text=${encodeURIComponent(message)}`;
}
