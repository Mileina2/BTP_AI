import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import api from "@/lib/api";
import { BRAND } from "@/constants/brand";

export default function MobileTwoFactorSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"idle" | "confirm-enable" | "confirm-disable">("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get("/auth/profil")
      .then((res) => setEnabled(Boolean(res.data?.twoFactorEnabled)))
      .catch(() => setError("Impossible de charger la 2FA"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={BRAND.colors.yellow} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Double authentification (2FA)</Text>
      <Text style={styles.sub}>Code par email à chaque connexion — {enabled ? "Activée" : "Désactivée"}</Text>

      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}

      {step === "idle" && !enabled && (
        <Pressable style={styles.btn} onPress={async () => {
          setBusy(true);
          setError("");
          try {
            const res = await api.post("/auth/2fa/enable");
            setMessage(res.data?.message || "Code envoyé.");
            setStep("confirm-enable");
          } catch (err: unknown) {
            setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Erreur");
          } finally {
            setBusy(false);
          }
        }} disabled={busy}>
          <Text style={styles.btnText}>{busy ? "…" : "Activer la 2FA"}</Text>
        </Pressable>
      )}

      {step === "confirm-enable" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Code 6 chiffres"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
          />
          <Pressable style={styles.btn} onPress={async () => {
            setBusy(true);
            try {
              await api.post("/auth/2fa/enable/confirm", { code });
              setEnabled(true);
              setStep("idle");
              setCode("");
              setMessage("2FA activée.");
            } catch (err: unknown) {
              setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Code invalide");
            } finally {
              setBusy(false);
            }
          }} disabled={busy || code.length !== 6}>
            <Text style={styles.btnText}>Confirmer</Text>
          </Pressable>
        </>
      )}

      {step === "idle" && enabled && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Pressable style={styles.btnOutline} onPress={async () => {
            setBusy(true);
            setError("");
            try {
              const res = await api.post("/auth/2fa/disable", { motDePasse: password });
              setMessage(res.data?.message || "Code envoyé.");
              setStep("confirm-disable");
            } catch (err: unknown) {
              setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Erreur");
            } finally {
              setBusy(false);
            }
          }} disabled={busy || !password}>
            <Text style={styles.btnOutlineText}>Désactiver la 2FA</Text>
          </Pressable>
        </>
      )}

      {step === "confirm-disable" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Code 6 chiffres"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
          />
          <Pressable style={styles.btnOutline} onPress={async () => {
            setBusy(true);
            try {
              await api.post("/auth/2fa/disable/confirm", { code });
              setEnabled(false);
              setStep("idle");
              setCode("");
              setPassword("");
              setMessage("2FA désactivée.");
            } catch (err: unknown) {
              setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Code invalide");
            } finally {
              setBusy(false);
            }
          }} disabled={busy || code.length !== 6}>
            <Text style={styles.btnOutlineText}>Confirmer désactivation</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: "700", color: BRAND.colors.ink },
  sub: { fontSize: 12, color: BRAND.colors.muted },
  ok: { fontSize: 12, color: "#15803d" },
  err: { fontSize: 12, color: BRAND.colors.danger },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    textAlign: "center",
    letterSpacing: 4,
  },
  btn: {
    backgroundColor: BRAND.colors.yellow,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  btnText: { fontWeight: "700", color: BRAND.colors.ink },
  btnOutline: {
    borderWidth: 1,
    borderColor: BRAND.colors.yellow,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  btnOutlineText: { fontWeight: "600", color: BRAND.colors.ink },
});
