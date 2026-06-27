import { X, LogOut } from "lucide-react";
import BrandLogo from "./BrandLogo";

/** Menu plein écran (mobile) — remplace le tiroir latéral. */
export default function AppMenuOverlay({ open, navItems, page, onNavigate, onClose, onLogout }) {
  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-brand-surface dark:bg-brand-ink">
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-gray-200/80 dark:border-brand-slate">
        <BrandLogo size="sm" showText />
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-brand-slate touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Fermer le menu"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 px-1">
          Modules
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl text-center text-sm font-medium touch-manipulation min-h-[88px] transition ${
                page === key
                  ? "bg-brand-yellow text-brand-ink shadow-brand"
                  : "bg-white dark:bg-brand-charcoal border border-gray-200/90 dark:border-brand-slate text-gray-700 dark:text-gray-200 hover:border-brand-yellow/50"
              }`}
            >
              <Icon className="w-6 h-6 shrink-0" />
              <span className="leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-200/80 dark:border-brand-slate">
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium text-sm touch-manipulation min-h-[48px]"
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}
