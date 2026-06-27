import { Home, Building2, Receipt, PiggyBank, HardHat, Boxes, LayoutGrid, Menu } from "lucide-react";

const ICONS = {
  dashboard: Home,
  chantiers: Building2,
  factures: Receipt,
  tresorerie: PiggyBank,
  terrain: HardHat,
  stock: Boxes,
  portail: LayoutGrid,
};

const QUICK_BY_ROLE = {
  ENTREPRENEUR: ["dashboard", "chantiers", "factures", "tresorerie"],
  ADMIN: ["dashboard", "chantiers", "factures", "tresorerie"],
  CHEF_CHANTIER: ["terrain", "chantiers", "stock"],
  CLIENT: ["portail"],
};

const LABELS = {
  dashboard: "Accueil",
  chantiers: "Chantiers",
  factures: "Factures",
  tresorerie: "Trésorerie",
  terrain: "Terrain",
  stock: "Stock",
  portail: "Mon chantier",
};

export default function MobileBottomNav({ role, page, allowedKeys, onNavigate, onOpenMenu }) {
  const quickKeys = (QUICK_BY_ROLE[role] || QUICK_BY_ROLE.ENTREPRENEUR).filter((k) =>
    allowedKeys.includes(k)
  );

  if (quickKeys.length <= 1) return null;

  const tabs = [...quickKeys.slice(0, 4), "menu"];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-brand-charcoal/95 backdrop-blur-md border-t border-gray-200 dark:border-brand-slate pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigation principale"
    >
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((key) => {
          if (key === "menu") {
            const active = false;
            return (
              <button
                key="menu"
                type="button"
                onClick={onOpenMenu}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium touch-manipulation min-h-[44px] ${
                  active ? "text-brand-ink dark:text-brand-yellow" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <Menu className="w-5 h-5" />
                Menu
              </button>
            );
          }

          const Icon = ICONS[key] || Home;
          const active = page === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium touch-manipulation min-h-[44px] ${
                active
                  ? "text-brand-ink dark:text-brand-yellow"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? "scale-110" : ""}`} />
              {LABELS[key] || key}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
