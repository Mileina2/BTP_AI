import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND } from "@/constants/brand";

type Props = {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
};

export default function Screen({
  title,
  subtitle,
  loading,
  error,
  onRefresh,
  refreshing,
  children,
}: Props) {
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.colors.yellow} />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={BRAND.colors.yellow} /> : undefined
        }
      >
        {(title || subtitle) && (
          <View style={styles.header}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.surface },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  header: { marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "800", color: BRAND.colors.ink },
  subtitle: { fontSize: 13, color: BRAND.colors.muted, marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: BRAND.colors.muted },
  error: { color: BRAND.colors.danger, backgroundColor: "#FEE2E2", padding: 12, borderRadius: 12 },
});
