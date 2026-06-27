import { StyleSheet, Text, View } from "react-native";
import Screen from "@/components/Screen";
import { BRAND } from "@/constants/brand";
import { useApiGet } from "@/context/AuthContext";

type Article = {
  id?: string;
  _id?: string;
  nom?: string;
  quantite?: number;
  unite?: string;
  seuilAlerte?: number;
  chantier?: { nom?: string };
};

export default function StockTab() {
  const { data, loading, error, reload } = useApiGet<{ articles?: Article[] } | Article[]>("/stock/overview");

  const articles = Array.isArray(data) ? data : data?.articles || [];

  return (
    <Screen title="Stock" subtitle="Matériaux chantier" loading={loading} error={error} onRefresh={reload} refreshing={loading}>
      {articles.map((a) => {
        const id = a.id || a._id || a.nom || String(Math.random());
        const low = (a.quantite ?? 0) <= (a.seuilAlerte ?? 0);
        return (
          <View key={id} style={[styles.card, low && styles.cardWarn]}>
            <Text style={styles.name}>{a.nom || "Article"}</Text>
            <Text style={styles.chantier}>{a.chantier?.nom || ""}</Text>
            <Text style={styles.qty}>
              {a.quantite ?? 0} {a.unite || ""}
              {low ? " · stock bas" : ""}
            </Text>
          </View>
        );
      })}
      {articles.length === 0 && !loading && <Text style={styles.empty}>Aucun article en stock</Text>}
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
  cardWarn: { borderColor: "#FCD34D", backgroundColor: "#FFFBEB" },
  name: { fontSize: 15, fontWeight: "700", color: BRAND.colors.ink },
  chantier: { fontSize: 12, color: BRAND.colors.muted },
  qty: { fontSize: 14, fontWeight: "600", color: BRAND.colors.ink, marginTop: 4 },
  empty: { textAlign: "center", color: BRAND.colors.muted, marginTop: 24 },
});
