import { StyleSheet, Text, View } from "react-native";
import Screen from "@/components/Screen";
import { BRAND } from "@/constants/brand";
import { useApiGet } from "@/context/AuthContext";
import { formatDate, formatFCFA } from "@/lib/format";

type Facture = {
  id?: string;
  _id?: string;
  numero?: string;
  statut?: string;
  montantTTC?: number;
  resteDu?: number;
  dateEmission?: string;
  client?: { nom?: string };
  chantier?: { nom?: string };
};

export default function FacturesTab() {
  const { data, loading, error, reload } = useApiGet<Facture[]>("/factures");

  return (
    <Screen title="Factures" subtitle="Suivi encaissements" loading={loading} error={error} onRefresh={reload} refreshing={loading}>
      {(data || []).slice(0, 50).map((f) => {
        const id = f.id || f._id || f.numero || String(Math.random());
        const impaye = (f.resteDu ?? 0) > 0;
        return (
          <View key={id} style={[styles.card, impaye && styles.cardWarn]}>
            <View style={styles.row}>
              <Text style={styles.num}>{f.numero || "—"}</Text>
              <Text style={styles.statut}>{f.statut || "—"}</Text>
            </View>
            <Text style={styles.client}>{f.client?.nom || "Client"}</Text>
            <Text style={styles.chantier}>{f.chantier?.nom || ""}</Text>
            <View style={styles.row}>
              <Text style={styles.amount}>{formatFCFA(f.montantTTC)}</Text>
              {(f.resteDu ?? 0) > 0 && <Text style={styles.reste}>Reste {formatFCFA(f.resteDu)}</Text>}
            </View>
            <Text style={styles.date}>{formatDate(f.dateEmission)}</Text>
          </View>
        );
      })}
      {(data?.length ?? 0) === 0 && !loading && <Text style={styles.empty}>Aucune facture</Text>}
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
  cardWarn: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  num: { fontSize: 15, fontWeight: "800", color: BRAND.colors.ink },
  statut: { fontSize: 11, fontWeight: "600", color: BRAND.colors.muted },
  client: { fontSize: 14, color: BRAND.colors.ink },
  chantier: { fontSize: 12, color: BRAND.colors.muted },
  amount: { fontSize: 14, fontWeight: "700", color: BRAND.colors.ink, marginTop: 4 },
  reste: { fontSize: 12, fontWeight: "700", color: BRAND.colors.danger },
  date: { fontSize: 11, color: BRAND.colors.muted },
  empty: { textAlign: "center", color: BRAND.colors.muted, marginTop: 24 },
});
