import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import BrandLogo from "@/components/BrandLogo";
import Screen from "@/components/Screen";
import { BRAND } from "@/constants/brand";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABELS } from "@/lib/navByRole";
import { API_URL } from "@/lib/config";
import MobileTwoFactorSettings from "@/components/MobileTwoFactorSettings";

const WEB_MODULES = [
  "Compta & Finance",
  "Budget",
  "Fournisseurs",
  "Conformité OHADA",
  "Devis",
  "Clients",
  "Mon entreprise",
];

export default function MenuTab() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <Screen title="Menu" subtitle="Compte et modules">
      <View style={styles.profileCard}>
        <BrandLogo size="sm" showText={false} />
        <View style={styles.profileText}>
          <Text style={styles.name}>{[user?.prenom, user?.nom].filter(Boolean).join(" ") || user?.email}</Text>
          <Text style={styles.role}>{ROLE_LABELS[user?.role || ""] || user?.role}</Text>
          <Text style={styles.org}>{user?.organization?.nom}</Text>
        </View>
      </View>

      {(user?.role === "ENTREPRENEUR" || user?.role === "ADMIN") && <MobileTwoFactorSettings />}

      <Text style={styles.section}>Modules avancés (app web PC)</Text>
      {WEB_MODULES.map((m) => (
        <View key={m} style={styles.moduleRow}>
          <Text style={styles.moduleText}>{m}</Text>
          <Text style={styles.webBadge}>Web</Text>
        </View>
      ))}

      <Text style={styles.hint}>
        L&apos;app mobile couvre le pilotage terrain. Les modules comptables complets restent disponibles sur navigateur PC.
      </Text>

      <Text style={styles.api}>Serveur : {API_URL}</Text>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Déconnexion</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileText: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: BRAND.colors.ink },
  role: { fontSize: 12, color: BRAND.colors.yellow, fontWeight: "600", marginTop: 2 },
  org: { fontSize: 12, color: BRAND.colors.muted, marginTop: 2 },
  section: { fontSize: 14, fontWeight: "700", color: BRAND.colors.ink, marginTop: 8 },
  moduleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  moduleText: { fontSize: 14, color: BRAND.colors.ink },
  webBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: BRAND.colors.muted,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  hint: { fontSize: 12, color: BRAND.colors.muted, lineHeight: 18 },
  api: { fontSize: 10, color: BRAND.colors.muted, textAlign: "center" },
  logoutBtn: {
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  logoutText: { color: BRAND.colors.danger, fontWeight: "700", fontSize: 15 },
});
