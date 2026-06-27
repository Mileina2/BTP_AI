import { useState, useEffect, useRef } from "react";
import api, { isAuthenticated as checkAuth, logout as apiLogout } from "./lib/api";
import Login from "./pages/Login";
import Equipe from "./pages/Equipe";
import Chantier from "./pages/Chantier";
import Dashboard from "./pages/Dashboard";
import Devis from "./pages/Devis";
import Clients from "./pages/Clients";
import Budget from "./pages/Budget";
import Stock from "./pages/Stock";
import Factures from "./pages/Factures";
import Compta from "./pages/Compta";
import Tresorerie from "./pages/Tresorerie";
import Fournisseurs from "./pages/Fournisseurs";
import Conformite from "./pages/Conformite";
import Entreprise from "./pages/Entreprise";
import Acces from "./pages/Acces";
import Terrain from "./pages/Terrain";
import PortailClient from "./pages/PortailClient";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import { CurrencyProvider } from "./context/CurrencyContext";
import { navKeysForRole, defaultPageForRole, ROLE_LABELS } from "./config/navByRole";
import BrandLogo from "./components/BrandLogo";
import MobileBottomNav from "./components/MobileBottomNav";

import {
  Home,
  Building2,
  Users,
  FileText,
  Wallet,
  UsersRound,
  Boxes,
  LogOut,
  Sun,
  Moon,
  Menu,
  Receipt,
  Landmark,
  PiggyBank,
  Truck,
  ShieldCheck,
  Building,
  HardHat,
  LayoutGrid,
} from "lucide-react";

// === Navigation interne (ordre du menu) ===
const ALL_NAV_ITEMS = [
  { key: "entreprise", label: "Mon entreprise", icon: Building },
  { key: "acces", label: "Accès & équipe", icon: UsersRound },
  { key: "dashboard", label: "Tableau de bord", icon: Home },
  { key: "chantiers", label: "Chantiers", icon: Building2 },
  { key: "terrain", label: "Terrain", icon: HardHat },
  { key: "portail", label: "Mon chantier", icon: LayoutGrid },
  { key: "clients", label: "Clients", icon: Users },
  { key: "devis", label: "Devis", icon: FileText },
  { key: "factures", label: "Factures", icon: Receipt },
  { key: "compta", label: "Compta & Finance", icon: Landmark },
  { key: "tresorerie", label: "Trésorerie", icon: PiggyBank },
  { key: "fournisseurs", label: "Fournisseurs", icon: Truck },
  { key: "conformite", label: "Conformité", icon: ShieldCheck },
  { key: "budget", label: "Budget", icon: Wallet },
  { key: "equipe", label: "Équipe", icon: UsersRound },
  { key: "stock", label: "Stock", icon: Boxes },
];

function getAllowedPages(role) {
  return navKeysForRole(role || "ENTREPRENEUR");
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(checkAuth());
  const [clients, setClients] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const userMenuRef = useRef(null);

  const resolvePageFromHash = (role = "ENTREPRENEUR") => {
    const allowed = getAllowedPages(role);
    const raw = window.location.hash.replace(/^#\/?/, "").toLowerCase();
    if (allowed.includes(raw)) return raw;
    return defaultPageForRole(role);
  };

  const [page, setPage] = useState("dashboard");

  const navigate = (pageId) => {
    window.location.hash = `/${pageId}`;
    setPage(pageId);
    setShowSidebar(false);
  };

  useEffect(() => {
    const onHash = () => setPage(resolvePageFromHash(user?.role));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [user?.role]);

  useEffect(() => {
    if (!user?.role) return;
    const target = resolvePageFromHash(user.role);
    if (target !== page) {
      window.location.hash = `/${target}`;
      setPage(target);
    }
  }, [user?.role]);

  useEffect(() => {
    const onAuthLogout = () => setIsAuthenticated(false);
    window.addEventListener("auth:logout", onAuthLogout);
    return () => window.removeEventListener("auth:logout", onAuthLogout);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    document.body.style.overflow = showSidebar && window.innerWidth < 768 ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showSidebar]);

  useEffect(() => {
    if (!showUserMenu) return;
    const close = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [showUserMenu]);

  const handleTouchStart = (e) => (touchStartX.current = e.touches[0].clientX);
  const handleTouchMove = (e) => (touchEndX.current = e.touches[0].clientX);
  const handleTouchEnd = () => {
    const distance = touchEndX.current - touchStartX.current;
    if (window.innerWidth < 768) {
      if (distance > 80) setShowSidebar(true);
      if (distance < -80) setShowSidebar(false);
    }
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await apiLogout();
    setUser(null);
    setClients([]);
    setChantiers([]);
    setShowSidebar(false);
    setIsAuthenticated(false);
    window.location.hash = "";
  };

  useEffect(() => {
    const onOrgUpdated = (e) => {
      const org = e.detail;
      if (org) setUser((u) => (u ? { ...u, organization: { ...u.organization, ...org } } : u));
    };
    window.addEventListener("org:updated", onOrgUpdated);
    return () => window.removeEventListener("org:updated", onOrgUpdated);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    api
      .get("/user/me")
      .then((uRes) => {
        const u = uRes.data;
        setUser(u);
        const role = u.role || "ENTREPRENEUR";
        const isEntrepreneur = role === "ENTREPRENEUR" || role === "ADMIN";
        const needsClients = isEntrepreneur;
        const needsChantiers = role !== "CLIENT";

        const tasks = [];
        if (needsClients) tasks.push(api.get("/client").then((r) => setClients(r.data)));
        if (needsChantiers) {
          tasks.push(
            api.get("/chantier").then((r) => setChantiers(r.data.items || []))
          );
        }
        return Promise.all(tasks);
      })
      .catch(() => setError("Erreur lors du chargement des données"))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    const hashPath = window.location.hash.replace(/^#\/?/, "");
    if (hashPath.startsWith("verify/")) {
      const token = hashPath.slice("verify/".length).split("/")[0];
      if (token) {
        return (
          <VerifyEmail
            token={token}
            onDone={() => {
              window.location.hash = "";
            }}
          />
        );
      }
    }
    if (hashPath.startsWith("reset/")) {
      const token = hashPath.slice("reset/".length).split("/")[0];
      if (token) {
        return (
          <ResetPassword
            token={token}
            onDone={() => {
              window.location.hash = "";
              setIsAuthenticated(checkAuth());
            }}
          />
        );
      }
    }
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  const renderPage = () => {
    const role = user?.role || "ENTREPRENEUR";
    switch (page) {
      case "entreprise":
        return <Entreprise initialOrganization={user?.organization} />;
      case "acces":
        return <Acces />;
      case "dashboard":
        return <Dashboard />;
      case "chantiers":
        return <Chantier userRole={role} />;
      case "terrain":
        return <Terrain userRole={role} />;
      case "portail":
        return <PortailClient />;
      case "devis":
        return <Devis />;
      case "factures":
        return <Factures />;
      case "compta":
        return <Compta />;
      case "tresorerie":
        return <Tresorerie />;
      case "fournisseurs":
        return <Fournisseurs />;
      case "conformite":
        return <Conformite />;
      case "clients":
        return <Clients />;
      case "equipe":
        return <Equipe />;
      case "budget":
        return <Budget />;
      case "stock":
        return <Stock />;
      default:
        return <Dashboard />;
    }
  };

  const role = user?.role || "ENTREPRENEUR";
  const navItems = ALL_NAV_ITEMS.filter((item) => getAllowedPages(role).includes(item.key));

  return (
    <CurrencyProvider organization={user?.organization}>
    <div
      className={`min-h-[100dvh] flex font-sans overflow-x-hidden app-shell-bg ${
        darkMode ? "dark text-gray-100" : "text-brand-ink"
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* === Sidebar === */}
      <aside
        className={`fixed md:static top-0 left-0 h-[100dvh] md:h-full w-[min(85vw,280px)] md:w-64 app-sidebar flex flex-col shadow-xl transform transition-transform duration-300 z-40 ${
          showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))] flex-1 overflow-y-auto overscroll-contain">
          <BrandLogo size="md" light showText className="mb-6 px-1" />
          <nav className="space-y-1 pb-4">
            {navItems.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate(key)}
                className={`flex items-center w-full px-3 py-3 rounded-lg transition text-left text-sm touch-manipulation min-h-[44px] ${
                  page === key ? "nav-item-active" : "nav-item-idle"
                }`}
              >
                <Icon className="w-5 h-5 mr-2.5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full bg-white/10 hover:bg-white/15 text-white py-3 rounded-lg transition text-sm font-medium touch-manipulation min-h-[44px]"
          >
            <LogOut className="w-5 h-5" /> Déconnexion
          </button>
        </div>
      </aside>

      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* === Contenu principal === */}
      <div className="flex-1 flex flex-col w-full min-w-0">
        <div className="app-header-accent" />
        <header className="w-full flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 md:px-10 py-2.5 sm:py-3 app-header sticky top-0 z-20 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden text-brand-ink dark:text-gray-200 shrink-0 p-2 -ml-2 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setShowSidebar(!showSidebar)}
              type="button"
              aria-label="Menu"
            >
              <Menu className="w-7 h-7" />
            </button>
            <div className="md:hidden min-w-0">
              <BrandLogo size="xs" showText />
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <span className="hidden sm:inline text-gray-500 text-sm dark:text-gray-300">
              {new Date().toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="text-gray-600 dark:text-gray-200 p-2 rounded-xl hover:bg-brand-yellow-muted dark:hover:bg-brand-slate transition"
              type="button"
              title="Mode sombre / clair"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="flex items-center gap-2 bg-brand-yellow-muted dark:bg-brand-slate hover:bg-brand-yellow/20 dark:hover:bg-brand-slate/80 px-2 sm:px-3 py-1.5 rounded-full transition border border-brand-yellow/30 dark:border-brand-slate touch-manipulation min-h-[44px]"
                  aria-expanded={showUserMenu}
                  aria-haspopup="menu"
                >
                  <div className="w-8 h-8 bg-brand-charcoal text-brand-yellow flex items-center justify-center rounded-full font-bold shrink-0 text-sm">
                    {user.nom ? user.nom.charAt(0).toUpperCase() : "?"}
                  </div>
                  <span className="hidden sm:inline text-gray-700 dark:text-gray-200 text-sm truncate text-left max-w-[140px] md:max-w-none">
                    {user.nom || "Utilisateur"}
                    {user.role && (
                      <span className="hidden md:inline text-gray-400 dark:text-gray-500 text-xs ml-1">
                        ({ROLE_LABELS[user.role] || user.role})
                      </span>
                    )}
                  </span>
                </button>

                {showUserMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-lg py-1 z-50"
                  >
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {[user.prenom, user.nom].filter(Boolean).join(" ") || user.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      {user.role && (
                        <p className="text-xs text-amber-800 dark:text-brand-yellow mt-1 font-medium">
                          {ROLE_LABELS[user.role] || user.role}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-left"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* === Contenu dynamique === */}
        <main className="flex-1 w-full min-w-0 px-4 sm:px-5 md:px-10 py-4 md:py-8 pb-24 md:pb-8">
          <div className="max-w-[1600px] mx-auto w-full">{renderPage()}</div>
        </main>

        <MobileBottomNav
          role={role}
          page={page}
          allowedKeys={navItems.map((i) => i.key)}
          onNavigate={navigate}
          onOpenMenu={() => setShowSidebar(true)}
        />
      </div>
    </div>
    </CurrencyProvider>
  );
}
