import { StyleSheet, Text, View } from "react-native";
import Screen from "@/components/Screen";
import { BRAND } from "@/constants/brand";
import { useApiGet } from "@/context/AuthContext";
import { formatFCFAShort } from "@/lib/format";

type Chantier = {
  id?: string;
  _id?: string;
  nom?: string;
  statut?: string;
  pourcentage?: number;
  budgetPrevu?: number;
  client?: { nom?: string };
};

export default function ChantiersTab() {
  const { data, loading, error, reload } = useApiGet<Chantier[]>("/chantiers");

  return (
    <Screen title="Chantiers" subtitle="Projets en cours" loading={loading} error={error} onRefresh={reload} refreshing={loading}>
      {(data || []).map((c) => {
        const id = c.id || c._id || String(Math.random());
        return (
          <View key={id} style={styles.card}>
            <Text style={styles.name}>{c.nom || "Sans nom"}</Text>
            <Text style={styles.meta}>{c.client?.nom || "Client non renseigné"}</Text>
            <View style={styles.row}>
              <Text style={styles.badge}>{c.statut || "—"}</Text>
              <Text style={styles.pct}>{c.pourcentage ?? 0}%</Text>
            </View>
            {c.budgetPrevu != null && <Text style={styles.budget}>Budget : {formatFCFAShort(c.budgetPrevu)}</Text>}
          </View>
        );
      })}
      {(data?.length ?? 0) === 0 && !loading && <Text style={styles.empty}>Aucun chantier</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
  },
  name: { fontSize: 16, fontWeight: "700", color: BRAND.colors.ink },
  meta: { fontSize: 13, color: BRAND.colors.muted },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  badge: {
    fontSize: 11,
    fontWeight: "600",
    color: BRAND.colors.ink,
    backgroundColor: BRAND.colors.yellowMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pct: { fontSize: 14, fontWeight: "800", color: BRAND.colors.ink },
  budget: { fontSize: 12, color: BRAND.colors.muted, marginTop: 4 },
  empty: { textAlign: "center", color: BRAND.colors.muted, marginTop: 24 },
});
