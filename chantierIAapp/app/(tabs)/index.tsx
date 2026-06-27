import { Redirect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import KpiCard from "@/components/KpiCard";
import Screen from "@/components/Screen";
import { BRAND } from "@/constants/brand";
import { useAuth, useApiGet } from "@/context/AuthContext";
import { formatFCFAShort } from "@/lib/format";

type DashboardSummary = {
  stats?: {
    clients?: number;
    chantiers?: number;
    devisEnCours?: number;
    caMois?: number;
  };
  santeEntreprise?: { score?: number; label?: string };
  pilotage?: {
    tresorerie?: { kpis?: { solde?: number; encaissementsMois?: number; decaissementsMois?: number } };
    conformite?: { score?: number; echeancesProches?: number };
  };
  warnings?: { message?: string }[];
};

export default function DashboardTab() {
  const { user } = useAuth();
  const role = user?.role;

  if (role === "CHEF_CHANTIER") return <Redirect href="/terrain" />;
  if (role === "CLIENT") return <Redirect href="/portail" />;

  const { data, loading, error, reload } = useApiGet<DashboardSummary>("/dashboard/summary");
  const stats = data?.stats;
  const score = data?.santeEntreprise?.score ?? 0;
  const treso = data?.pilotage?.tresorerie?.kpis;

  return (
    <Screen
      title="Tableau de bord"
      subtitle={user?.organization?.nom || "Pilotage entreprise"}
      loading={loading}
      error={error}
      onRefresh={reload}
      refreshing={loading}
    >
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Santé entreprise</Text>
        <Text style={styles.scoreValue}>{score}/100</Text>
        <Text style={styles.scoreHint}>{data?.santeEntreprise?.label || "Score global"}</Text>
      </View>

      <View style={styles.grid}>
        <KpiCard label="Clients" value={String(stats?.clients ?? 0)} />
        <KpiCard label="Chantiers" value={String(stats?.chantiers ?? 0)} />
        <KpiCard label="Devis en cours" value={String(stats?.devisEnCours ?? 0)} />
        <KpiCard label="CA du mois" value={formatFCFAShort(stats?.caMois)} accent />
      </View>

      <Text style={styles.section}>Trésorerie</Text>
      <View style={styles.grid}>
        <KpiCard label="Solde" value={formatFCFAShort(treso?.solde)} accent />
        <KpiCard label="Encaissements" value={formatFCFAShort(treso?.encaissementsMois)} />
        <KpiCard label="Décaissements" value={formatFCFAShort(treso?.decaissementsMois)} />
        <KpiCard
          label="Conformité"
          value={`${data?.pilotage?.conformite?.score ?? 0}%`}
          hint={`${data?.pilotage?.conformite?.echeancesProches ?? 0} échéance(s) proche(s)`}
        />
      </View>

      {(data?.warnings?.length ?? 0) > 0 && (
        <>
          <Text style={styles.section}>Alertes</Text>
          {data!.warnings!.slice(0, 4).map((w, i) => (
            <View key={i} style={styles.alert}>
              <Text style={styles.alertText}>{w.message}</Text>
            </View>
          ))}
        </>
      )}

      <Text style={styles.hint}>
        Version mobile native — utilisez le menu pour les modules avancés (Compta, Budget…). Sur PC, ouvrez l&apos;app web.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreCard: {
    backgroundColor: BRAND.colors.charcoal,
    borderRadius: 16,
    padding: 18,
  },
  scoreLabel: { color: "#D1D5DB", fontSize: 12, fontWeight: "600" },
  scoreValue: { color: BRAND.colors.yellow, fontSize: 36, fontWeight: "900", marginTop: 4 },
  scoreHint: { color: "#9CA3AF", fontSize: 12, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  section: { fontSize: 16, fontWeight: "700", color: BRAND.colors.ink, marginTop: 8 },
  alert: {
    backgroundColor: "#FEF3C7",
    borderLeftWidth: 4,
    borderLeftColor: BRAND.colors.yellow,
    padding: 12,
    borderRadius: 10,
  },
  alertText: { color: BRAND.colors.ink, fontSize: 13 },
  hint: { fontSize: 12, color: BRAND.colors.muted, marginTop: 8, lineHeight: 18 },
});
