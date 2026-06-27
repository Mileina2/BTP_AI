import { Image, StyleSheet, Text, View } from "react-native";
import { BRAND } from "@/constants/brand";

type Props = {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
};

const SIZES = { sm: 28, md: 40, lg: 56 };

export default function BrandLogo({ size = "md", showText = true }: Props) {
  const dim = SIZES[size];
  return (
    <View style={styles.row}>
      <Image source={require("@/assets/images/logo-btpia.png")} style={{ width: dim, height: dim }} />
      {showText && (
        <View style={styles.textWrap}>
          <Text style={styles.name}>{BRAND.name}</Text>
          {size !== "sm" && <Text style={styles.tagline}>{BRAND.tagline}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  textWrap: { flexShrink: 1 },
  name: { fontSize: 18, fontWeight: "800", color: BRAND.colors.ink },
  tagline: { fontSize: 11, color: BRAND.colors.muted, marginTop: 2 },
});
