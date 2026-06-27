/** Identité visuelle BTP IA — losange jaune + grue (logo officiel) */

export const BRAND = {
  name: "BTP IA",
  tagline: "Gestion chantier & finance BTP",
  logo: "/logo.png",
  favicon: "/favicon.png",
  colors: {
    yellow: "#F5C518",
    yellowHover: "#E0AD00",
    yellowMuted: "#FEF9E7",
    ink: "#111111",
    charcoal: "#141414",
    surface: "#F5F4F0",
  },
};

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-brand-yellow text-brand-ink hover:bg-brand-yellow-hover disabled:opacity-50 transition-colors shadow-brand";

export const btnPrimaryFull = `${btnPrimary} w-full`;

export const btnOutlineBrand =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border-2 border-brand-yellow text-brand-ink dark:text-brand-yellow hover:bg-brand-yellow-muted disabled:opacity-50 transition-colors";
