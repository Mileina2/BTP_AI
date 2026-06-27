/** Navigation horizontale (desktop) — remplace la sidebar. */
export default function AppTopNav({ navItems, page, onNavigate }) {
  if (!navItems.length) return null;

  return (
    <nav
      className="hidden md:block border-b border-gray-200/80 dark:border-brand-slate bg-white/90 dark:bg-brand-charcoal/90 backdrop-blur-sm"
      aria-label="Navigation principale"
    >
      <div className="px-4 md:px-10 overflow-x-auto scrollbar-thin">
        <div className="flex gap-1.5 py-2.5 min-w-max max-w-[1600px] mx-auto">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm whitespace-nowrap transition touch-manipulation ${
                page === key ? "top-nav-active" : "top-nav-idle"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
