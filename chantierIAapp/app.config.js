/**
 * Config Expo — dev vs production (HTTPS, cleartext).
 * Build prod : APP_VARIANT=production EXPO_PUBLIC_API_URL=https://api.votredomaine.com/api eas build
 */
export default ({ config }) => {
  const isProd = process.env.APP_VARIANT === "production";
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    (isProd ? "https://api.votredomaine.com/api" : "http://10.0.2.2:4000/api");

  return {
    ...config,
    name: "BTP IA",
    slug: "chantieriaapp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo-btpia.png",
    scheme: "chantieriaapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mileina.chantieriaapp1",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: isProd
          ? { NSAllowsArbitraryLoads: false }
          : { NSAllowsArbitraryLoads: true },
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#F5C518",
        foregroundImage: "./assets/images/logo-btpia.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.mileina.chantieriaappB",
      usesCleartextTraffic: !isProd,
    },
    web: {
      output: "static",
      favicon: "./assets/images/logo-btpia.png",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/logo-btpia.png",
          imageWidth: 180,
          resizeMode: "contain",
          backgroundColor: "#141414",
          dark: { backgroundColor: "#141414" },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      apiUrl,
      router: {},
      eas: {
        projectId: "84e645c6-91a6-40d9-a5ea-eb53ed657149",
      },
    },
    owner: "mileina",
    runtimeVersion: { policy: "appVersion" },
    updates: {
      url: "https://u.expo.dev/84e645c6-91a6-40d9-a5ea-eb53ed657149",
    },
  };
};
