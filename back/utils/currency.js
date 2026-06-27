export const AFRICAN_CURRENCIES = [
  { code: "XOF", label: "Franc CFA BCEAO (XOF)", symbol: "F CFA", short: "F" },
  { code: "XAF", label: "Franc CFA BEAC (XAF)", symbol: "F CFA", short: "F" },
  { code: "NGN", label: "Naira (NGN)", symbol: "₦", short: "₦" },
  { code: "GHS", label: "Cedi (GHS)", symbol: "GH₵", short: "GH₵" },
  { code: "MAD", label: "Dirham marocain (MAD)", symbol: "MAD", short: "MAD" },
  { code: "TND", label: "Dinar tunisien (TND)", symbol: "TND", short: "TND" },
  { code: "DZD", label: "Dinar algérien (DZD)", symbol: "DZD", short: "DZD" },
  { code: "EGP", label: "Livre égyptienne (EGP)", symbol: "EGP", short: "EGP" },
  { code: "KES", label: "Shilling kenyan (KES)", symbol: "KES", short: "KES" },
  { code: "ZAR", label: "Rand (ZAR)", symbol: "R", short: "R" },
  { code: "ETB", label: "Birr (ETB)", symbol: "ETB", short: "ETB" },
  { code: "UGX", label: "Shilling ougandais (UGX)", symbol: "UGX", short: "UGX" },
  { code: "TZS", label: "Shilling tanzanien (TZS)", symbol: "TZS", short: "TZS" },
  { code: "RWF", label: "Franc rwandais (RWF)", symbol: "RWF", short: "RWF" },
  { code: "CDF", label: "Franc congolais (CDF)", symbol: "CDF", short: "CDF" },
  { code: "AOA", label: "Kwanza (AOA)", symbol: "Kz", short: "Kz" },
  { code: "MZN", label: "Metical (MZN)", symbol: "MZN", short: "MZN" },
  { code: "GNF", label: "Franc guinéen (GNF)", symbol: "GNF", short: "GNF" },
  { code: "MUR", label: "Roupie mauricienne (MUR)", symbol: "MUR", short: "MUR" },
  { code: "BWP", label: "Pula (BWP)", symbol: "P", short: "P" },
];

export function getCurrency(code) {
  return AFRICAN_CURRENCIES.find((c) => c.code === (code || "XOF")) || AFRICAN_CURRENCIES[0];
}

export function fmtNum(n) {
  return Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function fmtMoney(n, code = "XOF") {
  const c = getCurrency(code);
  return `${fmtNum(n)} ${c.symbol}`;
}

export function makeMoneyFormatters(deviseCode = "XOF") {
  const currency = getCurrency(deviseCode);
  const short = currency.short || currency.symbol;
  return {
    currency,
    fmt: (n) => fmtMoney(n, deviseCode),
    fmtCell: (n) => `${fmtNum(n)} ${short}`,
  };
}
