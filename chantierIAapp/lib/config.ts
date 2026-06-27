import Constants from "expo-constants";
import { Platform } from "react-native";

/** Hôte API en dev : émulateur Android → 10.0.2.2, iOS → localhost */
const DEV_HOST = Platform.select({
  android: "10.0.2.2",
  ios: "localhost",
  default: "localhost",
});

export const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  `http://${DEV_HOST}:4000/api`;
