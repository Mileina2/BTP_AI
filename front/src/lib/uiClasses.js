/** Classes Tailwind réutilisables — lisibilité light + dark */

export const pageTitle = "text-xl sm:text-2xl font-bold tracking-tight text-brand-ink dark:text-gray-100";
export const pageSubtitle = "text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1";
export const card = "card-brand";
export const cardInner = "p-3 rounded-lg bg-brand-yellow-muted/50 dark:bg-brand-slate/50 border border-gray-100 dark:border-brand-slate";
export const cardFooter = "border-t border-gray-200 dark:border-brand-slate px-4 py-3 flex items-center justify-between bg-brand-surface/50 dark:bg-brand-slate/30";

export const textPrimary = "text-gray-900 dark:text-gray-100";
export const textSecondary = "text-gray-600 dark:text-gray-300";
export const textMuted = "text-gray-500 dark:text-gray-400";
export const textFaint = "text-gray-400 dark:text-gray-500";

export const kpiValue = "text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap";
export const kpiLabel = "text-xs text-gray-500 dark:text-gray-400";

export const searchInput =
  "w-full pl-9 pr-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 min-h-[44px] sm:min-h-0";
export const linkAccent = "text-amber-900 dark:text-brand-yellow hover:underline font-medium";
export const btnGhost = "text-xs text-gray-600 dark:text-gray-300 hover:text-brand-ink dark:hover:text-white";

export const amountGreen = "font-bold text-green-600 dark:text-green-400 tabular-nums whitespace-nowrap";
export const amountRed = "font-bold text-red-600 dark:text-red-400 tabular-nums whitespace-nowrap";
export const amountDefault = "font-bold text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap";

export const filterChipActive = "bg-brand-yellow text-brand-ink font-semibold shadow-brand";
export const filterChipIdle =
  "bg-white dark:bg-brand-slate text-gray-700 dark:text-gray-200 hover:bg-brand-yellow-muted dark:hover:bg-brand-slate/80 border border-gray-200 dark:border-brand-slate";

/** Bouton secondaire (bordure) — texte explicite pour le mode sombre */
export const btnSecondary =
  "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors";

export const btnIconSecondary =
  "p-2.5 rounded-lg border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors";

/** Petits boutons d’action dans les tableaux */
export const actionBtnGreen =
  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-200 dark:border-emerald-600/70 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors";

export const actionBtnAmber =
  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-amber-200 dark:border-amber-600/70 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors";

export const actionBtnBlue =
  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-600/70 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors";

export const actionBtnRed =
  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-600/70 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors";

/** Conteneur de page — grilles KPI adaptatives */
export const kpiGrid = "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4";
export const pageHeaderRow = "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4";
export const tableWrap = "table-scroll w-full overflow-x-auto";
export const filterRow = "flex flex-wrap gap-2 items-center";