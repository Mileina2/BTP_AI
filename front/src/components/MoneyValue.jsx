import { formatMoney, formatMoneyShort, formatMoneyWithCode } from "../lib/format";

/** Affichage cohérent des montants (espacement, pas de coupure ligne) */
export default function MoneyValue({
  amount,
  short = false,
  code,
  className = "",
  title,
}) {
  const formatted = code
    ? formatMoneyWithCode(amount, code)
    : short
      ? formatMoneyShort(amount)
      : formatMoney(amount);

  return (
    <span
      className={`tabular-nums whitespace-nowrap ${className}`}
      title={title ?? (short && !code ? formatMoney(amount) : undefined)}
    >
      {formatted}
    </span>
  );
}
