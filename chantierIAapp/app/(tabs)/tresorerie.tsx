import { StyleSheet, Text, View } from "react-native";
import KpiCard from "@/components/KpiCard";
import Screen from "@/components/Screen";
import { BRAND } from "@/constants/brand";
import { useApiGet } from "@/context/AuthContext";
import { formatFCFAShort } from "@/lib/format";

type TresorerieOverview = {
  kpis?: {
    solde?: number;
    encaissementsMois?: number;
    decaissementsMois?: number;
    creancesClients?: number;
    dettesFournisseurs?: number;
  };
  alertes?: { titre?: string; message?: string; priorite?: string }[];
};

export default function TresorerieTab() {
  const { data, loading, error, reload } = useApiGet<TresorerieOverview>("/tresorerie/overview");
  const k = data?.kpis;

  return (
    <Screen title="Trésorerie" subtitle="Flux et soldes" loading={loading} error={error} onRefresh={reload} refreshing={loading}>
      <View style={styles.grid}>
        <KpiCard label="Solde" value={formatFCFAShort(k?.solde)} accent />
        <KpiCard label="Encaissements" value={formatFCFAShort(k?.encaissementsMois)} />
        <KpiCard label="Décaissements" value={formatFCFAShort(k?.decaissementsMois)} />
        <KpiCard label="Créances clients" value={formatFCFAShort(k?.creancesClients)} />
        <KpiCard label="Dettes fournisseurs" value={formatFCFAShort(k?.dettesFournisseurs)} />
      </View>

      {(data?.alertes?.length ?? 0) > 0 && (
        <>
          <Text style={styles.section}>Alertes trésorerie</Text>
          {data!.alertes!.map((a, i) => (
            <View key={i} style={styles.alert}>
              <Text style={styles.alertTitle}>{a.titre}</Text>
              <Text style={styles.alertText}>{a.message}</Text>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  section: { fontSize: 16, fontWeight: "700", color: BRAND.colors.ink, marginTop: 8 },
  alert: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.colors.yellow,
  },
  alertTitle: { fontWeight: "700", color: BRAND.colors.ink, fontSize: 13 },
  alertText: { color: BRAND.colors.muted, fontSize: 12, marginTop: 4 },
});
