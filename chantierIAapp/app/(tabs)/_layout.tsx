import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { HapticTab } from "@/components/haptic-tab";
import { BRAND } from "@/constants/brand";
import { useAuth } from "@/context/AuthContext";
import { navKeysForRole, TAB_LABELS } from "@/lib/navByRole";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home-outline",
  chantiers: "business-outline",
  factures: "receipt-outline",
  tresorerie: "wallet-outline",
  terrain: "construct-outline",
  stock: "cube-outline",
  portail: "grid-outline",
  menu: "menu-outline",
};

function tabHref(name: string, allowed: string[]) {
  const key = name === "index" ? "dashboard" : name;
  return allowed.includes(key) ? undefined : null;
}

export default function TabLayout() {
  const { user } = useAuth();
  const allowed = navKeysForRole(user?.role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND.colors.ink,
        tabBarInactiveTintColor: BRAND.colors.muted,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#E5E7EB",
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: TAB_LABELS.dashboard,
          href: tabHref("index", allowed),
          tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.index} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="terrain"
        options={{
          title: TAB_LABELS.terrain,
          href: tabHref("terrain", allowed),
          tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.terrain} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chantiers"
        options={{
          title: TAB_LABELS.chantiers,
          href: tabHref("chantiers", allowed),
          tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.chantiers} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="factures"
        options={{
          title: TAB_LABELS.factures,
          href: tabHref("factures", allowed),
          tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.factures} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tresorerie"
        options={{
          title: TAB_LABELS.tresorerie,
          href: tabHref("tresorerie", allowed),
          tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.tresorerie} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: TAB_LABELS.stock,
          href: tabHref("stock", allowed),
          tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.stock} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="portail"
        options={{
          title: TAB_LABELS.portail,
          href: tabHref("portail", allowed),
          tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.portail} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: TAB_LABELS.menu,
          href: tabHref("menu", allowed),
          tabBarIcon: ({ color, size }) => <Ionicons name={ICONS.menu} size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
