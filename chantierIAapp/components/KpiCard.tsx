import { StyleSheet, Text, View } from "react-native";
import { BRAND } from "@/constants/brand";

type Props = {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
};

export default function KpiCard({ label, value, hint, accent }: Props) {
  return (
    <View style={[styles.card, accent && styles.accent]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accent && styles.valueAccent]} numberOfLines={2}>
        {value}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  accent: { borderColor: BRAND.colors.yellow, backgroundColor: BRAND.colors.yellowMuted },
  label: { fontSize: 11, color: BRAND.colors.muted, fontWeight: "600", textTransform: "uppercase" },
  value: { fontSize: 18, fontWeight: "800", color: BRAND.colors.ink, marginTop: 6 },
  valueAccent: { color: BRAND.colors.ink },
  hint: { fontSize: 11, color: BRAND.colors.muted, marginTop: 4 },
});
