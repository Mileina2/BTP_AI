import { StyleSheet, Text, View } from "react-native";
import Screen from "@/components/Screen";
import { BRAND } from "@/constants/brand";
import { useApiGet } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";

type Rapport = {
  id?: string;
  _id?: string;
  date?: string;
  contenu?: string;
  chantier?: { nom?: string };
  auteur?: { nom?: string; prenom?: string };
};

export default function TerrainTab() {
  const { data, loading, error, reload } = useApiGet<Rapport[]>("/terrain/rapports");

  return (
    <Screen title="Terrain" subtitle="Rapports journaliers" loading={loading} error={error} onRefresh={reload} refreshing={loading}>
      {(data || []).slice(0, 30).map((r) => {
        const id = r.id || r._id || String(Math.random());
        const auteur = [r.auteur?.prenom, r.auteur?.nom].filter(Boolean).join(" ");
        return (
          <View key={id} style={styles.card}>
            <Text style={styles.chantier}>{r.chantier?.nom || "Chantier"}</Text>
            <Text style={styles.date}>{formatDate(r.date)}</Text>
            <Text style={styles.contenu} numberOfLines={4}>
              {r.contenu || "—"}
            </Text>
            {auteur ? <Text style={styles.auteur}>Par {auteur}</Text> : null}
          </View>
        );
      })}
      {(data?.length ?? 0) === 0 && !loading && (
        <Text style={styles.empty}>Aucun rapport terrain. Créez-en depuis l&apos;app web ou ajoutez cette fonction ici.</Text>
      )}
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
  chantier: { fontSize: 15, fontWeight: "700", color: BRAND.colors.ink },
  date: { fontSize: 12, color: BRAND.colors.muted },
  contenu: { fontSize: 14, color: BRAND.colors.ink, marginTop: 6, lineHeight: 20 },
  auteur: { fontSize: 11, color: BRAND.colors.muted, marginTop: 6 },
  empty: { textAlign: "center", color: BRAND.colors.muted, marginTop: 24, lineHeight: 20 },
});
