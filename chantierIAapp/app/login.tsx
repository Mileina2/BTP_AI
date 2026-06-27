import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import BrandLogo from "@/components/BrandLogo";
import { BRAND } from "@/constants/brand";
import { useAuth } from "@/context/AuthContext";
import { LOGIN_PROFILES, getLoginProfile, SHOW_DEMO_LOGIN } from "@/lib/loginProfiles";
import { API_URL } from "@/lib/config";

export default function LoginScreen() {
  const { user, login, verify2FA, resend2FA } = useAuth();
  const [profileRole, setProfileRole] = useState("ENTREPRENEUR");
  const profile = getLoginProfile(profileRole);
  const [email, setEmail] = useState<string>(SHOW_DEMO_LOGIN ? profile.demoEmail : "");
  const [password, setPassword] = useState<string>(SHOW_DEMO_LOGIN ? profile.demoPassword : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [twoFARequired, setTwoFARequired] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [twoFAInfo, setTwoFAInfo] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  if (user) return <Redirect href="/(tabs)" />;

  const selectProfile = (role: string) => {
    setProfileRole(role);
    const p = getLoginProfile(role);
    if (SHOW_DEMO_LOGIN) {
      setEmail(p.demoEmail);
      setPassword(p.demoPassword);
    }
    setError("");
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await login(email.trim(), password);
      if (result.requires2FA) {
        setTwoFARequired(true);
        setChallengeToken(result.challengeToken);
        setTwoFAInfo(result.message || "Code envoyé par email.");
        setOtpCode("");
        return;
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Connexion impossible. Vérifiez l'email, le mot de passe et que le serveur tourne.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    setLoading(true);
    setError("");
    try {
      await verify2FA(challengeToken, otpCode.trim());
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Code invalide ou expiré"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend2FA = async () => {
    setResendLoading(true);
    setError("");
    try {
      const msg = await resend2FA(challengeToken);
      setTwoFAInfo(msg || "Nouveau code envoyé.");
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Impossible de renvoyer le code"
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <BrandLogo size="lg" />
          </View>

          <Text style={styles.heading}>{twoFARequired ? "Double authentification" : "Connexion"}</Text>
          <Text style={styles.sub}>
            {twoFARequired ? "Entrez le code reçu par email" : "Profil utilisateur"}
          </Text>

          {!twoFARequired && (
            <View style={styles.profiles}>
              {LOGIN_PROFILES.map((p) => {
                const active = profileRole === p.role;
                return (
                  <Pressable
                    key={p.role}
                    onPress={() => selectProfile(p.role)}
                    style={[styles.profileChip, active && styles.profileChipActive]}
                  >
                    <Text style={[styles.profileLabel, active && styles.profileLabelActive]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {twoFARequired ? (
            <>
              <Text style={styles.info}>{twoFAInfo}</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="Code à 6 chiffres"
                keyboardType="number-pad"
                maxLength={6}
                value={otpCode}
                onChangeText={(t) => setOtpCode(t.replace(/\D/g, ""))}
              />
              <Pressable
                style={[styles.btn, (loading || otpCode.length !== 6) && styles.btnDisabled]}
                onPress={handleVerify2FA}
                disabled={loading || otpCode.length !== 6}
              >
                {loading ? (
                  <ActivityIndicator color={BRAND.colors.ink} />
                ) : (
                  <Text style={styles.btnText}>Valider le code</Text>
                )}
              </Pressable>
              <Pressable style={styles.demoBtn} onPress={handleResend2FA} disabled={resendLoading}>
                <Text style={styles.demoText}>{resendLoading ? "Envoi…" : "Renvoyer le code"}</Text>
              </Pressable>
              <Pressable
                style={styles.demoBtn}
                onPress={() => {
                  setTwoFARequired(false);
                  setChallengeToken("");
                  setOtpCode("");
                }}
              >
                <Text style={styles.demoText}>Retour</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={BRAND.colors.ink} />
                ) : (
                  <Text style={styles.btnText}>Se connecter</Text>
                )}
              </Pressable>

              {SHOW_DEMO_LOGIN && (
                <Pressable
                  style={styles.demoBtn}
                  onPress={() => {
                    setEmail(profile.demoEmail);
                    setPassword(profile.demoPassword);
                  }}
                >
                  <Text style={styles.demoText}>Compte démo : {profile.demoEmail}</Text>
                </Pressable>
              )}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {__DEV__ && <Text style={styles.apiHint}>API : {API_URL}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.colors.surface },
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 12 },
  hero: { alignItems: "center", marginVertical: 16 },
  heading: { fontSize: 24, fontWeight: "800", color: BRAND.colors.ink },
  sub: { fontSize: 13, color: BRAND.colors.muted },
  info: { fontSize: 14, color: BRAND.colors.ink, lineHeight: 20 },
  profiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  profileChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  profileChipActive: { borderColor: BRAND.colors.yellow, backgroundColor: BRAND.colors.yellowMuted },
  profileLabel: { fontSize: 12, fontWeight: "600", color: BRAND.colors.muted },
  profileLabelActive: { color: BRAND.colors.ink },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: BRAND.colors.ink,
  },
  otpInput: { textAlign: "center", fontSize: 22, letterSpacing: 8 },
  error: { color: BRAND.colors.danger, fontSize: 13 },
  btn: {
    backgroundColor: BRAND.colors.yellow,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { fontWeight: "800", color: BRAND.colors.ink, fontSize: 16 },
  demoBtn: { alignItems: "center", paddingVertical: 8 },
  demoText: { fontSize: 12, color: BRAND.colors.muted },
  apiHint: { fontSize: 10, color: BRAND.colors.muted, textAlign: "center", marginTop: 8 },
});
