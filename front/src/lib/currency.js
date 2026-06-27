/** Devises courantes en Afrique — configurables dans Mon entreprise */
export const AFRICAN_CURRENCIES = [
  { code: "XOF", label: "Franc CFA BCEAO (XOF)", symbol: "F CFA", short: "F", countries: ["Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Bénin", "Togo", "Niger", "Guinée-Bissau"] },
  { code: "XAF", label: "Franc CFA BEAC (XAF)", symbol: "F CFA", short: "F", countries: ["Cameroun", "Gabon", "Tchad", "Congo", "Guinée équatoriale", "Centrafrique"] },
  { code: "NGN", label: "Naira (NGN)", symbol: "₦", short: "₦", countries: ["Nigeria"] },
  { code: "GHS", label: "Cedi (GHS)", symbol: "GH₵", short: "GH₵", countries: ["Ghana"] },
  { code: "MAD", label: "Dirham marocain (MAD)", symbol: "MAD", short: "MAD", countries: ["Maroc"] },
  { code: "TND", label: "Dinar tunisien (TND)", symbol: "TND", short: "TND", countries: ["Tunisie"] },
  { code: "DZD", label: "Dinar algérien (DZD)", symbol: "DZD", short: "DZD", countries: ["Algérie"] },
  { code: "EGP", label: "Livre égyptienne (EGP)", symbol: "EGP", short: "EGP", countries: ["Égypte"] },
  { code: "KES", label: "Shilling kenyan (KES)", symbol: "KES", short: "KES", countries: ["Kenya"] },
  { code: "ZAR", label: "Rand (ZAR)", symbol: "R", short: "R", countries: ["Afrique du Sud"] },
  { code: "ETB", label: "Birr (ETB)", symbol: "ETB", short: "ETB", countries: ["Éthiopie"] },
  { code: "UGX", label: "Shilling ougandais (UGX)", symbol: "UGX", short: "UGX", countries: ["Ouganda"] },
  { code: "TZS", label: "Shilling tanzanien (TZS)", symbol: "TZS", short: "TZS", countries: ["Tanzanie"] },
  { code: "RWF", label: "Franc rwandais (RWF)", symbol: "RWF", short: "RWF", countries: ["Rwanda"] },
  { code: "CDF", label: "Franc congolais (CDF)", symbol: "CDF", short: "CDF", countries: ["RD Congo"] },
  { code: "AOA", label: "Kwanza (AOA)", symbol: "Kz", short: "Kz", countries: ["Angola"] },
  { code: "MZN", label: "Metical (MZN)", symbol: "MZN", short: "MZN", countries: ["Mozambique"] },
  { code: "GNF", label: "Franc guinéen (GNF)", symbol: "GNF", short: "GNF", countries: ["Guinée"] },
  { code: "MUR", label: "Roupie mauricienne (MUR)", symbol: "MUR", short: "MUR", countries: ["Maurice"] },
  { code: "BWP", label: "Pula (BWP)", symbol: "P", short: "P", countries: ["Botswana"] },
];

export const DEFAULT_CURRENCY_CODE = "XOF";

export function getCurrency(code) {
  return AFRICAN_CURRENCIES.find((c) => c.code === code) || AFRICAN_CURRENCIES[0];
}

export function guessCurrencyFromCountry(pays) {
  if (!pays) return DEFAULT_CURRENCY_CODE;
  const p = pays.trim().toLowerCase();
  const found = AFRICAN_CURRENCIES.find((c) =>
    c.countries.some((country) => country.toLowerCase() === p || p.includes(country.toLowerCase()))
  );
  return found?.code || DEFAULT_CURRENCY_CODE;
}
