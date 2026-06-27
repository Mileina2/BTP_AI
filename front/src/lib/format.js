import { getCurrency, DEFAULT_CURRENCY_CODE } from "./currency";

let activeCurrency = getCurrency(DEFAULT_CURRENCY_CODE);

export function setFormatCurrency(codeOrCurrency) {
  activeCurrency =
    typeof codeOrCurrency === "string" ? getCurrency(codeOrCurrency) : codeOrCurrency || getCurrency(DEFAULT_CURRENCY_CODE);
}

export function getFormatCurrency() {
  return activeCurrency;
}

export function formatNum(n) {
  const v = Math.round(Number(n) || 0);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const NBSP = "\u00a0";

export function formatMoneyWithCode(n, code) {
  const c = getCurrency(code);
  return `${formatNum(n)}${NBSP}${c.symbol}`;
}

export function formatMoneyCell(n, code) {
  const c = code ? getCurrency(code) : activeCurrency;
  const s = c.short || c.symbol;
  return `${formatNum(n)}${NBSP}${s}`;
}

export function formatMoney(n) {
  return `${formatNum(n)}${NBSP}${activeCurrency.symbol}`;
}

export function formatMoneyShort(n) {
  const v = Number(n) || 0;
  const s = activeCurrency.short || activeCurrency.symbol;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M${NBSP}${s}`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k${NBSP}${s}`;
  return `${formatNum(v)}${NBSP}${s}`;
}

/** Alias rétrocompatibles */
export const formatFCFA = formatMoney;
export const formatFCFAShort = formatMoneyShort;
