import { StyleSheet, Text, View } from "react-native";
import KpiCard from "@/components/KpiCard";
import Screen from "@/components/Screen";
import { BRAND } from "@/constants/brand";
import { useApiGet } from "@/context/AuthContext";
import { formatFCFAShort } from "@/lib/format";

type PortalStats = {
  chantier?: { nom?: string; pourcentage?: number };
  stats?: {
    devisEnAttente?: number;
    facturesImpayees?: number;
    montantDu?: number;
  };
};

export default function PortailTab() {
  const { data, loading, error, reload } = useApiGet<PortalStats>("/portal/stats");

  return (
    <Screen
      title="Mon chantier"
      subtitle={data?.chantier?.nom || "Espace propriétaire"}
      loading={loading}
      error={error}
      onRefresh={reload}
      refreshing={loading}
    >
      <View style={styles.progressCard}>
        <Text style={styles.progressLabel}>Avancement</Text>
        <Text style={styles.progressValue}>{data?.chantier?.pourcentage ?? 0}%</Text>
      </View>

      <View style={styles.grid}>
        <KpiCard label="Devis en attente" value={String(data?.stats?.devisEnAttente ?? 0)} />
        <KpiCard label="Factures impayées" value={String(data?.stats?.facturesImpayees ?? 0)} />
        <KpiCard label="Montant dû" value={formatFCFAShort(data?.stats?.montantDu)} accent />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    backgroundColor: BRAND.colors.charcoal,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  progressLabel: { color: "#D1D5DB", fontSize: 12 },
  progressValue: { color: BRAND.colors.yellow, fontSize: 40, fontWeight: "900", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
