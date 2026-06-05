import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PayDuka Merchant",
  slug: "payduka-merchant",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "payduka-merchant",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0A0A08",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0A0A08",
    },
    package: "xyz.payduka.merchant",
    permissions: [
      "USE_BIOMETRIC",
      "USE_FINGERPRINT",
      "CAMERA",
      "VIBRATE",
    ],
  },
  ios: {
    bundleIdentifier: "xyz.payduka.merchant",
    infoPlist: {
      NSFaceIDUsageDescription:
        "PayDuka uses Face ID for fast, secure login.",
      NSCameraUsageDescription:
        "PayDuka uses the camera to scan QR codes.",
    },
  },
  plugins: ["expo-router", "expo-local-authentication", "expo-secure-store"],
  extra: {
    apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3000/api/v1",
    wsBaseUrl: process.env.WS_BASE_URL ?? "ws://localhost:3000/ws",
  },
});
