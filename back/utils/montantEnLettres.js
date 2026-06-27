const UNITS = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
const TEENS = [
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];
const TENS = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function under100(n) {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 70) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 0) return TENS[ten];
    if (unit === 1) return `${TENS[ten]}-et-un`;
    return `${TENS[ten]}-${UNITS[unit]}`;
  }
  if (n < 80) {
    const rest = n - 60;
    return rest === 11 ? "soixante-et-onze" : `soixante-${under100(rest)}`;
  }
  if (n < 100) {
    const rest = n - 80;
    if (rest === 0) return "quatre-vingts";
    return rest === 1 ? "quatre-vingt-un" : `quatre-vingt-${under100(rest)}`;
  }
  return "";
}

function under1000(n) {
  if (n < 100) return under100(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hundredWord = hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent`;
  if (rest === 0) return hundreds > 1 ? `${hundredWord}s` : hundredWord;
  return `${hundredWord} ${under100(rest)}`;
}

function chunkToWords(n) {
  if (n === 0) return "";
  if (n < 1000) return under1000(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const thousandWord = thousands === 1 ? "mille" : `${under1000(thousands)} mille`;
  if (rest === 0) return thousandWord;
  return `${thousandWord} ${under1000(rest)}`;
}

function integerToWords(n) {
  if (n === 0) return "zéro";
  if (n < 0) return `moins ${integerToWords(-n)}`;

  const parts = [];
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  if (billions) parts.push(billions === 1 ? "un milliard" : `${chunkToWords(billions)} milliards`);
  if (millions) parts.push(millions === 1 ? "un million" : `${chunkToWords(millions)} millions`);
  if (thousands) parts.push(chunkToWords(thousands === 1 ? 1000 : thousands));
  if (rest) parts.push(under1000(rest));

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function montantEnLettres(amount, deviseLabel = "francs CFA") {
  const value = Math.round(Number(amount) || 0);
  const words = integerToWords(value);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} ${deviseLabel}`;
}
