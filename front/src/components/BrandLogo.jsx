import { BRAND } from "../lib/brand";

const SIZES = {
  xs: { img: "w-8 h-8", title: "text-sm", tagline: "hidden" },
  sm: { img: "w-10 h-10", title: "text-base", tagline: "hidden" },
  md: { img: "w-11 h-11", title: "text-lg", tagline: "text-[10px]" },
  lg: { img: "w-24 h-24", title: "text-2xl", tagline: "text-xs" },
};

export default function BrandLogo({ size = "md", showText = true, light = false, className = "" }) {
  const s = SIZES[size] || SIZES.md;

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <img
        src={BRAND.logo}
        alt={BRAND.name}
        className={`${s.img} rounded-2xl object-contain shrink-0 shadow-brand bg-white p-0.5`}
      />
      {showText && (
        <div className="min-w-0">
          <p
            className={`${s.title} font-bold tracking-tight truncate ${
              light ? "text-white" : "text-brand-ink dark:text-gray-100"
            }`}
          >
            {BRAND.name}
          </p>
          {s.tagline !== "hidden" && (
            <p
              className={`${s.tagline} uppercase tracking-widest truncate ${
                light ? "text-white/60" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              BTP · Afrique
            </p>
          )}
        </div>
      )}
    </div>
  );
}
