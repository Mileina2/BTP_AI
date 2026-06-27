export function formatFCFA(amount?: number | null): string {
  const n = Number(amount) || 0;
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
}

export function formatFCFAShort(amount?: number | null): string {
  const n = Number(amount) || 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M FCFA`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} k FCFA`;
  return formatFCFA(n);
}

export function formatDate(d?: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
